#!/usr/bin/env python3
"""
Database cleanup script - Removes all testing data except owner account
Keeps only: owner@vireohr.com
"""
import firebase_admin
from firebase_admin import credentials, auth, firestore
from pathlib import Path
import sys

# Initialize Firebase Admin
ROOT_DIR = Path(__file__).parent
cred = credentials.Certificate(ROOT_DIR / 'backend' / 'firebase-service-account.json')

# Check if already initialized
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)

db = firestore.client()

OWNER_EMAIL = "owner@vireohr.com"

def cleanup_database():
    """Remove all data except the owner account"""
    
    print("🧹 Starting database cleanup...")
    print("="*60)
    
    # Step 1: Get owner UID
    try:
        owner_user = auth.get_user_by_email(OWNER_EMAIL)
        owner_uid = owner_user.uid
        print(f"✅ Found owner account: {OWNER_EMAIL} (UID: {owner_uid})")
    except auth.UserNotFoundError:
        print(f"❌ Owner account {OWNER_EMAIL} not found!")
        print("Creating owner account first...")
        owner_user = auth.create_user(
            email=OWNER_EMAIL,
            password="vireohr123",
            display_name="Owner Account"
        )
        owner_uid = owner_user.uid
        
        # Create Firestore document
        db.collection('users').document(owner_uid).set({
            'uid': owner_uid,
            'email': OWNER_EMAIL,
            'name': 'Owner Account',
            'role': 'OWNER',
            'createdAt': firestore.SERVER_TIMESTAMP,
            'updatedAt': firestore.SERVER_TIMESTAMP
        })
        print(f"✅ Created owner account: {OWNER_EMAIL}")
    
    # Step 2: Delete all users except owner from Firestore
    print("\n🗑️  Deleting users from Firestore...")
    users_ref = db.collection('users')
    users = list(users_ref.stream())
    deleted_users = 0
    
    for user in users:
        if user.id != owner_uid:
            user_data = user.to_dict()
            print(f"  - Deleting user: {user_data.get('name', 'Unknown')} ({user_data.get('email', 'N/A')})")
            users_ref.document(user.id).delete()
            deleted_users += 1
    
    print(f"✅ Deleted {deleted_users} users from Firestore")
    
    # Step 3: Delete all users from Firebase Auth except owner
    print("\n🗑️  Deleting users from Firebase Auth...")
    page = auth.list_users()
    deleted_auth = 0
    
    while page:
        for user in page.users:
            if user.uid != owner_uid:
                print(f"  - Deleting auth user: {user.email}")
                try:
                    auth.delete_user(user.uid)
                    deleted_auth += 1
                except Exception as e:
                    print(f"    ⚠️  Failed to delete {user.email}: {e}")
        
        page = page.get_next_page()
    
    print(f"✅ Deleted {deleted_auth} users from Firebase Auth")
    
    # Step 4: Delete all stores
    print("\n🗑️  Deleting stores...")
    stores_ref = db.collection('stores')
    stores = list(stores_ref.stream())
    
    for store in stores:
        store_data = store.to_dict()
        print(f"  - Deleting store: {store_data.get('name', 'Unknown')}")
        stores_ref.document(store.id).delete()
    
    print(f"✅ Deleted {len(stores)} stores")
    
    # Step 5: Delete all shifts
    print("\n🗑️  Deleting shifts...")
    shifts_ref = db.collection('shifts')
    shifts = list(shifts_ref.stream())
    
    for shift in shifts:
        shifts_ref.document(shift.id).delete()
    
    print(f"✅ Deleted {len(shifts)} shifts")
    
    # Step 6: Delete all attendance records
    print("\n🗑️  Deleting attendance records...")
    attendance_ref = db.collection('attendance')
    attendance = list(attendance_ref.stream())
    
    for att in attendance:
        attendance_ref.document(att.id).delete()
    
    print(f"✅ Deleted {len(attendance)} attendance records")
    
    # Step 7: Delete all ingredients
    print("\n🗑️  Deleting ingredients...")
    ingredients_ref = db.collection('ingredients')
    ingredients = list(ingredients_ref.stream())
    
    for ing in ingredients:
        ingredients_ref.document(ing.id).delete()
    
    print(f"✅ Deleted {len(ingredients)} ingredients")
    
    # Step 8: Delete all ingredient counts
    print("\n🗑️  Deleting ingredient counts...")
    counts_ref = db.collection('ingredient_counts')
    counts = list(counts_ref.stream())
    
    for count in counts:
        counts_ref.document(count.id).delete()
    
    print(f"✅ Deleted {len(counts)} ingredient counts")
    
    # Step 9: Delete all leave requests
    print("\n🗑️  Deleting leave requests...")
    leaves_ref = db.collection('leave_requests')
    leaves = list(leaves_ref.stream())
    
    for leave in leaves:
        leaves_ref.document(leave.id).delete()
    
    print(f"✅ Deleted {len(leaves)} leave requests")
    
    # Step 10: Delete all payment history
    print("\n🗑️  Deleting payment history...")
    payments_ref = db.collection('payment_history')
    payments = list(payments_ref.stream())
    
    for payment in payments:
        payments_ref.document(payment.id).delete()
    
    print(f"✅ Deleted {len(payments)} payment records")
    
    # Summary
    print("\n" + "="*60)
    print("🎉 DATABASE CLEANUP COMPLETE!")
    print("="*60)
    print(f"\n✅ Remaining account:")
    print(f"   Email: {OWNER_EMAIL}")
    print(f"   Password: vireohr123")
    print(f"   Role: OWNER")
    print(f"   UID: {owner_uid}")
    print("\n📱 You can now login with this account and start fresh!")
    print("="*60)

if __name__ == "__main__":
    # Confirm before cleanup
    print("⚠️  WARNING: This will DELETE ALL data except owner@vireohr.com!")
    print("="*60)
    confirm = input("Type 'YES' to confirm cleanup: ")
    
    if confirm == 'YES':
        cleanup_database()
    else:
        print("❌ Cleanup cancelled")
        sys.exit(1)
