from flask import Flask, request, jsonify
from flask_cors import CORS
from urllib.parse import unquote
from pymongo import MongoClient
from config import MONGO_URI, DB_NAME
from datetime import datetime

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

# Create indexes
mappings_collection.create_index("url", unique=True)
mappings_collection.create_index("created_at")

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
            
            return jsonify({
                'status': 'success',
                'message': 'Mapping updated',
                'url': url,
                'mapping': merged_mapping
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

            # Upsert profile by email
            result = db.profiles.update_one(
                {'email': profile['email']},
                {'$set': profile},
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