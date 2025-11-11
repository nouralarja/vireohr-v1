#!/usr/bin/env python3
"""
Script to create all test users with proper roles
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

def create_user(email, password, name, role):
    try:
        # Try to get existing user
        try:
            user = auth.get_user_by_email(email)
            print(f"✅ User {email} already exists")
            uid = user.uid
        except auth.UserNotFoundError:
            # Create new user
            user = auth.create_user(
                email=email,
                password=password,
                display_name=name
            )
            uid = user.uid
            print(f"✅ Created new user {email}")
        
        # Create/Update Firestore document
        user_doc = {
            'uid': uid,
            'email': email,
            'name': name,
            'role': role,
            'createdAt': firestore.SERVER_TIMESTAMP,
            'updatedAt': firestore.SERVER_TIMESTAMP
        }
        
        db.collection('users').document(uid).set(user_doc, merge=True)
        print(f"   → Set role to {role}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error creating {email}: {e}")
        return False

def main():
    print("\n" + "="*60)
    print("Creating Test Users for Gosta App")
    print("="*60 + "\n")
    
    users = [
        ("owner@vireohr.com", "vireohr123", "Owner Account", "OWNER"),
        ("co@gosta.com", "vireohr123", "Chief Officer", "CO"),
        ("manager@gosta.com", "vireohr123", "Manager Account", "MANAGER"),
        ("supervisor@gosta.com", "vireohr123", "Supervisor Account", "SHIFT_SUPERVISOR"),
        ("employee@gosta.com", "vireohr123", "Employee Account", "EMPLOYEE"),
    ]
    
    for email, password, name, role in users:
        create_user(email, password, name, role)
    
    print("\n" + "="*60)
    print("🎉 All Test Accounts Ready!")
    print("="*60)
    print("\nLogin Credentials (all use password: vireohr123):")
    print("-" * 60)
    for email, _, name, role in users:
        print(f"• {email:25} → {role}")
    print("="*60)
    print("\n📱 You can now login with any of these accounts!")

if __name__ == "__main__":
    main()
