from flask import Flask, request, jsonify
from flask_cors import CORS, cross_origin
import json 
import requests
import os
#from tests import get_api, get_site_api, get_sites_data, read_json_file, json_to_bullet_points
from werkzeug.exceptions import BadRequest

app = Flask(__name__)
cors = CORS(app)

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