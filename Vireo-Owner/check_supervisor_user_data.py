#!/usr/bin/env python3
import firebase_admin
from firebase_admin import credentials, firestore, auth

# Initialize Firebase
cred = credentials.Certificate('/app/backend/firebase-service-account.json')
try:
    firebase_admin.get_app()
except ValueError:
    firebase_admin.initialize_app(cred)

db = firestore.client()

print("="*60)
print("CHECKING SUPERVISOR USER DATA")
print("="*60)

# Get supervisor
supervisor_user = auth.get_user_by_email('supervisor@gosta.com')
print(f"\n👤 Supervisor UID: {supervisor_user.uid}")

# Get Firestore user data
user_doc = db.collection('users').document(supervisor_user.uid).get()
if user_doc.exists:
    user_data = user_doc.to_dict()
    print(f"\n📋 Firestore User Data:")
    print(f"   Email: {user_data.get('email')}")
    print(f"   Name: {user_data.get('name')}")
    print(f"   Role: {user_data.get('role')}")
    print(f"   Assigned Store ID: {user_data.get('assignedStoreId')}")
    
    if not user_data.get('assignedStoreId'):
        print(f"\n❌ PROBLEM: No assignedStoreId!")
        print(f"   This is why the ingredients screen shows 'must clock in'")
        
        # Get the store from their shift
        today = '2025-11-01'
        shifts = list(db.collection('shifts')
                     .where('employeeId', '==', supervisor_user.uid)
                     .where('date', '==', today)
                     .stream())
        
        if shifts:
            shift_data = shifts[0].to_dict()
            store_id = shift_data.get('storeId')
            print(f"\n🔧 FIXING: Adding assignedStoreId from shift")
            print(f"   Store ID: {store_id}")
            print(f"   Store Name: {shift_data.get('storeName')}")
            
            # Update user with assignedStoreId
            db.collection('users').document(supervisor_user.uid).update({
                'assignedStoreId': store_id
            })
            print(f"   ✅ Updated user with assignedStoreId")
else:
    print(f"\n❌ User document not found in Firestore!")

print("\n" + "="*60)
print("FIX COMPLETE - RESTART APP TO TEST")
print("="*60)
