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

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Establish Flask application and configure CORS
app = Flask(__name__)

# Configure CORS for specific origins (update with your actual frontend origins)
CORS(app, origins=["chrome-extension://*", "moz-extension://*"])

# Load configuration from environment file
try:
    with open('env.json') as f:
        config = json.load(f)
        
    # Validate required configuration keys
    required_keys = ['host', 'user', 'password', 'database']
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

def get_db_connection():
    return connection_pool.get_connection()

def encrypt_api_key(api_key):
    return cipher_suite.encrypt(api_key.encode()).decode()

def decrypt_api_key(encrypted_key):
    return cipher_suite.decrypt(encrypted_key.encode()).decode()

def validate_org_id(org_id):
    if not org_id or len(org_id.strip()) != 36:
        return False
    # Check UUID format (basic validation)
    import re
    uuid_pattern = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)
    return bool(uuid_pattern.match(org_id.strip()))

def validate_api_key(api_key):
    if not api_key or len(api_key.strip()) < 10:
        return False
    return True

@app.route('/api/pie-chart', methods=['GET'])
def get_pie_chart():
    try:
        org_id = request.args.get('org_id')
        if not org_id or not validate_org_id(org_id):
            return jsonify({"error": "Invalid organization ID"}), 400

        db_connection = get_db_connection()

        sample_data = {
            "labels": ["Secure Devices", "Vulnerable Devices", "Unknown Status"],
            "values": [65, 25, 10],
            "colors": ["#4CAF50", "#FF5722", "#FF9800"]
        }
        
        logger.info(f"Pie chart data requested for org: {org_id}")
        return jsonify({"data": sample_data, "status": "success"})
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

@app.route('/api/check-existing-data', methods=['GET'])
def check_existing_data():
    org_id = request.args.get('org_id')
    
    if not org_id:
        return jsonify({"error": "Missing org_id parameter"}), 400
    
    if not validate_org_id(org_id):
        return jsonify({"error": "Invalid organization ID format"}), 400

    org_id = org_id.strip()

    try:
        db_connector = get_db_connection()
        cursor = db_connector.cursor()
        
        sql = "SELECT COUNT(*) FROM customer_data WHERE org_id = %s"
        cursor.execute(sql, (org_id,))
        (count,) = cursor.fetchone()
        
        logger.info(f"Data check for org_id: {org_id}, found: {count}")
        return jsonify({"exists": count > 0})
        
    except Exception as e:
        logger.error(f"Error checking existing data: {e}")
        return jsonify({"error": "Database error"}), 500
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
    
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400
            
        org_id = data.get('org_id', '').strip()
        site_id = data.get('site_id', '').strip()
        api_key = data.get('api_key', '').strip()

        # Validate input
        if not org_id or not site_id or not api_key:
            return jsonify({"error": "Missing required fields: org_id, site_id, or api_key"}), 400
            
        if not validate_org_id(org_id):
            return jsonify({"error": "Invalid organization ID format"}), 400
            
        if not validate_api_key(api_key):
            return jsonify({"error": "Invalid API key format"}), 400

        # Encrypt the API key
        encrypted_api_key = encrypt_api_key(api_key)
        
        db_connector = get_db_connection()
        cursor = db_connector.cursor()

        # Check if org_id already exists
        check_sql = "SELECT COUNT(*) FROM customer_data WHERE org_id = %s"
        cursor.execute(check_sql, (org_id,))
        (existing_count,) = cursor.fetchone()
        
        if existing_count > 0:
            return jsonify({"error": "Organization ID already exists"}), 409

        # Insert new record
        sql = "INSERT INTO customer_data (org_id, site_id, api_key) VALUES (%s, %s, %s)"
        cursor.execute(sql, (org_id, site_id, encrypted_api_key))
        
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