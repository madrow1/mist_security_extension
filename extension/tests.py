
import requests
import json 

def check_admin(site_ids, org_id, api_url, token):
    score = 0 
    count = 0
    headers = {'Content-Type': 'application/json',
               'Authorization': 'Token {}'.format(token)}
    
    # Note that if no settings have been changed at the org level then Mist does not populate this response.
    response = requests.get("https://{0}/api/v1/orgs/{1}/admins".format(api_url, org_id), headers=headers)
    data = response.json()
    admins = {}
    

    for obj in data:
        count += 1
        admins["admin " + str(count)] = [] 
        for key, value in obj.items():
            match key:
                case "first_name":
                    admins["admin " + str(count)].append("First name" + " : " + f"{value}")
                case "last_name":
                    admins["admin " + str(count)].append("Last name" + " : " + f"{value}")
                case "email":
                    admins["admin " + str(count)].append("Email" + " : " + f"{value}")
                case "two_factor_verified":
                    admins["admin " + str(count)].append("2FA verified" + " : " + f"{str(value)}")
                    score += 1

     
    failing_admins = {}

    for admin in admins:
        if "2FA verified : True" not in admins[admin]:
            score = score - 1
            for item in admins[admin]:
                match item:
                    case _ if 'Email' in item:
                        email = item.split(' : ')[1]
                        failing_admins[str(admin).capitalize()] = f"2FA not enabled for this admin account: {email}"
    
        final_score = (score / count * 100) // 10
            
    return int(final_score), failing_admins


def check_firmware(site_ids, org_id, api_url, token):
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

    # Convert list of 1-tuples to a flat list of site_ids
    slices = [item[0] for item in site_ids]
    print("Site IDs being checked:", slices)

    record = {}

    for site_id in slices:
        try:
            url = f"https://{api_url}/api/v1/sites/{site_id}/setting"
            response = requests.get(url, headers=headers)
            response.raise_for_status()  
            data = response.json()

            # Check if 'auto_upgrade' key exists
            auto_upgrade_enabled = data.get('auto_upgrade', {}).get('enabled', None)

            record[site_id] = auto_upgrade_enabled

            if auto_upgrade_enabled is not True:
                failing_sites["Failing sites, auto-firmware upgrade should be enabled for the below sites"].append(site_id)

        except Exception as e:
            print(f"Error checking site {site_id}: {e}")
            record[site_id] = "Error"

    for entry in record:
        match record[entry]:
            case True:
                score += 1
                count += 1
            case False:
                count += 1
                failing_sites["Failing sites, auto-firmware upgrade should be enabled for the below sites"].append(entry)


    final_score = (score / count * 100) // 10

    #print(int(final_score))
    #print(failing_sites)

    return int(final_score), failing_sites

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

    return score, recomendations, 

site_ids = [('7566ff9b-5964-41cc-b8a1-8470f57e05cb',), ('afe42938-3c63-478b-9875-dcdc6e871d81',), ('e6246119-e5d9-4811-b261-f60329210c39',), ('ea8ac722-374a-4b3e-8eae-ffa75ea8fa0b',)]
org_id = 'c4485ef2-8adf-4ef2-a827-a5b222066271'
api_url = 'api.eu.mist.com'
token = 'VBN4QrUIsOjlhfppfqjdhmzlRsmzjORfcY5S0MI61NQGaQrFpCGRQsXvGe3C273i6ksrPqPEYRWkD2YAybcKTgK1vnm1fLzb'

print(check_password_policy(site_ids,org_id,api_url,token))