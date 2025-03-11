from pymongo import MongoClient
from config import MONGO_URI, DB_NAME

def test_connection():
    try:
        # Connect with MongoDB Atlas
        client = MongoClient(MONGO_URI)
        db = client[DB_NAME]
        print("MongoDB Atlas connected successfully!")
        
        # Verify connection with ping
        db.command('ping')
        print("Database ping successful!")
        
        # Test insert
        result = db.test.insert_one({"test": "atlas_connection"})
        print("Test document inserted:", result.inserted_id)
        
        # Cleanup
        db.test.delete_one({"test": "atlas_connection"})
        print("Test document cleaned up")
        
    except Exception as e:
        print("Error connecting to MongoDB Atlas:", e)

if __name__ == "__main__":
    test_connection()