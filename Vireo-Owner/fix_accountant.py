#!/usr/bin/env python3
"""
Script to list all Firebase users and fix accountant
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

def fix_accountant():
    """Fix accountant account"""
    email = "accountant@gosta.com"
    password = "gosta123"
    
    try:
        # Try to get the user
        user = auth.get_user_by_email(email)
        print(f"✅ Found user: {email}")
        print(f"   UID: {user.uid}")
        print(f"   Disabled: {user.disabled}")
        
        # Update password and enable account
        auth.update_user(
            user.uid,
            password=password,
            disabled=False
        )
        print(f"✅ Password updated to: {password}")
        print(f"✅ Account enabled")
        
        # Check Firestore
        user_doc = db.collection('users').document(user.uid).get()
        if user_doc.exists:
            data = user_doc.to_dict()
            print(f"✅ Firestore document exists")
            print(f"   Role: {data.get('role')}")
            print(f"   Active: {data.get('isActive')}")
        else:
            print(f"⚠️  Creating Firestore document...")
            db.collection('users').document(user.uid).set({
                'uid': user.uid,
                'email': email,
                'name': 'Test Accountant',
                'role': 'ACCOUNTANT',
                'isActive': True,
                'createdAt': firestore.SERVER_TIMESTAMP,
                'updatedAt': firestore.SERVER_TIMESTAMP
            })
            print(f"✅ Firestore document created")
        
    except auth.UserNotFoundError:
        print(f"❌ User not found, creating new...")
        user = auth.create_user(
            email=email,
            password=password,
            display_name="Test Accountant",
            disabled=False
        )
        print(f"✅ Created new user")
        print(f"   UID: {user.uid}")
        
        db.collection('users').document(user.uid).set({
            'uid': user.uid,
            'email': email,
            'name': 'Test Accountant',
            'role': 'ACCOUNTANT',
            'isActive': True,
            'createdAt': firestore.SERVER_TIMESTAMP,
            'updatedAt': firestore.SERVER_TIMESTAMP
        })
        print(f"✅ Firestore document created")
    
    print("\n" + "="*60)
    print("✅ ACCOUNTANT ACCOUNT READY!")
    print("="*60)
    print(f"Email: {email}")
    print(f"Password: {password}")
    print("="*60)
    print("\n⚠️  IMPORTANT: After login, if it still fails:")
    print("   1. Clear browser cache/cookies")
    print("   2. Try incognito/private mode")
    print("   3. Refresh the page completely (Ctrl+Shift+R)")

def list_all_users():
    """List all users"""
    print("\n" + "="*60)
    print("ALL FIREBASE USERS:")
    print("="*60)
    
    page = auth.list_users()
    for user in page.users:
        # Get Firestore data
        user_doc = db.collection('users').document(user.uid).get()
        role = "N/A"
        if user_doc.exists:
            role = user_doc.to_dict().get('role', 'N/A')
        
        print(f"\nEmail: {user.email}")
        print(f"UID: {user.uid}")
        print(f"Role: {role}")
        print(f"Disabled: {user.disabled}")

if __name__ == "__main__":
    list_all_users()
    print("\n")
    fix_accountant()
