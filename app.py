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
            if not data or 'url' not in data or 'mapping' not in data:
                return jsonify({'error': 'Invalid data'}), 400
            
            url = data['url']
            mapping = data['mapping']
            
            # Add metadata
            document = {
                'url': url,
                'mapping': mapping,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }
            
            # Upsert the document
            result = mappings_collection.update_one(
                {'url': url},
                {'$set': document},
                upsert=True
            )
            
            return jsonify({
                'status': 'success',
                'message': 'Mapping saved',
                'url': url,
                'mapping': mapping
            })
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    elif request.method == 'GET':
        try:
            url = request.args.get('url')
            if not url:
                return jsonify({'error': 'URL parameter is required'}), 400
            
            url_decoded = unquote(url)
            document = mappings_collection.find_one({'url': url_decoded}, {'_id': 0})
            
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
            if not url:
                return jsonify({'error': 'URL parameter is required'}), 400
                
            url_decoded = unquote(url)
            result = mappings_collection.delete_one({'url': url_decoded})
            
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