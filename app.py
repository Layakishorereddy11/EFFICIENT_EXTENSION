from flask import Flask, request, jsonify
from flask_cors import CORS
from urllib.parse import unquote

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

# In‑memory storage for mapping data.
# Key: page URL (as provided by the extension)
# Value: a dictionary of { xpath: captured value }
mapping_data = {}

@app.route('/api/all', methods=['GET'])
def get_all_mappings():
    return jsonify({
        'status': 'success',
        'data': mapping_data
    })
# # Alternative one-liner to kill process on port 5001
# sudo lsof -t -i:5001 | xargs kill -9
@app.route('/api/mapping', methods=['GET', 'POST'])
def handle_mapping():
    if request.method == 'POST':
        data = request.get_json()
        if not data or 'url' not in data or 'mapping' not in data:
            return jsonify({'error': 'Invalid data'}), 400
        
        url = data['url']
        mapping = data['mapping']
        # Save (or update) the mapping for the URL.
        mapping_data[url] = mapping
        return jsonify({
            'status': 'success',
            'message': 'Mapping saved',
            'url': url,
            'mapping': mapping
        })
    
    elif request.method == 'GET':
        url = request.args.get('url')
        if not url:
            return jsonify({'error': 'URL parameter is required'}), 400
        
        # Decode the URL parameter.
        url_decoded = unquote(url)
        mapping = mapping_data.get(url_decoded, {})
        return jsonify({
            'url': url_decoded,
            'mapping': mapping
        })

if __name__ == '__main__':
    app.run(debug=True, port=5001)

# curl http://localhost:5001/api/all
# curl "http://localhost:5001/api/mapping?url=https://careers-navitus.icims.com/jobs/4347/data-scientist-business-insights-intern/candidate?from=login&csrf=7EA16D5EE265DD87&hashed=-625888660"