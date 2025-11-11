#!/usr/bin/env python3
"""
Script to replace the old owner account with a new one
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

def delete_old_owner():
    """Delete the old owner@vireohr.com account"""
    old_email = "owner@vireohr.com"
    try:
        # Get and delete from Firebase Auth
        user = auth.get_user_by_email(old_email)
        uid = user.uid
        
        # Delete from Firestore
        db.collection('users').document(uid).delete()
        print(f"✅ Deleted Firestore document for {old_email}")
        
        # Delete from Auth
        auth.delete_user(uid)
        print(f"✅ Deleted Firebase Auth user for {old_email}")
        
    except auth.UserNotFoundError:
        print(f"ℹ️  User {old_email} not found (already deleted)")
    except Exception as e:
        print(f"⚠️  Error deleting old owner: {e}")

def create_new_owner():
    """Create new owner account with nouralarja.dev@gmail.com"""
    email = "nouralarja.dev@gmail.com"
    password = "256997"
    
    try:
        # Create new user in Firebase Auth
        user = auth.create_user(
            email=email,
            password=password,
            display_name="Noural Arja (Owner)"
        )
        uid = user.uid
        print(f"✅ Created new user {email} in Firebase Auth")
        
        # Create Firestore document with OWNER role
        user_doc = {
            'uid': uid,
            'email': email,
            'name': 'Noural Arja',
            'role': 'OWNER',
            'isActive': True,
            'createdAt': firestore.SERVER_TIMESTAMP,
            'updatedAt': firestore.SERVER_TIMESTAMP
        }
        
        db.collection('users').document(uid).set(user_doc)
        print(f"✅ Created Firestore user document with OWNER role")
        
        print("\n" + "="*60)
        print("🎉 NEW OWNER ACCOUNT CREATED!")
        print("="*60)
        print(f"Email: {email}")
        print(f"Password: {password}")
        print(f"Role: OWNER")
        print(f"UID: {uid}")
        print("="*60)
        print("\n📱 You can now login with your email!")
        
        return uid
        
    except Exception as e:
        print(f"❌ Error creating new owner: {e}")
        return None

if __name__ == "__main__":
    print("\n🔄 REPLACING OWNER ACCOUNT...")
    print("="*60)
    
    # Step 1: Delete old owner
    print("\n1️⃣  Deleting old owner@vireohr.com...")
    delete_old_owner()
    
    # Step 2: Create new owner
    print("\n2️⃣  Creating new owner nouralarja.dev@gmail.com...")
    new_uid = create_new_owner()
    
    if new_uid:
        print("\n✅ SUCCESS! Owner account replacement complete.")
        print("\n📋 REMAINING TEST ACCOUNTS:")
        print("   • co@gosta.com / vireohr123 (CO)")
        print("   • manager@gosta.com / vireohr123 (Manager)")
        print("   • supervisor@gosta.com / vireohr123 (Supervisor)")
        print("   • employee@gosta.com / vireohr123 (Employee)")
    else:
        print("\n❌ Failed to create new owner account.")
