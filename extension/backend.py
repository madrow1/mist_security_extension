from flask import Flask, request, jsonify
from flask_cors import CORS, cross_origin
import json 
import requests
import os
#from tests import get_api, get_site_api, get_sites_data, read_json_file, json_to_bullet_points
from werkzeug.exceptions import BadRequest
import mysql.connector 

app = Flask(__name__)
cors = CORS(app)

try:
    with open('env.json') as f:
        sqlcred = json.load(f)
        print(sqlcred)
except Exception as e:
    print("Error loading .env.json:", e)
    exit(1)

def get_db_connection():
    return mysql.connector.connect(
        host=sqlcred['host'],
        user=sqlcred['user'],
        password=sqlcred['password'],
        database=sqlcred['database']
    )

@app.route('/api/pie-chart', methods=['GET', 'POST'])
def get_pie_chart():
    try:
        return jsonify({"message": "Pie chart endpoint", "status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/histogram', methods=['GET', 'POST'])
def get_histogram():
    try:
        return jsonify({"message": "Histogram endpoint", "status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/switch-list', methods=['GET', 'POST'])
def get_switch_list():
    try:
        return jsonify({"message": "Switch list endpoint", "status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/ap-list', methods=['GET', 'POST'])
def get_ap_list():
    try:
        return jsonify({"message": "AP list endpoint", "status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/check-existing-data', methods=['GET'])
def check_existing_data():
    org_id = request.args.get('org_id')
    if not org_id:
        return jsonify({"error": "Missing org_id"}), 400

    try:
        db_connector = mysql.connector.connect(
            host=sqlcred['host'],
            user=sqlcred['user'],
            password=sqlcred['password'],
            database=sqlcred['database']
        )
        sqlcursor = db_connector.cursor()
        sql = "SELECT COUNT(*) FROM customer_data WHERE org_id = %s"
        sqlcursor.execute(sql, (org_id,))
        (count,) = sqlcursor.fetchone()
        sqlcursor.close()
        db_connector.close()
        return jsonify({"exists": count > 0})
    except Exception as e:
        return jsonify({"error": str(e)}), 500



@app.route('/api/settings', methods=['GET', 'POST'])
def get_settings():
    if request.method == 'POST':
        try:
            data = request.get_json()
            if not data or 'api_key' not in data:
                return jsonify({"Error": "API Key not in request"}), 400 

            with open('api.json', 'w') as f:
                json.dump({"api_key": data['api_key']}, f)

            return jsonify({"Success" : "Key save succesfully"})

        except Exception as e:
            return jsonify({"Error" : str(e)}),500
            
    if request.method == 'GET':
        try: 
            return jsonify({"message": "Settings endpoint", "status": "success"})
        except Exception as e:
            return jsonify({"error": str(e)}), 500
        
@app.route('/api/data', methods=['POST'])
def insert_customer_data():
    try:
        data = request.get_json()
        print("Received data:", data)
        org_id = data.get('org_id')
        site_id = data.get('site_id')
        api_key = data.get('api_key')

        # Validate input
        if not org_id or not site_id or not api_key:
            return jsonify({"error": "Missing org_id, site_id, or api_key"}), 400

        db_connector = get_db_connection()

        print(db_connector)

        sqlcursor = db_connector.cursor()

        sql = "INSERT INTO customer_data (org_id, site_id, api_key) VALUES (%s, %s, %s)"
        val = (org_id, site_id, api_key)
        
        sqlcursor.execute(sql, val)
        db_connector.commit()

        sqlcursor.close()
        db_connector.close()

        return jsonify({"success": True, "message": "Data inserted successfully"})  

    except Exception as e:
        print("Error in /api/data:", e)
        return jsonify({"Error": str(e)}), 500

@app.route('/api/purge-api-key', methods=['POST'])
def purge_api_key():
    try:
        data = request.get_json()
        org_id = data.get('org_id')
        if not org_id:
            return jsonify({"error": "Missing org_id"}), 400

        db_connector = get_db_connection()

        sqlcursor = db_connector.cursor()
        sql = "DELETE FROM customer_data WHERE org_id = %s"
        sqlcursor.execute(sql, (org_id,))
        db_connector.commit()
        sqlcursor.close()
        db_connector.close()
        return jsonify({"success": True, "message": "API key purged"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    if not os.path.exists('api.json'):
        print("Warning: API JSON File not found")
    
    app.run(debug=True, host='0.0.0.0', port=8510)