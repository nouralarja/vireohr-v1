#!/usr/bin/env python3
"""
Script to verify/fix owner account
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

def verify_owner():
    """Verify owner account"""
    email = "nouralarja.dev@gmail.com"
    password = "256997"
    
    try:
        # Check if user exists in Auth
        user = auth.get_user_by_email(email)
        print(f"✅ User found in Firebase Auth")
        print(f"   Email: {user.email}")
        print(f"   UID: {user.uid}")
        
        # Check Firestore document
        user_doc = db.collection('users').document(user.uid).get()
        if user_doc.exists:
            data = user_doc.to_dict()
            print(f"✅ Firestore document found")
            print(f"   Name: {data.get('name')}")
            print(f"   Role: {data.get('role')}")
            print(f"   Active: {data.get('isActive', True)}")
        else:
            print(f"⚠️  Firestore document missing - creating...")
            user_doc_data = {
                'uid': user.uid,
                'email': email,
                'name': 'Noural Arja',
                'role': 'OWNER',
                'isActive': True,
                'createdAt': firestore.SERVER_TIMESTAMP,
                'updatedAt': firestore.SERVER_TIMESTAMP
            }
            db.collection('users').document(user.uid).set(user_doc_data)
            print(f"✅ Firestore document created")
        
        # Reset password to make sure it's correct
        auth.update_user(user.uid, password=password)
        print(f"✅ Password reset to: {password}")
        
        print("\n" + "="*60)
        print("✅ OWNER ACCOUNT VERIFIED!")
        print("="*60)
        print(f"Email: {email}")
        print(f"Password: {password}")
        print(f"UID: {user.uid}")
        print("="*60)
        
    except auth.UserNotFoundError:
        print(f"❌ User {email} not found in Firebase Auth")
        print("Creating new account...")
        
        user = auth.create_user(
            email=email,
            password=password,
            display_name="Noural Arja (Owner)"
        )
        
        user_doc = {
            'uid': user.uid,
            'email': email,
            'name': 'Noural Arja',
            'role': 'OWNER',
            'isActive': True,
            'createdAt': firestore.SERVER_TIMESTAMP,
            'updatedAt': firestore.SERVER_TIMESTAMP
        }
        
        db.collection('users').document(user.uid).set(user_doc)
        print(f"✅ New owner account created!")
        print(f"Email: {email}")
        print(f"Password: {password}")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    verify_owner()
