from dotenv import load_dotenv
import os
import certifi

load_dotenv()

username = os.getenv('MONGO_USER', 'ld786')
password = os.getenv('MONGO_PASSWORD', 'GBqZGJ1I3Nnfm9ec')
cluster = os.getenv('MONGO_CLUSTER', 'cluster0.8fopi.mongodb.net')

MONGO_URI = f"mongodb+srv://{username}:{password}@{cluster}/?retryWrites=true&w=majority"
DB_NAME = os.getenv('DB_NAME', 'form_mappings')

# MongoDB connection options
MONGO_OPTIONS = {
    "serverSelectionTimeoutMS": 5000,
    "connectTimeoutMS": 10000,
    "tlsCAFile": certifi.where(),
    "ssl": True
}