#!/usr/bin/env python3
"""
Script to create an accountant test account
"""
import firebase_admin
from firebase_admin import credentials, auth, firestore
from pathlib import Path

# Initialize Firebase Admin
ROOT_DIR = Path(__file__).parent
cred = credentials.Certificate(ROOT_DIR / 'backend' / 'firebase-service-account.json')

# Check if already initialized
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)

db = firestore.client()

def create_accountant_user():
    """Create accountant test account"""
    email = "accountant@gosta.com"
    password = "vireohr123"
    
    try:
        # Check if user already exists
        try:
            existing_user = auth.get_user_by_email(email)
            print(f"ℹ️  User {email} already exists with UID: {existing_user.uid}")
            return existing_user.uid
        except auth.UserNotFoundError:
            pass
        
        # Create new user in Firebase Auth
        user = auth.create_user(
            email=email,
            password=password,
            display_name="Test Accountant"
        )
        uid = user.uid
        print(f"✅ Created new user {email} in Firebase Auth")
        
        # Create Firestore document with ACCOUNTANT role
        user_doc = {
            'uid': uid,
            'email': email,
            'name': 'Test Accountant',
            'role': 'ACCOUNTANT',
            'isActive': True,
            'createdAt': firestore.SERVER_TIMESTAMP,
            'updatedAt': firestore.SERVER_TIMESTAMP
        }
        
        db.collection('users').document(uid).set(user_doc)
        print(f"✅ Created Firestore user document with ACCOUNTANT role")
        
        print("\n" + "="*60)
        print("🎉 ACCOUNTANT ACCOUNT CREATED!")
        print("="*60)
        print(f"Email: {email}")
        print(f"Password: {password}")
        print(f"Role: ACCOUNTANT")
        print(f"UID: {uid}")
        print("="*60)
        print("\n📱 You can now login with this account!")
        
        return uid
        
    except Exception as e:
        print(f"❌ Error creating accountant: {e}")
        return None

if __name__ == "__main__":
    create_accountant_user()
