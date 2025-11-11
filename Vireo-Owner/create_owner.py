#!/usr/bin/env python3
"""
Script to create an Owner user in Firebase
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

def create_owner_user():
    email = "owner@gosta.com"
    password = "gosta123"
    
    try:
        # Try to get existing user
        try:
            user = auth.get_user_by_email(email)
            print(f"✅ User {email} already exists in Firebase Auth")
            uid = user.uid
        except auth.UserNotFoundError:
            # Create new user
            user = auth.create_user(
                email=email,
                password=password,
                display_name="Owner Account"
            )
            uid = user.uid
            print(f"✅ Created new user {email} in Firebase Auth")
        
        # Create/Update Firestore document with OWNER role
        user_doc = {
            'uid': uid,
            'email': email,
            'name': 'Owner Account',
            'role': 'OWNER',
            'createdAt': firestore.SERVER_TIMESTAMP,
            'updatedAt': firestore.SERVER_TIMESTAMP
        }
        
        db.collection('users').document(uid).set(user_doc, merge=True)
        print(f"✅ Created/Updated Firestore user document with OWNER role")
        
        print("\n" + "="*60)
        print("🎉 Owner Account Ready!")
        print("="*60)
        print(f"Email: {email}")
        print(f"Password: {password}")
        print(f"Role: OWNER")
        print(f"UID: {uid}")
        print("="*60)
        print("\n📱 You can now login with these credentials!")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    create_owner_user()
