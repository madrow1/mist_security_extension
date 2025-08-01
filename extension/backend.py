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
from tests import check_admin, check_firmware, check_password_policy, get_ap_firmware_versions, get_wlans, get_switch_firmware_versions, convert_xml_to_json, get_cve_rss
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
    required_keys = ['dbAddress', 'dbUser', 'dbPass', 'dbName']
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

# Initialize encryption key this is stored outside of the application filepath ideally.
def get_or_create_encryption_key():
    key_file = 'encryption.key'
    if os.path.exists(key_file):
        with open(key_file, 'rb') as f:
            return f.read()
        # Generate a key if one does not already exist
    else:
        key = Fernet.generate_key()
        with open(key_file, 'wb') as f:
            f.write(key)
        os.chmod(key_file, 0o600)  # Restrict file permissions
        return key

encryption_key = get_or_create_encryption_key()
cipher_suite = Fernet(encryption_key)

# Database connection pool which can then be called throughout the extensions usage
db_config = {
    'host': config['dbAddress'],
    'user': config['dbUser'],
    'password': config['dbPass'],
    'database': config['dbName'],
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

# Define regex pattern once at module level
UUID_PATTERN = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)

# Uses the UUID variable and RE above to validate the org_id collected from the URL bar
def validate_org_id(org_id):
    if not org_id or len(org_id.strip()) != 36:
        return False
    return bool(UUID_PATTERN.match(org_id.strip()))

# Validates the API key, not currently in use because it was occasionally returning errors, needs further research. 
def validate_api_key(api_key):
    if not api_key or len(api_key.strip()) < 36:
        return False
    return True

# Forms the API route that calls the pie chart data from the backend
@app.route('/api/pie-chart', methods=['GET'])
def get_pie_chart():
    try:
        # Strips the query parameter from the URL sent from the frontend 
        org_id = request.args.get('org_id')
        if not org_id or not validate_org_id(org_id):
            return jsonify({"error": "Invalid organization ID"}), 400

        with get_db_connection() as db_connection:
            with db_connection.cursor() as cursor:
                # Get API credentials cursor is used to iterate over rows in a database
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

                # Get scores from latest batch TODO this has to be edited for each new test added to the extension.
                cursor.execute("""
                    SELECT admin_score, failing_admins, site_firmware_score, site_firmware_failing,
                           password_policy_score, password_policy_recs, ap_firmware_score, ap_firmware_recs,
                           wlan_score, wlan_recs, switch_firmware_score, switch_firmware_recs, COUNT(*) as site_count
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
                 wlan_score, wlan_recs, switch_firmware_score, switch_firmware_recs, site_count) = score_result

        # FIXED: Parse JSON strings back to objects
        try:
            failing_admins = json.loads(failing_admins) if failing_admins else {}
            site_firmware_failing = json.loads(site_firmware_failing) if site_firmware_failing else {}
            password_policy_recs = json.loads(password_policy_recs) if password_policy_recs else {}
            ap_firmware_recs = json.loads(ap_firmware_recs) if ap_firmware_recs else {}
            wlan_recs = json.loads(wlan_recs) if wlan_recs else {}
            switch_firmware_recs = json.loads(switch_firmware_recs) if switch_firmware_recs else {}
        except json.JSONDecodeError as e:
            logger.error(f"Error parsing JSON data: {e}")
            # Use empty objects if JSON parsing fails
            failing_admins = {}
            site_firmware_failing = {}
            password_policy_recs = {}
            ap_firmware_recs = {}
            wlan_recs = {}
            switch_firmware_recs = {}

        json_data = {
            "admin_score": admin_score,
            "failing_admins": failing_admins,
            "site_firmware_score": site_firmware_score,
            "site_firmware_failing": site_firmware_failing,
            "password_policy_score": password_policy_score,
            "password_policy_recs": password_policy_recs,
            "ap_firmware_score": ap_firmware_score,
            "ap_firmware_recs": ap_firmware_recs,
            "wlan_score": wlan_score,
            "wlan_recs": wlan_recs,
            "switch_firmware_score": switch_firmware_score,
            "switch_firmware_recs": switch_firmware_recs,
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

        with get_db_connection() as db_connection:
            with db_connection.cursor() as cursor:
                cursor.execute(f"""
                    SELECT batch_id, admin_score, site_firmware_score, 
                           password_policy_score, ap_firmware_score, wlan_score, switch_firmware_score,
                           COUNT(*) as site_count
                    FROM customer_sites 
                    WHERE org_id = %s 
                    GROUP BY batch_id, admin_score, site_firmware_score, 
                             password_policy_score, ap_firmware_score, wlan_score, switch_firmware_score
                    ORDER BY batch_id ASC LIMIT 10
                """, (org_id,))

                results = cursor.fetchall()

                if not results:
                    return jsonify({"error": "No historical data available for histogram"}), 404

                histogram_data = {
                    "labels": [],
                    "admin_scores": [],
                    "site_firmware_scores": [],
                    "password_policy_scores": [],
                    "ap_firmware_scores": [],
                    "wlan_scores": [],
                    "switch_firmware_scores": [],
                    "batch_ids": []
                }

                for row in results:
                    batch_id, admin_score, site_firmware_score, password_policy_score, ap_firmware_score, wlan_score, switch_firmware_score, site_count = row
                    
                    # Convert batch_id to readable date
                    try:
                        batch_date = datetime.strptime(batch_id, '%Y%m%d%H%M%S')
                        formatted_date = batch_date.strftime('%m/%d %H:%M')
                    except:
                        formatted_date = batch_id
                    
                    histogram_data["labels"].append(formatted_date)
                    histogram_data["admin_scores"].append(admin_score or 0)
                    histogram_data["site_firmware_scores"].append(site_firmware_score or 0)
                    histogram_data["password_policy_scores"].append(password_policy_score or 0)
                    histogram_data["ap_firmware_scores"].append(ap_firmware_score or 0)
                    histogram_data["wlan_scores"].append(wlan_score or 0)
                    histogram_data["switch_firmware_scores"].append(switch_firmware_score or 0)
                    histogram_data["batch_ids"].append(batch_id)

                logger.info(f"Histogram data retrieved for org_id: {org_id}, {len(results)} data points")
                return jsonify(histogram_data)
    
    except Exception as e:
        logger.error(f"Error in histogram endpoint: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/histogram-site-average', methods=['GET'])
def get_histogram_site_average():
    try:
        org_id = request.args.get('org_id')
        if not org_id or not validate_org_id(org_id):
            return jsonify({"error": "Invalid organization ID"}), 400

        with get_db_connection() as db_connection:
            with db_connection.cursor() as cursor:
                cursor.execute("""
                    SELECT 
                        batch_id,
                        site_id,
                        (COALESCE(admin_score, 0) + 
                         COALESCE(site_firmware_score, 0) + 
                         COALESCE(password_policy_score, 0) + 
                         COALESCE(ap_firmware_score, 0) + 
                         COALESCE(switch_firmware_score, 0) + 
                         COALESCE(wlan_score, 0)) / 5 as site_average_score
                    FROM customer_sites 
                    WHERE org_id = %s 
                    ORDER BY batch_id ASC, site_id ASC
                    LIMIT 50
                """, (org_id,))

                results = cursor.fetchall()

                if not results:
                    return jsonify({"error": "No historical data available for histogram"}), 404

                sites_data = {}
                batch_ids = set()
                
                for row in results:
                    batch_id, site_id, site_average_score = row
                    batch_ids.add(batch_id)
                    
                    if site_id not in sites_data:
                        sites_data[site_id] = {}
                    
                    sites_data[site_id][batch_id] = round(site_average_score or 0, 1)

                # Convert batch_ids to sorted list with formatted dates
                sorted_batch_ids = sorted(batch_ids)
                labels = []
                
                for batch_id in sorted_batch_ids:
                    try:
                        batch_date = datetime.strptime(batch_id, '%Y%m%d%H%M%S')
                        formatted_date = batch_date.strftime('%m/%d %H:%M')
                    except:
                        formatted_date = batch_id
                    labels.append(formatted_date)

                datasets = []
                colors = [
                    '#2D6A00', '#84B135', '#0095A9', '#FF6B35', '#CCDB2A',
                    '#9B59B6', '#E74C3C', '#F39C12', '#16A085', '#8E44AD',
                    '#3498DB', '#E67E22', '#1ABC9C', '#F1C40F', '#95A5A6'
                ]
                
                for i, (site_id, site_scores) in enumerate(sites_data.items()):
                    # Create array of scores for this site across all batches
                    site_score_array = []
                    for batch_id in sorted_batch_ids:
                        score = site_scores.get(batch_id, 0)  # Default to 0 if no data
                        site_score_array.append(score)
                    
                    # Truncate site_id for display (show first 8 chars)
                    display_name = f"Site {site_id[:8]}..."
                    
                    dataset = {
                        "site_id": site_id,
                        "label": display_name,
                        "data": site_score_array,
                        "color": colors[i % len(colors)]
                    }
                    datasets.append(dataset)

                histogram_site_data = {
                    "labels": labels,
                    "batch_ids": sorted_batch_ids,
                    "datasets": datasets,
                    "site_count": len(sites_data)
                }

                logger.info(f"Per-site histogram data retrieved for org_id: {org_id}, {len(sites_data)} sites, {len(sorted_batch_ids)} time points")
                return jsonify(histogram_site_data)
    
    except Exception as e:
        logger.error(f"Error in histogram-site-average endpoint: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/switch-ap-list', methods=['GET'])
def get_switch_list():
    try:
        # Strips the query parameter from the URL sent from the frontend 
        org_id = request.args.get('org_id')
        if not org_id or not validate_org_id(org_id):
            return jsonify({"error": "Invalid organization ID"}), 400

        with get_db_connection() as db_connection:
            with db_connection.cursor() as cursor:
                # Get API credentials cursor is used to iterate over rows in a database
                cursor.execute("SELECT api_key, api_url FROM customer_data WHERE org_id = %s", (org_id,))
                result = cursor.fetchone()
                
                if not result:
                    return jsonify({"error": "API key not found for this organization"}), 404

            encrypted_api_key, api_url = result
            api_key = decrypt_api_key(encrypted_api_key)

                    # Get existing site IDs
            cursor.execute("SELECT DISTINCT site_id FROM customer_sites WHERE org_id = %s", (org_id,))
            site_ids = [row[0] for row in cursor.fetchall()]

            if not site_ids:
                return jsonify({"error": "No sites found for this organization"}), 404

        ap_firmware_score, ap_firmware_recs, ap_frame = get_ap_firmware_versions(site_ids, org_id, api_url, api_key)
        switch_firmware_score, switch_firmware_recs, switch_firmware_frame = get_switch_firmware_versions(site_ids, org_id, api_url, api_key)


        json_data = {
            "ap_list": ap_frame,
            "switch_list": switch_firmware_frame,
        }

        return jsonify(json_data)
    
    except Exception as e:
        logger.error(f"Error in pie-chart endpoint: {e}")
        return jsonify({"error": "Internal server error"}), 500
    
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

# More secure version that doesn't save passwords to file:
@app.route('/api/dbconfig', methods=['POST'])  
def configure_db():
    db_connector = None
    cursor = None
    test_connection = None
    
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400
            
        # Extract database configuration parameters
        db_user = data.get('dbUser', '').strip()
        db_pass = data.get('dbPass', '').strip()
        db_address = data.get('dbAddress', '').strip()
        db_port = data.get('dbPort', '').strip()
        db_name = data.get('dbName', '').strip()

        # Validate required fields
        if not all([db_user, db_pass, db_address, db_port, db_name]):
            return jsonify({"error": "All database fields are required"}), 400
            
        # Validate port number
        try:
            port_number = int(db_port)
            if port_number < 1 or port_number > 65535:
                return jsonify({"error": "Invalid port number"}), 400
        except ValueError:
            return jsonify({"error": "Port must be a number"}), 400
        
        # Validate database name format
        if not re.match(r'^[a-zA-Z0-9_]+$', db_name):
            return jsonify({"error": "Invalid database name format"}), 400            
        
        logger.info(f"Testing database connection: {db_user}@{db_address}:{port_number}/{db_name}")
        
        test_config = {
            'host': db_address,
            'user': db_user,
            'password': db_pass,
            'database': db_name,
            'port': port_number,
            'autocommit': False
        }
        
        try:
            # Test connection with provided credentials
            test_connection = mysql.connector.connect(**test_config)
            test_cursor = test_connection.cursor()
            
            # Test basic functionality
            test_cursor.execute("SELECT 1")
            test_result = test_cursor.fetchone()
            
            if test_result[0] != 1:
                raise mysql.connector.Error("Connection test failed")
                
            logger.info("Database connection test successful")
            
            test_connection.autocommit = False
            
            # Create customer_data table
            test_cursor.execute("""
                CREATE TABLE IF NOT EXISTS `customer_data` (
                    `org_id` varchar(255) NOT NULL,
                    `api_key` text DEFAULT NULL,
                    `api_url` text DEFAULT NULL,
                    PRIMARY KEY (`org_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """)
            
            test_cursor.execute("""
                CREATE TABLE IF NOT EXISTS `customer_sites` (
                    `id` int(11) NOT NULL AUTO_INCREMENT,
                    `org_id` varchar(255) DEFAULT NULL,
                    `site_id` varchar(255) DEFAULT NULL,
                    `admin_score` int(11) DEFAULT 0,
                    `failing_admins` JSON DEFAULT NULL,
                    `site_firmware_score` int(11) DEFAULT 0,
                    `site_firmware_failing` JSON DEFAULT NULL,
                    `password_policy_score` int(11) DEFAULT 0,
                    `password_policy_recs` JSON DEFAULT NULL,
                    `ap_firmware_score` int(11) DEFAULT 0,
                    `ap_firmware_recs` JSON DEFAULT NULL,
                    `wlan_score` int(11) DEFAULT NULL,
                    `wlan_recs` JSON DEFAULT NULL,
                    `switch_firmware_score` int(11) DEFAULT NULL,
                    `switch_firmware_recs` JSON DEFAULT NULL,
                    `average_score` int(11) DEFAULT NULL,
                    `batch_id` varchar(20) DEFAULT NULL,
                    PRIMARY KEY (`id`),
                    KEY `org_id` (`org_id`),
                    KEY `idx_batch_id` (`batch_id`),
                    CONSTRAINT `customer_sites_ibfk_1` FOREIGN KEY (`org_id`) 
                        REFERENCES `customer_data` (`org_id`) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """)
            
            # Commit table creation
            test_connection.commit()
            test_cursor.close()
            test_connection.close()
            
            logger.info("Database tables created/verified successfully")
            
            global connection_pool, db_config
            
            # Update global database configuration
            new_db_config = {
                'host': db_address,
                'user': db_user,
                'password': db_pass,
                'database': db_name,
                'port': port_number,
                'pool_name': 'mist_pool',
                'pool_size': 16,
                'pool_reset_session': True,
                'autocommit': True
            }
            
            # Create new connection pool with new config
            try:
                new_connection_pool = pooling.MySQLConnectionPool(**new_db_config)
                
                # Test the new pool
                test_conn = new_connection_pool.get_connection()
                test_conn.close()
                
                # Replace global pool
                connection_pool = new_connection_pool
                db_config = new_db_config
                
                logger.info("Database configuration updated successfully")
                
            except Exception as pool_error:
                logger.error(f"Failed to create new connection pool: {pool_error}")
                raise pool_error
        
            return jsonify({
                "success": True,
                "message": "Database connected and configured successfully",
                "config": {
                    'host': db_address,
                    'user': db_user,
                    'database': db_name,
                    'port': port_number
                },
                "tables_created": ["customer_data", "customer_sites"]
            })
            
        except mysql.connector.Error as db_error:
            logger.error(f"Database connection failed: {db_error}")
            error_msg = str(db_error)
            
            # Provide more specific error messages
            if "Access denied" in error_msg:
                return jsonify({"error": "Access denied. Check username and password."}), 401
            elif "Unknown database" in error_msg:
                return jsonify({"error": f"Database '{db_name}' does not exist."}), 404
            elif "Can't connect to MySQL server" in error_msg:
                return jsonify({"error": f"Cannot connect to MySQL server at {db_address}:{port_number}"}), 503
            else:
                return jsonify({"error": f"Database connection failed: {error_msg}"}), 400
                
    except Exception as e:
        logger.error(f"Error in dbconfig endpoint: {e}")
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500
    finally:
        # Cleanup test connection if it exists
        if test_connection and test_connection.is_connected():
            test_connection.close()

@app.route('/api/settings', methods=['GET'])
def get_settings():
    try:
        result = convert_xml_to_json(get_cve_rss)
        return result
    except Exception as e:
        logger.error(f"Error in settings endpoint: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/check-cve-feed', methods=['GET'])
def get_settings():
    try:
        return jsonify({"message": "Settings retrieved successfully", "status": "success"})
    except Exception as e:
        logger.error(f"Error in settings endpoint: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/reset-db-con', methods=['POST'])
def reset_database_connection():
    try:
        backup_file = 'env.copy.json'
        original_file = 'env.json'
        
        # Check if backup file exists
        if not os.path.exists(backup_file):
            return jsonify({"error": f"Backup file '{backup_file}' not found"}), 404
        
        # Load and validate backup configuration
        with open(backup_file, 'r') as f:
            backup_config = json.load(f)
        
        # Simple validation
        required_keys = ['dbAddress', 'dbUser', 'dbPass', 'dbName']
        if not all(key in backup_config for key in required_keys):
            return jsonify({"error": "Invalid backup configuration"}), 400
        
        # Overwrite current configuration
        with open(original_file, 'w') as f:
            json.dump(backup_config, f, indent=4)
        
        logger.info(f"Database configuration reset from {backup_file}")
        
        return jsonify({
            "success": True,
            "message": "Database configuration reset successfully",
            "note": "Application restart required for changes to take effect"
        })
        
    except Exception as e:
        logger.error(f"Error resetting database configuration: {e}")
        return jsonify({"error": str(e)}), 500
    
# /api/data is called every time the extension wants to input new data to the database. All other functions should read from the database
# this limits the total number API calls made to Mist and speeds up application response time significantly 
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

            # Establishes headers and auth for accessing the API
            headers = {'Content-Type': 'application/json'}
            auth_url = f"https://{api_url}/api/v1/orgs/{org_id}/sites"
            
            headers['Authorization'] = f'Token {api_key}'

            # Actually sends the request and assigns it to the variable response
            response = requests.get(auth_url, headers=headers, timeout=10)
            
            
            # Log the response for debugging
            logger.info(f"API response: {response.status_code} for URL: {auth_url}")
            
            # Checks the response code, various outputs depending on whether the response is succesful 
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
            
            # Loops over the sites collected by the API, the max number of sites should always be the max number that are defined in the org
            for site in sites_data:
                # Since sites_data is a json object we can strip out the "id" parameter to return just the site_id string 
                site_id = site.get('id')
                # validates that at minimum the site ID is a string and is greater than 10 chars long
                if site_id and isinstance(site_id, str) and len(site_id) > 10:
                    site_ids.append(site_id)
                    logger.info(f"Valid site_id added: {site_id}")
                else:
                    # Else the data collected cannot be a site ID
                    logger.warning(f"Invalid site_id skipped: {site_id}")

            if not site_ids:
                logger.error("No valid site IDs found")
                return jsonify({"error": "No valid sites found for this organization"}), 404

            # Insert customer data
            encrypted_api_key = encrypt_api_key(api_key)
            # Us the data collected to create the first table in our database "customer_data", this contains just the org, site and API key.
            # The org_id can then be used as a foreign key for all other tables in the database
            cursor.execute(
                "INSERT INTO customer_data (org_id, api_url, api_key) VALUES (%s, %s, %s)",
                (org_id, api_url, encrypted_api_key)
            )
            logger.info("Customer data inserted successfully")

            # Get scores with error handling, scores use API calls so this is a fairly heavy process.
            admin_score, failing_admins = check_admin(site_ids, org_id, api_url, api_key)
            site_firmware_score, site_firmware_failing = check_firmware(site_ids, org_id, api_url, api_key)
            password_policy_score, password_policy_recs = check_password_policy(site_ids, org_id, api_url, api_key)
            ap_firmware_score, ap_firmware_recs, ap_list = get_ap_firmware_versions(site_ids,org_id,api_url, api_key)
            wlan_score, wlan_frame, wlan_recs = get_wlans(site_ids,org_id,api_url, api_key)
            switch_firmware_score, switch_firmware_recs, switch_firmware_frame = get_switch_firmware_versions(site_ids, org_id, api_url, api_key)

            # Generate batch ID batch ID is based on the time of creation, so each ID is unique and increments for every time data is requested.
            # This gives us something to ensure that the same data is not shown twice
            batch_id = datetime.now().strftime('%Y%m%d%H%M%S')

            average_score = (admin_score+site_firmware_score+password_policy_score+ap_firmware_score+wlan_score+switch_firmware_score)/6

            # Insert site data
            sites_inserted = 0
            for site_id in site_ids:
                try:
                    # This query has to be updated for each new test added, it adds all site scores and recs to the customer_sites table
                    cursor.execute(
                        """
                        INSERT INTO customer_sites (org_id, site_id, admin_score, failing_admins, site_firmware_score, site_firmware_failing, password_policy_score, password_policy_recs, ap_firmware_score, ap_firmware_recs, wlan_score, wlan_recs, switch_firmware_score, switch_firmware_recs, average_score, batch_id)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        (org_id, site_id, admin_score, json.dumps(failing_admins), site_firmware_score, json.dumps(site_firmware_failing), password_policy_score, json.dumps(password_policy_recs), ap_firmware_score, json.dumps(ap_firmware_recs), wlan_score, json.dumps(wlan_recs), switch_firmware_score, json.dumps(switch_firmware_recs), average_score, batch_id) 
                    )
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

# fetch-new-data is called when the re-check button is clicked, it performs largely the same role as /api/data
@app.route('/api/fetch-new-data', methods=['POST'])
def fetch_new_data():
    db_connector = None
    cursor = None
    
    try:
        # FIXED: Get org_id from query parameters (as sent by frontend)
        org_id = request.args.get('org_id', '').strip()
        
        if not org_id:
            # Fallback to JSON body if not in query params
            data = request.get_json()
            if data:
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
        ap_firmware_score, ap_firmware_recs, ap_list = get_ap_firmware_versions(site_ids, org_id, api_url, api_key)
        wlan_score, wlan_frame, wlan_recs = get_wlans(site_ids, org_id, api_url, api_key)
        switch_firmware_score, switch_firmware_recs, switch_firmware_frame = get_switch_firmware_versions(site_ids, org_id, api_url, api_key)

        # Generate new batch ID for the refresh
        batch_id = datetime.now().strftime('%Y%m%d%H%M%S')

        # Insert new batch of site data (keeping historical data)
        db_connector.autocommit = False
        sites_updated = 0
        
        average_score = (admin_score+site_firmware_score+password_policy_score+ap_firmware_score+wlan_score+switch_firmware_score)/6

        try:
            for site_id in site_ids:
                cursor.execute(
                    """
                    INSERT INTO customer_sites (org_id, site_id, admin_score, failing_admins, 
                                               site_firmware_score, site_firmware_failing, 
                                               password_policy_score, password_policy_recs, 
                                               ap_firmware_score, ap_firmware_recs, 
                                               wlan_score, wlan_recs, switch_firmware_score, switch_firmware_recs, average_score, batch_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (org_id, site_id, admin_score, json.dumps(failing_admins), 
                     site_firmware_score, json.dumps(site_firmware_failing), 
                     password_policy_score, json.dumps(password_policy_recs), 
                     ap_firmware_score, json.dumps(ap_firmware_recs), 
                     wlan_score, json.dumps(wlan_recs), switch_firmware_score, json.dumps(switch_firmware_recs), average_score, batch_id)
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
        
        if not org_id:
            return jsonify({"error": "Missing org_id parameter"}), 400
            
        if not validate_org_id(org_id):
            return jsonify({"error": "Invalid organization ID format"}), 400

        db_connector = get_db_connection()
        cursor = db_connector.cursor()

        # The query is limited to only 1 site here to ensure that only the last recorded site is collected.
        # This deals with an issue where the settings page would show every site, and some tests would run 1x for every batch_id
        cursor.execute(
            'SELECT batch_id FROM customer_sites WHERE org_id = %s ORDER BY batch_id DESC LIMIT 1', 
            (org_id,)
        )
        batch_result = cursor.fetchone()  
        
        latest_batch_id = batch_result[0]  
        
        # Uses the batch ID to identify only the most recent sites.
        cursor.execute(
            'SELECT site_id FROM customer_sites WHERE org_id = %s AND batch_id = %s',
            (org_id, latest_batch_id)  
        )

        results = cursor.fetchall()

        if not results:
            return jsonify({
                "success": True,
                "org_id": org_id,
                "site_ids": [],
                "batch_id": latest_batch_id,
                "message": "No sites found for this batch"
            })
        
        # Extract site_ids from results
        site_ids = [row[0] for row in results]

        return jsonify({
            "success": True,
            "org_id": org_id,
            "site_ids": site_ids,
            "batch_id": latest_batch_id,
            "count": len(site_ids)
        })

    except mysql.connector.Error as e:
        logger.error(f"Database error in get-site-id: {e}")
        return jsonify({"error": "Database error"}), 500
    except Exception as e:
        logger.error(f"Error in get-site-id: {e}")
        return jsonify({"error": "Internal server error"}), 500
    finally:
        if cursor:
            cursor.close()
        if db_connector:
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