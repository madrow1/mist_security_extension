import requests
import json 
from datetime import datetime 

def check_admin(site_ids, org_id, api_url, api_key):
    if not site_ids:
        return 0, {}
    
    print(f"Site IDs being checked: {site_ids}")
    print(f"Checking admins for org: {org_id}")
    
    score = 0
    total_admins = 0
    failing_admins = {}

    try:
        headers = {'Content-Type': 'application/json', 'Authorization': f'Token {api_key}'}
        # FIXED: Use org-level admin endpoint, not site-level
        url = f"https://{api_url}/api/v1/orgs/{org_id}/admins"
        
        print(f"Making request to: {url}")
        response = requests.get(url, headers=headers)

        if response.status_code == 200:
            data = response.json()
            print(f"Found {len(data)} admins in organization")
            
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
                
                print(f"Admin: {admin_name}, 2FA: {two_factor_verified}")
                
                if two_factor_verified:
                    score += 1
                else:
                    # Track admins without 2FA
                    failing_admins[admin_name] = f"2FA not enabled for admin account: {email}"
            
            print(f"Total admins: {total_admins}, Admins with 2FA: {score}")
            
        else:
            print(f"Error getting admin data: {response.status_code} {response.reason}")
            print(f"Response: {response.text[:200]}")
            return 0, {"API Error": f"Failed to retrieve admin data: {response.status_code}"}
            
    except Exception as e:
        print(f"Exception checking admins: {e}")
        return 0, {"Exception": f"Error checking admins: {str(e)}"}
    
    # FIXED: Calculate percentage score correctly
    if total_admins > 0:
        final_score = int((score / total_admins) * 100) // 10
    else:
        final_score = 0
        print("No admins found - score is 0")
    
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

    print("Site IDs being checked:", site_ids)

    record = {}

    for site_id in site_ids:
        # Handle tuple format from database
        if isinstance(site_id, tuple):
            site_id = site_id[0]   

        if not isinstance(site_id, str) or len(site_id) < 10:
            print(f"Skipping invalid site_id: {site_id}")
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
            print(f"Error checking site {site_id}: {e}")
            record[site_id] = "Error"
            count += 1

    # Calculate final score safely
    if count > 0:
        final_score = int((score / count * 100) // 10)
    else:
        final_score = 0

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
        print("Org settings may not have been edited at all, the API is not populated before site configuration")
        exit()

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
        score == 0 

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
            print(f"Skipping invalid site_id: {site_id}")
            continue

        try:
            url = f"https://{api_url}/api/v1/sites/{site_id}/stats/devices"
            print(f"Fetching AP data for site: {site_id}")
            
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
            else:
                print(f"Error fetching AP data for site {site_id}: {site_settings.status_code}")
                
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
        if ap_data[0] and ap_data[2]:  # Ensure model and version exist
            model = ap_data[0]
            current_version = ap_data[2]
            
            recommended_version = version_dict.get(model)
            if recommended_version and current_version == recommended_version:
                score += 1
            else:
                recomendation[serial] = f"Firmware out of date, recommended firmware is {recommended_version or 'Unknown'}"
            count += 1

    # FIXED: Remove the // 10 division bug
    if count > 0:
        final_score = int((score / count) * 100) //10
        print(f"AP Firmware score: {final_score}% ({score}/{count} APs up to date)")
    else:
        final_score = 0
        print("No APs found - AP firmware score is 0")

    session.close()

    return final_score, recomendation, access_points

#site_ids = [('7566ff9b-5964-41cc-b8a1-8470f57e05cb',), ('afe42938-3c63-478b-9875-dcdc6e871d81',), ('e6246119-e5d9-4811-b261-f60329210c39',), ('ea8ac722-374a-4b3e-8eae-ffa75ea8fa0b',)]
#api_url = 'api.eu.mist.com'
#org_id = 'c4485ef2-8adf-4ef2-a827-a5b222066271'
#token = 'VBN4QrUIsOjlhfppfqjdhmzlRsmzjORfcY5S0MI61NQGaQrFpCGRQsXvGe3C273i6ksrPqPEYRWkD2YAybcKTgK1vnm1fLzb'

#print(get_ap_firmware_versions(site_ids,org_id,api_url,token))