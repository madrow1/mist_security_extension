
import requests
import json 

def get_api(file):
    f = open(file)
    configs = json.load(f)

    api_url = '{0}orgs/{1}'.format(configs['api']['mist_url'],configs['api']['org_id'])
    headers = {'Content-Type': 'application/json',
               'Authorization': 'Token {}'.format(configs['api']['token'])}
    
    return api_url,headers


def check_admin():
    score = 0 
    count = 0
    api_response = get_api('api.json')
    # Note that if no settings have been changed at the org level then Mist does not populate this response.
    response = requests.get("{}/admins".format(api_response[0]), headers=api_response[1])
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

check_admin()