import requests
import json 
from datetime import datetime 
import pandas as pd 
import xml.etree.ElementTree as ET

# Simplified the scoring system by putting it all in one location and calling it from the end function, reduces the risk of spelling mistakes 
def calculate_score_points(success_count, total_count):
    if total_count == 0:
        return 0
    percentage = (success_count / total_count) * 100
    return min(10, max(0, int(percentage / 10)))  # Convert to 0-10 scale

def check_admin(site_ids, org_id, api_url, api_key):
    if not site_ids:
        return 0, {}
    
    score = 0
    total_admins = 0
    failing_admins = {}

    try:
        headers = {'Content-Type': 'application/json', 'Authorization': f'Token {api_key}'}
        # FIXED: Use org-level admin endpoint, not site-level
        url = f"https://{api_url}/api/v1/orgs/{org_id}/admins"
        
        response = requests.get(url, headers=headers)

        if response.status_code == 200:
            data = response.json()            
            # Process each admin in the response
            for admin_obj in data:
                total_admins += 1
                
                # Extract admin details
                first_name = admin_obj.get('first_name', 'Unknown')
                last_name = admin_obj.get('last_name', 'Unknown')
                email = admin_obj.get('email', 'Unknown')
                two_factor_verified = admin_obj.get('two_factor_verified', False)
                
                admin_name = f"{first_name} {last_name}".strip()
                if admin_name == "Unknown Unknown":
                    admin_name = email
                            
                if two_factor_verified:
                    score += 1
                else:
                    # Track admins without 2FA
                    failing_admins[admin_name] = f"2FA not enabled for admin account: {email}"
                        
        else:
            return 0, {"API Error": f"Failed to retrieve admin data: {response.status_code}"}
            
    except Exception as e:
        return 0, {"Exception": f"Error checking admins: {str(e)}"}
    
    # FIXED: Calculate percentage score correctly
    final_score = calculate_score_points(score, total_admins)
    
    return final_score, failing_admins


def check_firmware(site_ids, org_id, api_url, token):
    if not site_ids:
        return 0, {}
        
    score = 0
    count = 0
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Token {token}'
    }

    site_status = {}
    failing_sites = {
        "Failing sites, auto-firmware upgrade should be enabled for the below sites": []
    }
    record = {}

    for site_id in site_ids:
        # Handle tuple format from database
        if isinstance(site_id, tuple):
            site_id = site_id[0]   

        if not isinstance(site_id, str) or len(site_id) < 10:
            continue
            
        try:
            url = f"https://{api_url}/api/v1/sites/{site_id}/setting"
            response = requests.get(url, headers=headers)
            response.raise_for_status()  
            data = response.json()

            # Check if 'auto_upgrade' key exists
            auto_upgrade_enabled = data.get('auto_upgrade', {}).get('enabled', None)
            record[site_id] = auto_upgrade_enabled

            if auto_upgrade_enabled is True:
                score += 1
                count += 1
            elif auto_upgrade_enabled is False:
                count += 1
                failing_sites["Failing sites, auto-firmware upgrade should be enabled for the below sites"].append(site_id)
            else:
                count += 1  # Count sites even if setting is undefined

        except Exception as e:
            record[site_id] = "Error"
            count += 1

    # Calculate final score safely
    final_score = calculate_score_points(score, count)

    return final_score, failing_sites

def check_password_policy(site_ids, org_id, api_url, token):
    score = 0 
    recomendations = {"Password Policy Recommendation": "", "Minimum Length Recommendation": "", "Special Char Recommendation": "", "2FA Recommendation": ""}

    headers = {'Content-Type': 'application/json',
               'Authorization': 'Token {}'.format(token)}
    
    # Note that if no settings have been changed at the org level then Mist does not populate this response.
    response = requests.get("https://{0}/api/v1/orgs/{1}/setting".format(api_url, org_id), headers=headers)

    data = response.json()    # Note that if no settings have been changed at the org level then Mist does not populate this response.

    if 'password_policy' not in data: 
        recomendations.update({"Password Policy Recommendation": "Org settings may not have been edited at all, the API is not populated before site configuration"})
        return int(score), recomendations

    match data['password_policy']['enabled']:
        case True:
            score += 2
            recomendations.update({"Password Policy Recommendation": "No recommendation, policy set"})
        case False:
            recomendations.update({"Password Policy Recommendation": "Enable password policies"})
            next

    if data['password_policy']['enabled'] == True:
        match data['password_policy']['min_length']:
            case x if x <= 8:
                recomendations.update({"Minimum Length Recommendation": "Increase length to greater than 8 characters"})
                next
            case x if x > 8 and x <= 12:
                recomendations.update({"Minimum Length Recommendation": "Consider increasing length to greater than 12 characters"})
                score += 2
            case x if x > 12:
                recomendations.update({"Minimum Length Recommendation": "No recommendation"})
                score += 4

        match data['password_policy']['requires_special_char']:
            case True:
                score += 2 
                recomendations.update({"Special Char Recommendation": "No recommendation, policy set"})
            case False:
                recomendations.update({"Special Char Recommendation": "Enable special characters"})
                next

        match data['password_policy']['requires_two_factor_auth']:
            case True:
                score += 2
                recomendations.update({"2FA Recommendation": "No recommendation, Policy set"})
            case False:
                recomendations.update({"2FA Recommendation": "Enable 2FA"})
                next
        
    else:
        recomendations.update({"Password Policy": "Password policy is disabled"})
        score = 0 

    return int(score), recomendations

def get_ap_firmware_versions(site_ids, org_id, api_url, token):
    if not site_ids:
        return 0, {}, {}
        
    score = 0
    count = 0
    access_points = {}
    recomendation = {}

    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Token {token}'
    }

    session = requests.Session()
    session.headers.update(headers)

    # FIXED: Handle both string and tuple formats
    for site_id in site_ids:
        # Handle tuple format from database
        if isinstance(site_id, tuple):
            site_id = site_id[0]
        
        # Validate site_id
        if not isinstance(site_id, str) or len(site_id) < 10:
            continue

        try:
            url = f"https://{api_url}/api/v1/sites/{site_id}/stats/devices"
            
            site_settings = session.get(url, headers=headers, timeout=10)
            
            if site_settings.status_code == 200:
                data = site_settings.json()
                
                for access_point in data:
                    if access_point.get('type') == 'ap':  # Only process APs
                        serial = access_point.get('serial')
                        if serial:
                            access_points[serial] = [
                                access_point.get('model'), 
                                access_point.get('name'), 
                                access_point.get('version'), 
                                access_point.get('site_id')
                            ]
                
        except Exception as e:
            print(f"Exception fetching AP data for site {site_id}: {e}")

    version_dict = {
        "AP45": "0.12.27139",
        "AP34": "0.12.27139",
        "AP24": "0.14.29633",
        "AP64": "0.14.29633",
        "AP43": "0.10.24626",
        "AP63": "0.12.27139",
        "AP43-FIPS": "0.10.24626",
        "AP12": "0.12.27139",
        "AP32": "0.12.27139",
        "AP33": "0.12.27139",
        "AP41": "0.12.27452",
        "AP61": "0.12.27139",
        "AP21": "0.8.21804",
        "BT11": "0.8.21804"
    }

    for serial, ap_data in access_points.items():
        if ap_data[0] and ap_data[2]:  
            model = ap_data[0]
            current_version = ap_data[2]
            
            recommended_version = version_dict.get(model)
            if recommended_version and current_version == recommended_version:
                recomendation[serial] = "Firmware is up to date"
                score += 1
            else:
                recomendation[serial] = f"Firmware out of date, recommended firmware is {recommended_version or 'Unknown'}"
            count += 1

    final_score = calculate_score_points(score, count)
    if count > 0:
        print(f"AP Firmware score: {final_score} ({score}/{count} APs up to date)")
    else:
        final_score = 0

    session.close()

    return final_score, recomendation, access_points

def create_api_session(api_key):
    session = requests.Session()
    session.headers.update({
        'Content-Type': 'application/json',
        'Authorization': f'Token {api_key}'
    })
    session.timeout = 10
    return session

def get_wlans(site_ids, org_id, api_url, token):
    headers = {'Content-Type': 'application/json',
               'Authorization': 'Token {}'.format(token)}
    
    try:
        # FIXED: Get WLANs from the correct endpoint
        response = requests.get("https://{0}/api/v1/orgs/{1}/wlans".format(api_url, org_id), headers=headers)
        
        if response.status_code != 200:
            return 0, pd.DataFrame(), {"API Error": f"Failed to get WLAN data: {response.status_code}"}
        
        data = response.json()
        
        # Validate that data is a list
        if not isinstance(data, list):
            return 0, pd.DataFrame(), {"Data Error": "WLAN data is not in expected format"}
        
        # Process data more efficiently
        wlan_data = []
        recommendations = {}
        score = 0
        count = 0
        
        for element in data:  # Now 'data' is properly a list of WLANs
            if not isinstance(element, dict):
                continue
                
            # Extract all values once
            ssid = element.get('ssid', 'Unknown')
            enabled = element.get('enabled', False)
            auth_settings = element.get('auth', {})
            auth_type = auth_settings.get('type', '')
            
            # Add recommendations when required per WLAN
            if auth_type == 'open':
                recommendations[ssid] = {"Auth Type Open": "Use an encrypted authentication method to improve security"}
                
            enable_mac_auth = auth_settings.get('enable_mac_auth', False)
            private_wlan = auth_settings.get('private_wlan', False)
            radsec_enabled = element.get('radsec', {}).get('enabled', False)
            mist_nac_enabled = element.get('mist_nac', {}).get('enabled', False)
            
            if not mist_nac_enabled:
                if ssid not in recommendations:
                    recommendations[ssid] = {}
                recommendations[ssid]["Mist NAC"] = "Enable NAC for more effective security."
                
            isolation_settings = element.get('isolation', False)
            if not isolation_settings:
                if ssid not in recommendations:
                    recommendations[ssid] = {}
                recommendations[ssid]["Isolation Settings"] = "Enable isolation to prevent clients connected to the same AP from communicating"
                
            l2_isolation_settings = element.get('l2_isolation', False)
            if not l2_isolation_settings:
                if ssid not in recommendations:
                    recommendations[ssid] = {}
                recommendations[ssid]["Enable L2 isolation"] = "Enable L2 isolation to prevent clients in the same subnet from communicating"

            # Only calculate score for enabled WLANs
            if enabled:
                security_checks = [
                    auth_type in ['eap', 'psk', 'eap192', 'psk-tkip', 'psk-wpa2-tkip', 'wep'],                                      
                    mist_nac_enabled,
                    isolation_settings,
                    l2_isolation_settings
                ]
                
                count += len(security_checks)
                score += sum(security_checks)
            
            # WLAN data forms the dataframe
            wlan_data.append({
                'SSID': ssid,
                'Enabled': enabled,
                'Auth Type': auth_type,
                'MAC Auth Enabled': enable_mac_auth,
                'Private WLAN': private_wlan,
                'RADSec Enabled': radsec_enabled,
                'Mist NAC Enabled': mist_nac_enabled,
                'Client Isolation': isolation_settings,
                'L2 Client Isolation': l2_isolation_settings
            })

        # Create DataFrame directly from list of dictionaries
        if wlan_data:
            ssid_inv = pd.DataFrame(wlan_data).set_index('SSID')
        else:
            ssid_inv = pd.DataFrame()
            
        final_score = calculate_score_points(score, count)
        
        return int(final_score), ssid_inv, recommendations
        
    except Exception as e:
        return 0, pd.DataFrame(), {"Exception": f"Error getting WLAN data: {str(e)}"}
    
def get_switch_firmware_versions(site_ids, org_id, api_url, token):
    score = 0
    count = 0
    switches = {}
    recomendation = {}

    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Token {token}'
    }
    params = {'type': 'switch'}
    dev_data = {}

    # FIXED: Handle both string and tuple formats
    for site_id in site_ids:
        # Handle tuple format from database
        if isinstance(site_id, tuple):
            site_id = site_id[0]
        
        # Validate site_id
        if not isinstance(site_id, str) or len(site_id) < 10:
            continue

        try:
            url = f"https://{api_url}/api/v1/sites/{site_id}/stats/devices"
            
            site_settings = requests.get(url, headers=headers, params=params, timeout=10)
            
            if site_settings.status_code == 200:
                data = site_settings.json()
                
                for switch in data:
                    if switch.get('type') == 'switch':  # Only process APs
                        serial = switch.get('serial')
                        if serial:
                            switches[serial] = [
                                switch.get('model'), 
                                switch.get('name'), 
                                switch.get('version'), 
                                switch.get('site_id')
                            ]
                
        except Exception as e:
            print(f"Exception fetching AP data for site {site_id}: {e}")

        #data = site_settings.json()
        #device_data = devices.json()

        #for switch in data:
        #    for device in device_data:
        #        switches[switch['serial']] = [switch['model'], switch['name'], switch['version'], switch['site_id'], device['id']]

        #for device in device_data:
        #    data_types = ['ntp_servers', 'dns_servers', 'dhcp_snooping']
        #    s_device_data = requests.get("{0}{1}/devices/{2}".format(api_response[0], sites[key], device['id']), headers=headers, params=params)
        #    dev_data = s_device_data.json()
            
            #for dev in dev_data:
            #    match dev:
            #        case 'switch_mgmt':
            #           switches[dev_data['serial']].append(dev_data[dev])
            #           recomendation[dev_data['serial']] = ["Password should be left blank"]
            #           count += 1
                    



    platforms = {
        "EX2200": "12.3R12",
        "EX2200-C": "12.3R12",
        "EX2300": "23.4R2",
        "EX2300-C": "23.4R2",
        "EX2300-MP": "23.4R2",
        "EX3200": "12.3R12",
        "EX3300": "12.3R12",
        "EX3400": "23.4R2",
        "EX4100": "23.4R2-S4",
        "EX4100-F": "23.4R2-S4",
        "EX4100-H": "24.4R1",
        "EX4200": "12.3R12 / 15.1R7",
        "EX4300": "21.4R3",
        "EX4300-MP": "23.4R2",
        "EX4400": "23.4R2",
        "EX4400-24X": "23.4R2",
        "EX4500": "12.3R12 / 15.1R7",
        "EX4550": "12.3R12 / 15.1R7",
        "EX4600": "21.4R3",
        "EX4650": "23.4R2",
        "EX6200": "12.3R12 / 15.1R7",
        "EX8200": "12.3R12 / 15.1R7",
        "EX8200-VC (XRE200)": "12.3R12 / 15.1R7",
        "EX9200": "23.4R2",
        "EX9251": "21.4R3",
        "EX9253": "21.4R3"
    }


    for serial, switch_data in switches.items():
        model = switch_data[0]
        current_version = switch_data[2]
        
        # Check if the model exists in version_dict and if the current version matches the recommended one
        recommended_version = platforms.get(model[:8].upper())
        if current_version[:6] == recommended_version:
            score += 1
            count += 1
        else:
            recomendation[serial] = (f"Firmware out of date, recommended firmware is {recommended_version}")
            count += 1



    final_score = calculate_score_points(score,count)

    return int(final_score), recomendation, switches


def application_policies():
    return 0

def auth_policies():
    return 0

def rogue_honeypot_ap_check():
    return 0 

def get_cve_rss():
    session = requests.Session()
    rss_feed = session.get('https://supportportal.juniper.net/knowledgerss?type=Security', verify=False)
    
    with open('cve_xml.xml', 'w') as w_cve:
        w_cve.write(rss_feed.text)
    w_cve.close()

    session.close()

    return session

def convert_xml_to_json(session):
    session = get_cve_rss()

    tree = ET.parse('cve_xml.xml')
    root = tree.getroot()

    session.close()

    print(root)

    #return cve_objects 


#site_ids = [('7566ff9b-5964-41cc-b8a1-8470f57e05cb',), ('afe42938-3c63-478b-9875-dcdc6e871d81',), ('e6246119-e5d9-4811-b261-f60329210c39',), ('ea8ac722-374a-4b3e-8eae-ffa75ea8fa0b',)]
#api_url = 'api.eu.mist.com'
#org_id = 'c4485ef2-8adf-4ef2-a827-a5b222066271'
#token = 'VBN4QrUIsOjlhfppfqjdhmzlRsmzjORfcY5S0MI61NQGaQrFpCGRQsXvGe3C273i6ksrPqPEYRWkD2YAybcKTgK1vnm1fLzb'

#print(get_switch_firmware_versions(site_ids,org_id,api_url,token))

convert_xml_to_json(get_cve_rss)