from pymongo import MongoClient
from config import MONGO_URI, DB_NAME

def test_connection():
    try:
        client = MongoClient(MONGO_URI)
        db = client[DB_NAME]
        print("MongoDB connected successfully!")
        # Test insert
        result = db.test.insert_one({"test": "connection"})
        print("Test document inserted:", result.inserted_id)
        # Cleanup
        db.test.delete_one({"test": "connection"})
    except Exception as e:
        print("Error connecting to MongoDB:", e)

if __name__ == "__main__":
    test_connection()