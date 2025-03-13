from flask import Flask, request, jsonify
from flask_cors import CORS
from urllib.parse import unquote
from pymongo import MongoClient
from config import MONGO_URI, DB_NAME
from datetime import datetime
import copy

app = Flask(__name__)
CORS(app, supports_credentials=True, resources={
    r"/api/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"],
        "expose_headers": ["Access-Control-Allow-Origin"],
        "supports_credentials": True
    }
})

# MongoDB setup
client = MongoClient(MONGO_URI)
db = client[DB_NAME]
mappings_collection = db.mappings
inverted_mappings_collection = db.inverted_mappings

# Create indexes
mappings_collection.create_index("url", unique=True)
mappings_collection.create_index("created_at")
inverted_mappings_collection.create_index([("url", 1)], unique=True)

def safe_string_compare(value1, value2):
    if isinstance(value1, datetime):
        value1 = value1.strftime('%Y-%m-%d')
    if isinstance(value2, datetime):
        value2 = value2.strftime('%Y-%m-%d')
    
    if value1 is not None and value2 is not None:
        if value1 == value2:
            return True
        
        else:
            return (str(value1).lower() == str(value2).lower()) 
    return False

def create_inverted_mapping(mapping_doc, profile):
    """Create inverted mapping from normal mapping and profile"""
    inverted = copy.deepcopy(mapping_doc)
    
    for xpath, value in mapping_doc['mapping'].items():
        for profile_key, profile_value in profile.items():
            if isinstance(profile_value, (str, int, float, bool)) and safe_string_compare(profile_value, value):
                inverted['mapping'][xpath] = profile_key
                break
    if 'user_email' in inverted.keys():
        inverted.pop('user_email')
    return inverted

def flatten_profile_completely(profile):
    """Convert nested profile into completely flat structure"""
    flat = {
        # Basic Info
        'email': profile.get('email', ''),
        'firstName': profile.get('firstName', ''),
        'lastName': profile.get('lastName', ''),
        'phone': profile.get('phone', ''),
        'phoneCountry': profile.get('phoneCountry', ''),
        'location': profile.get('location', ''),
        'dob': profile.get('dob', ''),
        'created_at': profile.get('created_at', datetime.utcnow()),
        'updated_at': datetime.utcnow(),

        # Address fields
        'address_street': profile.get('address', {}).get('street', ''),
        'address_city': profile.get('address', {}).get('city', ''),
        'address_state': profile.get('address', {}).get('state', ''),
        'address_zipCode': profile.get('address', {}).get('zipCode', ''),
        'address_country': profile.get('address', {}).get('country', ''),

        # Demographics
        'demographics_disability': profile.get('demographics', {}).get('disability', ''),
        'demographics_gender': profile.get('demographics', {}).get('gender', ''),
        'demographics_lgbtq': profile.get('demographics', {}).get('lgbtq', ''),
        'demographics_veteran': profile.get('demographics', {}).get('veteran', ''),
        
        # Work Auth
        'workAuth_canadaAuth': profile.get('workAuth', {}).get('canadaAuth', ''),
        'workAuth_sponsorship': profile.get('workAuth', {}).get('sponsorship', ''),
        'workAuth_ukAuth': profile.get('workAuth', {}).get('ukAuth', ''),
        'workAuth_usAuth': profile.get('workAuth', {}).get('usAuth', ''),
        
        # Social
        'social_github': profile.get('social', {}).get('github', ''),
        'social_linkedin': profile.get('social', {}).get('linkedin', ''),
        'social_portfolio': profile.get('social', {}).get('portfolio', ''),
        'social_other': profile.get('social', {}).get('other', '')
    }

    # Handle ethnicity array
    ethnicities = profile.get('demographics', {}).get('ethnicity', [])
    for i, eth in enumerate(ethnicities):
        flat[f'demographics_ethnicity_{i}'] = eth

    # Handle skills array
    skills = profile.get('skills', [])
    for i, skill in enumerate(skills):
        flat[f'skill_{i}'] = skill

    # Handle education array
    education = profile.get('education', [])
    for i, edu in enumerate(education):
        flat[f'education_{i}_degreeType'] = edu.get('degreeType', '')
        flat[f'education_{i}_endMonth'] = edu.get('endMonth', '')
        flat[f'education_{i}_endYear'] = edu.get('endYear', '')
        flat[f'education_{i}_gpa'] = edu.get('gpa', '')
        flat[f'education_{i}_major'] = edu.get('major', '')
        flat[f'education_{i}_schoolName'] = edu.get('schoolName', '')
        flat[f'education_{i}_startMonth'] = edu.get('startMonth', '')
        flat[f'education_{i}_startYear'] = edu.get('startYear', '')

    # Handle experience array
    experience = profile.get('experience', [])
    for i, exp in enumerate(experience):
        flat[f'experience_{i}_company'] = exp.get('company', '')
        flat[f'experience_{i}_currentJob'] = exp.get('currentJob', False)
        flat[f'experience_{i}_description'] = exp.get('description', '')
        flat[f'experience_{i}_endMonth'] = exp.get('endMonth', '')
        flat[f'experience_{i}_endYear'] = exp.get('endYear', '')
        flat[f'experience_{i}_location'] = exp.get('location', '')
        flat[f'experience_{i}_startMonth'] = exp.get('startMonth', '')
        flat[f'experience_{i}_startYear'] = exp.get('startYear', '')
        flat[f'experience_{i}_title'] = exp.get('title', '')
        flat[f'experience_{i}_type'] = exp.get('type', '')

    return flat

def reconstruct_profile(flat_profile):
    """Reconstruct nested profile from flat structure"""
    profile = {
        'email': flat_profile.get('email', ''),
        'firstName': flat_profile.get('firstName', ''),
        'lastName': flat_profile.get('lastName', ''),
        'phone': flat_profile.get('phone', ''),
        'phoneCountry': flat_profile.get('phoneCountry', ''),
        'location': flat_profile.get('location', ''),
        'dob': flat_profile.get('dob', ''),
        'created_at': flat_profile.get('created_at', ''),
        'updated_at': flat_profile.get('updated_at', ''),
        'address': {
            'street': flat_profile.get('address_street', ''),
            'city': flat_profile.get('address_city', ''),
            'state': flat_profile.get('address_state', ''),
            'zipCode': flat_profile.get('address_zipCode', ''),
            'country': flat_profile.get('address_country', '')
        },
        'demographics': {
            'disability': flat_profile.get('demographics_disability', ''),
            'gender': flat_profile.get('demographics_gender', ''),
            'lgbtq': flat_profile.get('demographics_lgbtq', ''),
            'veteran': flat_profile.get('demographics_veteran', ''),
            'ethnicity': []
        },
        'workAuth': {
            'canadaAuth': flat_profile.get('workAuth_canadaAuth', ''),
            'sponsorship': flat_profile.get('workAuth_sponsorship', ''),
            'ukAuth': flat_profile.get('workAuth_ukAuth', ''),
            'usAuth': flat_profile.get('workAuth_usAuth', '')
        },
        'social': {
            'github': flat_profile.get('social_github', ''),
            'linkedin': flat_profile.get('social_linkedin', ''),
            'portfolio': flat_profile.get('social_portfolio', ''),
            'other': flat_profile.get('social_other', '')
        },
        'education': [],
        'experience': [],
        'skills': []
    }

    # Reconstruct arrays
    i = 0
    while f'demographics_ethnicity_{i}' in flat_profile:
        profile['demographics']['ethnicity'].append(flat_profile[f'demographics_ethnicity_{i}'])
        i += 1

    i = 0
    while f'skill_{i}' in flat_profile:
        profile['skills'].append(flat_profile[f'skill_{i}'])
        i += 1

    # Reconstruct education
    i = 0
    while f'education_{i}_degreeType' in flat_profile:
        edu = {
            'degreeType': flat_profile[f'education_{i}_degreeType'],
            'endMonth': flat_profile[f'education_{i}_endMonth'],
            'endYear': flat_profile[f'education_{i}_endYear'],
            'gpa': flat_profile[f'education_{i}_gpa'],
            'major': flat_profile[f'education_{i}_major'],
            'schoolName': flat_profile[f'education_{i}_schoolName'],
            'startMonth': flat_profile[f'education_{i}_startMonth'],
            'startYear': flat_profile[f'education_{i}_startYear']
        }
        profile['education'].append(edu)
        i += 1

    # Reconstruct experience
    i = 0
    while f'experience_{i}_company' in flat_profile:
        exp = {
            'company': flat_profile[f'experience_{i}_company'],
            'currentJob': flat_profile[f'experience_{i}_currentJob'],
            'description': flat_profile[f'experience_{i}_description'],
            'endMonth': flat_profile[f'experience_{i}_endMonth'],
            'endYear': flat_profile[f'experience_{i}_endYear'],
            'location': flat_profile[f'experience_{i}_location'],
            'startMonth': flat_profile[f'experience_{i}_startMonth'],
            'startYear': flat_profile[f'experience_{i}_startYear'],
            'title': flat_profile[f'experience_{i}_title'],
            'type': flat_profile[f'experience_{i}_type']
        }
        profile['experience'].append(exp)
        i += 1

    return profile

@app.route('/api/all', methods=['GET'])
def get_all_mappings():
    try:
        mappings = list(mappings_collection.find({}, {'_id': 0}))
        return jsonify({
            'status': 'success',
            'data': mappings
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/mapping', methods=['GET', 'POST', 'DELETE'])
def handle_mapping():
    if request.method == 'POST':
        try:
            data = request.get_json()
            if not data or 'url' not in data or 'mapping' not in data or 'user_email' not in data:
                return jsonify({'error': 'Invalid data'}), 400
            
            url = data['url']
            new_mapping = data['mapping']
            user_email = data['user_email']
            
            # Get existing mapping
            existing_doc = mappings_collection.find_one({
                'url': url,
                'user_email': user_email
            }, {'_id': 0})
            
            if existing_doc:
                merged_mapping = {**existing_doc['mapping'], **new_mapping}
            else:
                merged_mapping = new_mapping
            
            document = {
                'url': url,
                'user_email': user_email,
                'mapping': merged_mapping,
                'updated_at': datetime.utcnow()
            }
            
            if not existing_doc:
                document['created_at'] = datetime.utcnow()
            
            # Upsert the document
            result = mappings_collection.update_one(
                {'url': url, 'user_email': user_email},
                {'$set': document},
                upsert=True
            )
            
            # After storing normal mapping, create and store inverted mapping
            profile = db.profiles.find_one({'email': user_email}, {'_id': 0})
            if profile:
                inverted = create_inverted_mapping(document, profile)
                inverted['updated_at'] = datetime.utcnow()
                
                inverted_mappings_collection.update_one(
                    {'url': url},
                    {'$set': inverted},
                    upsert=True
                )
            
            return jsonify({
                'status': 'success',
                'message': 'Mappings updated',
                'url': url,
                'mapping': merged_mapping,
                'inverted_mapping': inverted['mapping'] if profile else None
            })
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    elif request.method == 'GET':
        try:
            url = request.args.get('url')
            user_email = request.args.get('user_email')
            if not url or not user_email:
                return jsonify({'error': 'URL and user_email parameters are required'}), 400
            
            url_decoded = unquote(url)
            document = mappings_collection.find_one({'url': url_decoded, 'user_email': user_email}, {'_id': 0})
            
            if document:
                return jsonify(document)
            return jsonify({
                'url': url_decoded,
                'mapping': {}
            })
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500
            
    elif request.method == 'DELETE':
        try:
            url = request.args.get('url')
            user_email = request.args.get('user_email')
            if not url or not user_email:
                return jsonify({'error': 'URL and user_email parameters are required'}), 400
                
            url_decoded = unquote(url)
            result = mappings_collection.delete_one({'url': url_decoded, 'user_email': user_email})
            
            if result.deleted_count:
                return jsonify({'status': 'success', 'message': 'Mapping deleted'})
            return jsonify({'error': 'Mapping not found'}), 404
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500

@app.route('/api/stats', methods=['GET'])
def get_stats():
    try:
        total_mappings = mappings_collection.count_documents({})
        latest_mappings = list(mappings_collection.find(
            {}, 
            {'_id': 0, 'url': 1, 'created_at': 1}
        ).sort('created_at', -1).limit(5))
        
        return jsonify({
            'status': 'success',
            'total_mappings': total_mappings,
            'latest_mappings': latest_mappings
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Add new endpoint for user profiles
@app.route('/api/profile', methods=['GET', 'POST'])
def handle_profile():
    if request.method == 'POST':
        try:
            profile = request.get_json()
            if not profile:
                return jsonify({'error': 'Invalid profile data'}), 400

            # Add metadata
            profile['updated_at'] = datetime.utcnow()
            flat_profile = flatten_profile_completely(profile)
            # Upsert profile by email
            result = db.profiles.update_one(
                {'email': flat_profile['email']},
                {'$set': flat_profile},
                upsert=True
            )

            return jsonify({
                'status': 'success',
                'message': 'Profile saved'
            })

        except Exception as e:
            return jsonify({'error': str(e)}), 500

    elif request.method == 'GET':
        try:
            email = request.args.get('email')
            if not email:
                return jsonify({'error': 'Email parameter required'}), 400

            profile = db.profiles.find_one({'email': email}, {'_id': 0})
            if profile:
                return jsonify(profile)
            return jsonify({'error': 'Profile not found'}), 404

        except Exception as e:
            return jsonify({'error': str(e)}), 500

@app.route('/api/profiles', methods=['GET'])
def get_all_profiles():
    try:
        profiles = list(db.profiles.find({}, {'_id': 0}))
        return jsonify({
            'status': 'success',
            'data': profiles
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/profile/<email>', methods=['DELETE'])
def delete_profile(email):
    try:
        result = db.profiles.delete_one({'email': email})
        if result.deleted_count:
            return jsonify({
                'status': 'success',
                'message': 'Profile deleted'
            })
        return jsonify({'error': 'Profile not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/profile/search', methods=['GET'])
def search_profiles():
    try:
        query = request.args.get('q', '')
        if not query:
            return jsonify({'error': 'Search query required'}), 400

        profiles = list(db.profiles.find({
            '$or': [
                {'email': {'$regex': query, '$options': 'i'}},
                {'firstName': {'$regex': query, '$options': 'i'}},
                {'lastName': {'$regex': query, '$options': 'i'}}
            ]
        }, {'_id': 0}))

        return jsonify({
            'status': 'success',
            'data': profiles
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/profiles/stats', methods=['GET'])
def get_profile_stats():
    try:
        total_profiles = db.profiles.count_documents({})
        latest_profiles = list(db.profiles.find(
            {}, 
            {'_id': 0, 'email': 1, 'firstName': 1, 'lastName': 1, 'updated_at': 1}
        ).sort('updated_at', -1).limit(5))

        return jsonify({
            'status': 'success',
            'total_profiles': total_profiles,
            'latest_profiles': latest_profiles
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Add user authentication endpoint
@app.route('/api/auth/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        if not data or 'email' not in data:
            return jsonify({'error': 'Email is required'}), 400
        
        email = data['email']
        
        # Find or create user profile
        profile = db.profiles.find_one({'email': email}, {'_id': 0})
        
        if not profile:
            profile = {
                'email': email,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }
            db.profiles.insert_one(profile)
        
        return jsonify({
            'status': 'success',
            'profile': profile
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/inverted-mapping', methods=['POST'])
def create_inverted_mapping_endpoint():
    try:
        data = request.get_json()
        if not data or 'url' not in data:
            return jsonify({'error': 'URL required'}), 400
            
        url = data['url']
        
        # Get normal mapping
        mapping = mappings_collection.find_one({'url': url}, {'_id': 0})
        if not mapping:
            return jsonify({'error': 'Mapping not found'}), 404
            
        # Get profile
        profile = db.profiles.find_one({'email': mapping['user_email']}, {'_id': 0})
        if not profile:
            return jsonify({'error': 'Profile not found'}), 404
            
        # Create inverted mapping
        inverted = create_inverted_mapping(mapping, profile)
        inverted['updated_at'] = datetime.utcnow()
        
        # Store inverted mapping
        result = inverted_mappings_collection.update_one(
            {'url': url},
            {'$set': inverted},
            upsert=True
        )
        
        return jsonify({
            'status': 'success',
            'inverted_mapping': inverted
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/inverted-mapping', methods=['GET'])
def get_inverted_mapping():
    try:
        url = request.args.get('url')
        if not url:
            return jsonify({'error': 'URL parameter required'}), 400
        
        # Decode URL to handle any URL-encoded characters
        url_decoded = unquote(url)
        print(f"Looking for inverted mapping for URL: {url_decoded}")
        
        # Check if inverted mapping exists
        mapping = inverted_mappings_collection.find_one({'url': url_decoded}, {'_id': 0})
        
        if mapping:
            return jsonify(mapping)
        
        # If not found, check with partial URL matching (domain only)
        if '://' in url_decoded:
            domain = url_decoded.split('://', 1)[1].split('/', 1)[0]
            print(f"Trying partial match with domain: {domain}")
            mappings = list(inverted_mappings_collection.find(
                {'url': {'$regex': domain}},
                {'_id': 0}
            ).limit(1))
            
            if mappings:
                print(f"Found mapping with domain match: {mappings[0]['url']}")
                return jsonify(mappings[0])
        
        # No mapping found
        return jsonify({
            'url': url_decoded,
            'inverted_mapping': {},
            'status': 'not_found'
        })
        
    except Exception as e:
        print(f"Error in get_inverted_mapping: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/inverted-mappings/all', methods=['GET'])
def get_all_inverted_mappings():
    try:
        # Get all inverted mappings, excluding _id field
        mappings = list(inverted_mappings_collection.find({}, {'_id': 0}))
        
        return jsonify({
            'status': 'success',
            'count': len(mappings),
            'data': mappings
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001)

# curl http://localhost:5001/api/all
# curl "http://localhost:5001/api/mapping?url=https://careers-navitus.icims.com/jobs/4347/data-scientist-business-insights-intern/candidate?from=login&csrf=7EA16D5EE265DD87&hashed=-625888660"

# # Get all mappings
# curl http://localhost:5001/api/all

# # Get specific mapping
# curl "http://localhost:5001/api/mapping?url=http://example.com"

# # Save mapping
# curl -X POST http://localhost:5001/api/mapping \
#   -H "Content-Type: application/json" \
#   -d '{"url":"http://example.com","mapping":{"field1":"value1"}}'

# # Delete mapping
# curl -X DELETE "http://localhost:5001/api/mapping?url=http://example.com"

# # Get stats
# curl http://localhost:5001/api/stats
# Alternative one-liner to kill process on port 5001
# sudo lsof -t -i:5001 | xargs kill -9

# Get all profiles
# curl http://localhost:5001/api/profiles

# # Get specific profile by email
# curl "http://localhost:5001/api/profile?email=layakishorereddy@gmail.com"

# # Create/Update profile
# curl -X POST http://localhost:5001/api/profile \
#   -H "Content-Type: application/json" \
#   -d '{
#     "firstName": "Layakishore Reddy",
#     "lastName": "Desireddy",
#     "email": "layakishorereddy@gmail.com",
#     "phone": "7325329087",
#     "address": {
#       "street": "73 Marvin ave",
#       "city": "Somerset",
#       "state": "NJ",
#       "zipCode": "08873"
#     },
#     "professional": {
#       "title": "Software Engineer",
#       "summary": "Experienced developer"
#     }
#   }'

# # Search profiles
# curl "http://localhost:5001/api/profile/search?q=layakishore"

# # Delete profile
# curl -X DELETE "http://localhost:5001/api/profile/layakishorereddy@gmail.com"

# # Get profile statistics
# curl http://localhost:5001/api/profiles/stats

##
# Get inverted mapping
# curl "http://localhost:5001/api/inverted-mapping?url=https://example.com"
#curl "http://localhost:5001/api/inverted-mapping?url=https://fa-exhh-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_2002/job/36710/apply/section/1"

# # Create inverted mapping
# curl -X POST http://localhost:5001/api/inverted-mapping \
#   -H "Content-Type: application/json" \
#   -d '{"url":"https://example.com"}'

#curl http://localhost:5001/api/inverted-mappings/all