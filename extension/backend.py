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
from tests import check_admin, check_firmware, check_password_policy

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
def validate_org_id(org_id):
    if not org_id or len(org_id.strip()) != 36:
        return False
    # Check UUID format (basic validation)
    import re
    uuid_pattern = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)
    return bool(uuid_pattern.match(org_id.strip()))

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

        db_connection = get_db_connection()
        cursor = db_connection.cursor()
        cursor2 = db_connection.cursor()

        # Retrieve the encrypted API key for the org_id
        cursor.execute("SELECT api_key, api_url FROM customer_data WHERE org_id = %s", (org_id,))
        result = cursor.fetchone()

        cursor2.execute("SELECT site_id FROM customer_sites WHERE org_id = %s", (org_id,))
        site_id_sql= cursor2.fetchall()

        cursor2.close()
        cursor.close()
        db_connection.close()

        if not result:
            return jsonify({"error": "API key not found for this organization"}), 404

        encrypted_api_key = result[0]
        api_url = result[1]

        try:
            api_key = decrypt_api_key(encrypted_api_key)
        except Exception as e:
            logger.error(f"Error decrypting API key: {e}")
            return jsonify({"error": "Failed to decrypt API key"}), 500
        

        site_ids = [row for row in site_id_sql]

        #print(site_ids)
        #print(api_url)

        admin_score, failing_admins = check_admin(site_ids,org_id,api_url, api_key)
        site_firmware_score, site_firmware_failing = check_firmware(site_ids,org_id,api_url, api_key)
        password_policy_score, password_policy_recs = check_password_policy(site_ids,org_id,api_url, api_key)

        #print(admin_score, failing_admins)
        #print(site_firmware_score, site_firmware_failing)
        #print(password_policy_score, password_policy_recs)

        logger.info(f"Pie chart data requested for org: {org_id}")
        #print(api_key)  
        return jsonify({
            "admin_score": admin_score,
            "failing_admins": failing_admins,
            "site_firmware_score": site_firmware_score,
            "site_firmware_failing": site_firmware_failing,
            "password_policy_score": password_policy_score,
            "password_policy_recs": password_policy_recs
        })
    
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
    
    # If no org_id is returned with the API call then this will result in an error being returned. 
    if not org_id:
        return jsonify({"error": "Missing org_id parameter"}), 400
    
    # This function is not currently in use. It should call the validate_org_id function and check that the org_id matches regex
    if not validate_org_id(org_id):
        return jsonify({"error": "Invalid organization ID format"}), 400

    org_id = org_id.strip()

    try:
        db_connector = get_db_connection()
        cursor = db_connector.cursor()
        
        # Build the query string to send to the mariaDB backend, this is checking whether or not more than 1 instance of the org_id is already in the database
        # if the ID already exists then it is assumed that the org will not require another API key, and the API input option will be disabled.
        # Future TODO is to add the option for customers to provide their own database credentials and store everything locally.
        sql = "SELECT COUNT(*) FROM customer_data WHERE org_id = %s"
        cursor.execute(sql, (org_id,))
        (count,) = cursor.fetchone()
        
        # Returns a console log which can then be used for debugging.
        logger.info(f"Data check for org_id: {org_id}, found: {count}")
        # Correct responses here are 0 and 1, anything greater than 1 and something has gone very wrong somewhere.
        return jsonify({"exists": count > 0})
        
    except Exception as e:
        logger.error(f"Error checking existing data: {e}")
        return jsonify({"error": "Database error <- likely the Flask server is not running or the query string is malformed."}), 500
    finally:
        if db_connector:
            if 'cursor' in locals():
                cursor.close()
            db_connector.close()

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
    # Initialise a list to containt the site_ids 
    site_ids = []
    try:
        # intialise the data variable to receive json data from the front end
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400

        #print(data)

        # These are the expected data types being returned from the front end
        org_id = data.get('org_id', '').strip()
        api_key = data.get('api_key', '').strip()
        api_url = data.get('api_url', '').strip()

        # If any of the above are missing then return an error.
        if not org_id or not api_url or not api_key:
            return jsonify({"error": "Missing required fields: org_id or api_key"}), 400
        
        # These checks were returning errors TODO is fix that 
        #if not validate_org_id(org_id):
            #return jsonify({"error": "Invalid organization ID format"}), 400
        #if not validate_api_key(api_key):
        #    return jsonify({"error": "Invalid API key format"}), 400

        #print(api_url)


        headers = {'Content-Type': 'application/json', 'Authorization': f'Token {api_key}'}
        
        #print(f"https://{api_url}/api/v1/orgs/{org_id}/sites", headers)
        
        response = requests.get(f"https://{api_url}/api/v1/orgs/{org_id}/sites", headers=headers)

        # The response containing anything but a 200 is considered a fail
        if response.status_code != 200:
            return jsonify({"error": "Failed to authenticate API key <- This error is as a result of a failed GET"}), 401

        #print(response.json())

        # save the response to a variable for no particular reason
        data = response.json()

        # Iterate over the contents of the data variable. Since it should return a JSON array containing JSON objects we should then get as many outputs as their are sites in the org
        for site in data:
            # Strip out the 'id' field from each object
            site_id = site.get('id')
            if site_id:
                logger.info(f"site_id: {site_id} added")
                # site_ids are then appended to the site_id list for later use
                site_ids.append(site_id)

        encrypted_api_key = encrypt_api_key(api_key)

        db_connector = get_db_connection()
        cursor = db_connector.cursor()

        cursor.execute(
            "INSERT INTO customer_data (org_id, api_url, api_key) VALUES (%s, %s, %s)",
            (org_id, api_url, encrypted_api_key)
        )


        for site_id in site_ids:
            cursor.execute(
                """
                INSERT INTO customer_sites (org_id, site_id, score_1, score_2, score_3, score_4)
                VALUES (%s, %s, 0, 0, 0, 0)
                """,
                (org_id, site_id)
            )

        db_connector.commit()

        logger.info(f"Data inserted successfully for org_id: {org_id}")
        return jsonify({"success": True, "message": "Data inserted successfully"})

    except mysql.connector.Error as e:
        logger.error(f"Database error in /api/data: {e}")
        return jsonify({"error": "Database error"}), 500
    except Exception as e:
        logger.error(f"Error in /api/data: {e}")
        return jsonify({"error": "Internal server error"}), 500
    finally:
        if db_connector:
            if 'cursor' in locals():
                cursor.close()
            db_connector.close()


@app.route('/api/purge-api-key', methods=['POST'])
def purge_api_key():
    db_connector = None
    
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
        cursor = db_connector.cursor()
        
        # Check if record exists before deletion
        check_sql = "SELECT COUNT(*) FROM customer_data WHERE org_id = %s"
        cursor.execute(check_sql, (org_id,))
        (count,) = cursor.fetchone()
        
        if count == 0:
            return jsonify({"error": "No data found for this organization"}), 404
        
        # Delete the record
        sql = "DELETE FROM customer_data WHERE org_id = %s"
        cursor.execute(sql, (org_id,))
        
        logger.info(f"API key purged for org_id: {org_id}")
        return jsonify({"success": True, "message": "API key purged successfully"})
        
    except mysql.connector.Error as e:
        logger.error(f"Database error in purge-api-key: {e}")
        return jsonify({"error": "Database error"}), 500
    except Exception as e:
        logger.error(f"Error in purge-api-key: {e}")
        return jsonify({"error": "Internal server error"}), 500
    finally:
        if db_connector:
            if 'cursor' in locals():
                cursor.close()
            db_connector.close()

@app.route('/api/get-site-id', methods = ['GET'])
def get_site_id():
    db_connector = None
    try: 

        org_id = request.args.get('org_id', '').strip()

        print(org_id)

        db_connector = get_db_connection()
        cursor = db_connector.cursor()

        sql = 'SELECT site_id FROM customer_sites WHERE org_id = %s'
        cursor.execute(sql, (org_id,))

        results = cursor.fetchall()

        print(results)

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
    # Use environment variables for production configuration
    debug_mode = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    host = os.getenv('FLASK_HOST', '127.0.0.1')
    port = int(os.getenv('FLASK_PORT', 8510))
    
    app.run(debug=debug_mode, host=host, port=port)