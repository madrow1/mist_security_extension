from flask import Flask, request, jsonify
from flask_cors import CORS
import json 
import os
import logging
from werkzeug.exceptions import BadRequest
import mysql.connector
from mysql.connector import pooling
from cryptography.fernet import Fernet
import hashlib
import secrets
import requests
from tests import check_admin, check_firmware, check_password_policy, get_ap_firmware_versions, get_wlans 
import re
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Establish Flask application and configure CORS
app = Flask(__name__)

# Configure CORS for specific origins (update with your actual frontend origins)
CORS(app)

# Load configuration from environment file
try:
    with open('env.json') as f:
        config = json.load(f)
        
    # Validate required configuration keys
    required_keys = ['host', 'user', 'password', 'database']
    # keys missing will cause the program to terminate and a log to be created
    missing_keys = [key for key in required_keys if key not in config]
    if missing_keys:
        raise ValueError(f"Missing required configuration keys: {missing_keys}")
        
    logger.info("Configuration loaded successfully")
except FileNotFoundError:
    logger.error("env.json file not found")
    exit(1)
except json.JSONDecodeError:
    logger.error("Invalid JSON in env.json file")
    exit(1)
except Exception as e:
    logger.error(f"Error loading configuration: {e}")
    exit(1)

# Initialize encryption key (in production, store this securely)
def get_or_create_encryption_key():
    key_file = 'encryption.key'
    if os.path.exists(key_file):
        with open(key_file, 'rb') as f:
            return f.read()
    else:
        key = Fernet.generate_key()
        with open(key_file, 'wb') as f:
            f.write(key)
        os.chmod(key_file, 0o600)  # Restrict file permissions
        return key

encryption_key = get_or_create_encryption_key()
cipher_suite = Fernet(encryption_key)

# Database connection pool
db_config = {
    'host': config['host'],
    'user': config['user'],
    'password': config['password'],
    'database': config['database'],
    'pool_name': 'mist_pool',
    'pool_size': 16,
    'pool_reset_session': True,
    'autocommit': True
}

try:
    connection_pool = pooling.MySQLConnectionPool(**db_config)
    logger.info("Database connection pool created successfully")
except Exception as e:
    logger.error(f"Failed to create database connection pool: {e}")
    exit(1)

# Callable DB connection function for reuse.
def get_db_connection():
    return connection_pool.get_connection()

def encrypt_api_key(api_key):
    return cipher_suite.encrypt(api_key.encode()).decode()

def decrypt_api_key(encrypted_key):
    return cipher_suite.decrypt(encrypted_key.encode()).decode()

# Validates the org_id using regex, not currently in use due to its occasionally returning errors. May use the UUID library for this eventually 
import re
# Define regex pattern once at module level
UUID_PATTERN = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)

def validate_org_id(org_id):
    if not org_id or len(org_id.strip()) != 36:
        return False
    return bool(UUID_PATTERN.match(org_id.strip()))

# Validates the API key, not currently in use because it was occasionally returning errors, needs further research. 
def validate_api_key(api_key):
    if not api_key or len(api_key.strip()) < 36:
        return False
    return True

@app.route('/api/pie-chart', methods=['GET'])
def get_pie_chart():
    try:
        org_id = request.args.get('org_id')
        if not org_id or not validate_org_id(org_id):
            return jsonify({"error": "Invalid organization ID"}), 400

        with get_db_connection() as db_connection:
            with db_connection.cursor() as cursor:
                # Get API credentials
                cursor.execute("SELECT api_key, api_url FROM customer_data WHERE org_id = %s", (org_id,))
                result = cursor.fetchone()
                
                if not result:
                    return jsonify({"error": "API key not found for this organization"}), 404

                # Get latest batch_id  
                cursor.execute("SELECT batch_id FROM customer_sites WHERE org_id = %s ORDER BY batch_id DESC LIMIT 1", (org_id,))
                batch_result = cursor.fetchone()

                if not batch_result:
                    return jsonify({"error": "No batch_id found for this organization"}), 404
                
                latest_batch_id = batch_result[0]

                # Get scores from latest batch
                cursor.execute("""
                    SELECT admin_score, failing_admins, site_firmware_score, site_firmware_failing,
                           password_policy_score, password_policy_recs, ap_firmware_score, ap_firmware_recs,
                           wlan_score, wlan_recs, COUNT(*) as site_count
                    FROM customer_sites 
                    WHERE org_id = %s AND batch_id = %s
                    LIMIT 1
                """, (org_id, latest_batch_id))

                score_result = cursor.fetchone()

                if not score_result:
                    return jsonify({"error": "No score data available for this batch"}), 404

                # Unpack all fields including JSON fields
                (admin_score, failing_admins, site_firmware_score, site_firmware_failing, 
                 password_policy_score, password_policy_recs, ap_firmware_score, ap_firmware_recs, 
                 wlan_score, wlan_recs, site_count) = score_result

        # FIXED: Parse JSON strings back to objects
        try:
            failing_admins = json.loads(failing_admins) if failing_admins else {}
            site_firmware_failing = json.loads(site_firmware_failing) if site_firmware_failing else {}
            password_policy_recs = json.loads(password_policy_recs) if password_policy_recs else {}
            ap_firmware_recs = json.loads(ap_firmware_recs) if ap_firmware_recs else {}
            wlan_recs = json.loads(wlan_recs) if wlan_recs else {}
        except json.JSONDecodeError as e:
            logger.error(f"Error parsing JSON data: {e}")
            # Use empty objects if JSON parsing fails
            failing_admins = {}
            site_firmware_failing = {}
            password_policy_recs = {}
            ap_firmware_recs = {}
            wlan_recs = {}

        json_data = {
            "admin_score": admin_score,
            "failing_admins": failing_admins,
            "site_firmware_score": site_firmware_score,
            "site_firmware_failing": site_firmware_failing,
            "password_policy_score": password_policy_score,
            "password_policy_recs": password_policy_recs,
            "ap_version_score": ap_firmware_score,
            "ap_firmware_recs": ap_firmware_recs,
            "wlan_score": wlan_score,
            "wlan_recs": wlan_recs,
            "batch_id": latest_batch_id,
            "site_count": site_count
        }

        logger.info(f"Pie chart data retrieved from database for org_id: {org_id}, batch_id: {latest_batch_id}")
        return jsonify(json_data)
    
    except Exception as e:
        logger.error(f"Error in pie-chart endpoint: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/histogram', methods=['GET'])
def get_histogram():
    try:
        org_id = request.args.get('org_id')
        if not org_id or not validate_org_id(org_id):
            return jsonify({"error": "Invalid organization ID"}), 400
            
        # TODO: Implement actual histogram data retrieval
        sample_data = {
            "labels": ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
            "datasets": [{
                "label": "Security Incidents",
                "data": [12, 19, 3, 5, 2, 3],
                "backgroundColor": "#FF6384"
            }]
        }
        
        logger.info(f"Histogram data requested for org: {org_id}")
        return jsonify({"data": sample_data, "status": "success"})
    except Exception as e:
        logger.error(f"Error in histogram endpoint: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/switch-list', methods=['GET'])
def get_switch_list():
    try:
        org_id = request.args.get('org_id')
        if not org_id or not validate_org_id(org_id):
            return jsonify({"error": "Invalid organization ID"}), 400
            
        # TODO: Implement actual switch data retrieval from Mist API
        sample_data = {
            "switches": [
                {"id": "sw001", "name": "Main Switch", "status": "online", "security_score": 85},
                {"id": "sw002", "name": "Branch Switch", "status": "online", "security_score": 72},
                {"id": "sw003", "name": "Guest Switch", "status": "offline", "security_score": 0}
            ],
            "total": 3
        }
        
        logger.info(f"Switch list requested for org: {org_id}")
        return jsonify({"data": sample_data, "status": "success"})
    except Exception as e:
        logger.error(f"Error in switch-list endpoint: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/ap-list', methods=['GET'])
def get_ap_list():
    try:
        org_id = request.args.get('org_id')
        if not org_id or not validate_org_id(org_id):
            return jsonify({"error": "Invalid organization ID"}), 400
            
        # TODO: Implement actual AP data retrieval from Mist API
        sample_data = {
            "access_points": [
                {"id": "ap001", "name": "Lobby AP", "status": "online", "security_score": 90},
                {"id": "ap002", "name": "Conference Room AP", "status": "online", "security_score": 88},
                {"id": "ap003", "name": "Warehouse AP", "status": "warning", "security_score": 65}
            ],
            "total": 3
        }
        
        logger.info(f"AP list requested for org: {org_id}")
        return jsonify({"data": sample_data, "status": "success"})
    except Exception as e:
        logger.error(f"Error in ap-list endpoint: {e}")
        return jsonify({"error": "Internal server error"}), 500

# This route is only activated if the user clicks on settings. Ideally it would only be activated once. It validates whether or not an org_id string exists in the database already.
# If the org_id exists then no need for a new API key, else we need an API key to work
@app.route('/api/check-existing-data', methods=['GET'])
def check_existing_data():
    org_id = request.args.get('org_id')
    
    if not org_id:
        return jsonify({"error": "Missing org_id parameter"}), 400
    
    if not validate_org_id(org_id):
        return jsonify({"error": "Invalid organization ID format"}), 400

    org_id = org_id.strip()

    try:
        with get_db_connection() as db_connector:
            with db_connector.cursor() as cursor:
                sql = "SELECT COUNT(*) FROM customer_data WHERE org_id = %s"
                cursor.execute(sql, (org_id,))
                (count,) = cursor.fetchone()
                
                logger.info(f"Data check for org_id: {org_id}, found: {count}")
                return jsonify({"exists": count > 0})
                
    except Exception as e:
        logger.error(f"Error checking existing data: {e}")
        return jsonify({"error": "Database error"}), 500

@app.route('/api/settings', methods=['GET'])
def get_settings():
    try:
        return jsonify({"message": "Settings retrieved successfully", "status": "success"})
    except Exception as e:
        logger.error(f"Error in settings endpoint: {e}")
        return jsonify({"error": "Internal server error"}), 500
        
@app.route('/api/data', methods=['POST'])
def insert_customer_data():
    db_connector = None
    cursor = None
    site_ids = []
    
    try:
        # Parse request data
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400

        # Get required fields
        org_id = data.get('org_id', '').strip()
        api_key = data.get('api_key', '').strip()
        api_url = data.get('api_url', '').strip()

        if not org_id or not api_url or not api_key:
            return jsonify({"error": "Missing required fields"}), 400
        
        logger.info(f"Attempting to authenticate API for org_id: {org_id} with URL: {api_url}")

        # Start database transaction
        db_connector = get_db_connection()
        db_connector.autocommit = False
        cursor = db_connector.cursor()
        
        try:
            # Check for existing data first
            cursor.execute("SELECT COUNT(*) FROM customer_data WHERE org_id = %s", (org_id,))
            (count,) = cursor.fetchone()
            if count > 0:
                logger.warning(f"Duplicate API key attempt for org_id: {org_id}")
                return jsonify({"error": "API key already exists for this organization"}), 409

            headers = {'Content-Type': 'application/json'}
            auth_url = f"https://{api_url}/api/v1/orgs/{org_id}/sites"
            
            headers['Authorization'] = f'Token {api_key}'
            response = requests.get(auth_url, headers=headers, timeout=10)
            
            
            # Log the response for debugging
            logger.info(f"API response: {response.status_code} for URL: {auth_url}")
            
            if response.status_code != 200:
                error_details = ""
                try:
                    error_data = response.json()
                    error_details = f" - {error_data.get('detail', '')}"
                except:
                    error_details = f" - {response.text[:200]}"
                
                logger.error(f"API authentication failed: {response.status_code}{error_details}")
                return jsonify({
                    "error": f"Failed to authenticate API key (Status: {response.status_code})",
                    "details": error_details.strip(" - ")
                }), 401

            # Parse site data
            sites_data = response.json()
            logger.info(f"Retrieved {len(sites_data)} sites from API")
            
            for site in sites_data:
                site_id = site.get('id')
                if site_id and isinstance(site_id, str) and len(site_id) > 10:
                    site_ids.append(site_id)
                    logger.info(f"Valid site_id added: {site_id}")
                else:
                    logger.warning(f"Invalid site_id skipped: {site_id}")

            if not site_ids:
                logger.error("No valid site IDs found")
                return jsonify({"error": "No valid sites found for this organization"}), 404

            # Insert customer data
            encrypted_api_key = encrypt_api_key(api_key)
            cursor.execute(
                "INSERT INTO customer_data (org_id, api_url, api_key) VALUES (%s, %s, %s)",
                (org_id, api_url, encrypted_api_key)
            )
            logger.info("Customer data inserted successfully")

            # Get scores with error handling
            admin_score, failing_admins = check_admin(site_ids, org_id, api_url, api_key)
            site_firmware_score, site_firmware_failing = check_firmware(site_ids, org_id, api_url, api_key)
            password_policy_score, password_policy_recs = check_password_policy(site_ids, org_id, api_url, api_key)
            ap_version_score, ap_firmware_recs, ap_list = get_ap_firmware_versions(site_ids,org_id,api_url, api_key)
            wlan_score, wlan_frame, wlan_recs = get_wlans(site_ids,org_id,api_url, api_key)

            # Generate batch ID
            batch_id = datetime.now().strftime('%Y%m%d%H%M%S')

            # Insert site data
            sites_inserted = 0
            for site_id in site_ids:
                try:
                    cursor.execute(
                        """
                        INSERT INTO customer_sites (org_id, site_id, admin_score, failing_admins, site_firmware_score, site_firmware_failing, password_policy_score, password_policy_recs, ap_firmware_score, ap_firmware_recs, wlan_score, wlan_recs, batch_id)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        (org_id, site_id, admin_score, json.dumps(failing_admins), site_firmware_score, json.dumps(site_firmware_failing), password_policy_score, json.dumps(password_policy_recs), ap_version_score, json.dumps(ap_firmware_recs), wlan_score, json.dumps(wlan_recs), batch_id) 
                    )
                    print(org_id, site_id, admin_score, json.dumps(failing_admins), site_firmware_score, json.dumps(site_firmware_failing), password_policy_score, json.dumps(password_policy_recs), ap_version_score, json.dumps(ap_firmware_recs), wlan_score, json.dumps(wlan_recs), batch_id)
                    sites_inserted += 1
                except Exception as site_error:
                    logger.error(f"Error inserting site {site_id}: {site_error}")
                    raise

            # Commit transaction
            db_connector.commit()
            logger.info(f"Successfully inserted {sites_inserted} sites for org_id: {org_id}")

            return jsonify({
                "success": True, 
                "message": "Data inserted successfully",
                "sites_added": sites_inserted,
                "batch_id": batch_id
            })
            
        except Exception as tx_error:
            # Rollback transaction on error
            db_connector.rollback()
            logger.error(f"Transaction error: {tx_error}")
            raise tx_error

    except requests.exceptions.RequestException as e:
        logger.error(f"Network error during API request: {e}")
        return jsonify({"error": f"Network error: {str(e)}"}), 500
    finally:
        if cursor:
            cursor.close()
        if db_connector:
            db_connector.close()

@app.route('/api/fetch-new-data', methods=['POST'])
def fetch_new_data():
    db_connector = None
    cursor = None
    
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400
            
        org_id = data.get('org_id', '').strip()
        
        if not org_id:
            return jsonify({"error": "Missing org_id parameter"}), 400
            
        logger.info(f"Fetch new data request for org_id: {org_id}")

        # Get existing API credentials from database
        db_connector = get_db_connection()
        cursor = db_connector.cursor()
        
        cursor.execute("SELECT api_key, api_url FROM customer_data WHERE org_id = %s", (org_id,))
        result = cursor.fetchone()
        
        if not result:
            return jsonify({"error": "No existing API key found. Please configure API settings first."}), 404

        encrypted_api_key, api_url = result
        api_key = decrypt_api_key(encrypted_api_key)

        # Get existing site IDs
        cursor.execute("SELECT DISTINCT site_id FROM customer_sites WHERE org_id = %s", (org_id,))
        site_ids = [row[0] for row in cursor.fetchall()]

        if not site_ids:
            return jsonify({"error": "No sites found for this organization"}), 404

        # Run fresh security tests
        admin_score, failing_admins = check_admin(site_ids, org_id, api_url, api_key)
        site_firmware_score, site_firmware_failing = check_firmware(site_ids, org_id, api_url, api_key)
        password_policy_score, password_policy_recs = check_password_policy(site_ids, org_id, api_url, api_key)
        ap_version_score, ap_firmware_recs, ap_list = get_ap_firmware_versions(site_ids, org_id, api_url, api_key)
        wlan_score, wlan_frame, wlan_recs = get_wlans(site_ids, org_id, api_url, api_key)

        # Generate new batch ID for the refresh
        batch_id = datetime.now().strftime('%Y%m%d%H%M%S')

        # Insert new batch of site data (keeping historical data)
        db_connector.autocommit = False
        sites_updated = 0
        
        try:
            for site_id in site_ids:
                cursor.execute(
                    """
                    INSERT INTO customer_sites (org_id, site_id, admin_score, failing_admins, site_firmware_score, site_firmware_failing, password_policy_score,password_policy_recs, ap_firmware_score, ap_firmware_recs, wlan_score, wlan_recs, batch_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (org_id, site_id, admin_score, json.dumps(failing_admins), site_firmware_score, json.dumps(site_firmware_failing), password_policy_score, json.dumps(password_policy_recs), ap_version_score, ap_firmware_recs, wlan_score, json.dumps(wlan_recs), batch_id)        
                )
                sites_updated += 1

            db_connector.commit()
            logger.info(f"Successfully refreshed data for {sites_updated} sites, batch_id: {batch_id}")
            
            return jsonify({
                "success": True,
                "message": "Fresh data fetched and stored successfully",
                "sites_updated": sites_updated,
                "batch_id": batch_id,
                "org_id": org_id
            })
            
        except Exception as tx_error:
            db_connector.rollback()
            logger.error(f"Transaction error in fetch-new-data: {tx_error}")
            raise tx_error
            
    except mysql.connector.Error as e:
        logger.error(f"Database error in fetch-new-data: {e}")
        return jsonify({"error": f"Database error: {str(e)}"}), 500
    except Exception as e:
        logger.error(f"Error in fetch-new-data: {e}")
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500
    finally:
        if cursor:
            cursor.close()
        if db_connector:
            db_connector.close()

@app.route('/api/purge-api-key', methods=['POST'])
def purge_api_key():
    db_connector = None
    cursor = None
    
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400
            
        org_id = data.get('org_id', '').strip()
        
        if not org_id:
            return jsonify({"error": "Missing org_id parameter"}), 400
            
        if not validate_org_id(org_id):
            return jsonify({"error": "Invalid organization ID format"}), 400

        db_connector = get_db_connection()
        db_connector.autocommit = False
        cursor = db_connector.cursor()
        
        try:
            # Check if record exists
            cursor.execute("SELECT COUNT(*) FROM customer_data WHERE org_id = %s", (org_id,))
            (count,) = cursor.fetchone()
            
            if count == 0:
                return jsonify({"error": "No data found for this organization"}), 404
            
            # Delete from customer_sites first (foreign key constraint)
            cursor.execute("DELETE FROM customer_sites WHERE org_id = %s", (org_id,))
            sites_deleted = cursor.rowcount
            
            # Delete from customer_data
            cursor.execute("DELETE FROM customer_data WHERE org_id = %s", (org_id,))
            data_deleted = cursor.rowcount
            
            # Commit transaction
            db_connector.commit()
            
            logger.info(f"API key purged for org_id: {org_id}, {sites_deleted} sites deleted")
            return jsonify({
                "success": True, 
                "message": "API key purged successfully",
                "sites_deleted": sites_deleted,
                "records_deleted": data_deleted
            })
            
        except Exception as tx_error:
            db_connector.rollback()
            raise tx_error
            
    except mysql.connector.Error as e:
        logger.error(f"Database error in purge-api-key: {e}")
        return jsonify({"error": f"Database error: {str(e)}"}), 500
    except Exception as e:
        logger.error(f"Error in purge-api-key: {e}")
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500
    finally:
        if cursor:
            cursor.close()
        if db_connector:
            db_connector.close()

@app.route('/api/get-site-id', methods = ['GET'])
def get_site_id():
    db_connector = None
    cursor = None
    try: 

        org_id = request.args.get('org_id', '').strip()

        db_connector = get_db_connection()
        cursor = db_connector.cursor()

        sql = 'SELECT site_id FROM customer_sites WHERE org_id = %s'
        cursor.execute(sql, (org_id,))

        results = cursor.fetchall()

        if not results:
            return jsonify({
                "success": True,
                "org_id": org_id,
                "site_ids": [],
                "message": "No sites found for this organization"
            })
        
        # Extract site_ids from results
        site_ids = [row[0] for row in results]

        return jsonify({
            "success": True,
            "org_id": org_id,
            "site_ids": site_ids,
            "count": len(site_ids)
        })

    except mysql.connector.Error as e:
        logger.error(f"Database error in get-site-id: {e}")
        return jsonify({"error": "Database error"}), 500
    except Exception as e:
        logger.error(f"Error in get-site-id: {e}")
        return jsonify({"error": "Internal server error"}), 500
    finally:
        if db_connector:
            if 'cursor' in locals():
                cursor.close()
            db_connector.close()
    
@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {error}")
    return jsonify({"error": "Internal server error"}), 500

@app.errorhandler(BadRequest)
def bad_request(error):
    return jsonify({"error": "Bad request"}), 400

if __name__ == '__main__':
    debug_mode = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    host = os.getenv('FLASK_HOST', '127.0.0.1')
    port = int(os.getenv('FLASK_PORT', 8510))
    
    app.run(debug=debug_mode, host=host, port=port)