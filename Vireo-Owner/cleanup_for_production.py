#!/usr/bin/env python3
"""
Production Cleanup Script
Removes all test data and keeps only the production owner account
"""

import firebase_admin
from firebase_admin import credentials, auth as firebase_auth, firestore
from pathlib import Path

# Initialize Firebase
ROOT_DIR = Path(__file__).parent
cred = credentials.Certificate(ROOT_DIR / 'backend' / 'firebase-service-account.json')
try:
    firebase_admin.get_app()
except ValueError:
    firebase_admin.initialize_app(cred)

db = firestore.client()

# Production owner email (the one to KEEP)
PRODUCTION_OWNER_EMAIL = "nouralarja.dev@gmail.com"

def cleanup_test_users():
    """Remove all test users except production owner"""
    print("\n🧹 CLEANING UP TEST USERS")
    print("=" * 70)
    
    # Get all users from Firestore
    users_ref = db.collection('users')
    all_users = list(users_ref.stream())
    
    production_owner_uid = None
    deleted_count = 0
    
    for user_doc in all_users:
        user_data = user_doc.to_dict()
        email = user_data.get('email', '')
        uid = user_data.get('uid', user_doc.id)
        
        if email == PRODUCTION_OWNER_EMAIL:
            production_owner_uid = uid
            print(f"✅ KEEPING: {email} (Production Owner)")
        else:
            # Delete from Firestore
            db.collection('users').document(uid).delete()
            
            # Delete from Firebase Auth
            try:
                firebase_auth.delete_user(uid)
                print(f"❌ DELETED: {email}")
                deleted_count += 1
            except Exception as e:
                print(f"⚠️  Could not delete Firebase Auth user {email}: {e}")
    
    print(f"\n📊 Summary: Deleted {deleted_count} test users, kept 1 production owner")
    return production_owner_uid

def cleanup_stores():
    """Remove all stores"""
    print("\n🏪 CLEANING UP STORES")
    print("=" * 70)
    
    stores_ref = db.collection('stores')
    all_stores = list(stores_ref.stream())
    
    for store_doc in all_stores:
        store_data = store_doc.to_dict()
        store_name = store_data.get('name', 'Unknown')
        
        # Delete the store
        db.collection('stores').document(store_doc.id).delete()
        print(f"❌ DELETED Store: {store_name}")
    
    print(f"\n📊 Summary: Deleted {len(all_stores)} stores")

def cleanup_ingredients():
    """Remove all ingredients"""
    print("\n🥫 CLEANING UP INGREDIENTS")
    print("=" * 70)
    
    ingredients_ref = db.collection('ingredients')
    all_ingredients = list(ingredients_ref.stream())
    
    for ingredient_doc in all_ingredients:
        db.collection('ingredients').document(ingredient_doc.id).delete()
    
    print(f"📊 Summary: Deleted {len(all_ingredients)} ingredients")

def cleanup_shifts():
    """Remove all shifts"""
    print("\n📅 CLEANING UP SHIFTS")
    print("=" * 70)
    
    shifts_ref = db.collection('shifts')
    all_shifts = list(shifts_ref.stream())
    
    for shift_doc in all_shifts:
        db.collection('shifts').document(shift_doc.id).delete()
    
    print(f"📊 Summary: Deleted {len(all_shifts)} shifts")

def cleanup_attendance():
    """Remove all attendance records"""
    print("\n⏰ CLEANING UP ATTENDANCE RECORDS")
    print("=" * 70)
    
    attendance_ref = db.collection('attendance')
    all_attendance = list(attendance_ref.stream())
    
    for attendance_doc in all_attendance:
        db.collection('attendance').document(attendance_doc.id).delete()
    
    print(f"📊 Summary: Deleted {len(all_attendance)} attendance records")

def cleanup_ingredient_counts():
    """Remove all ingredient counts"""
    print("\n📝 CLEANING UP INGREDIENT COUNTS")
    print("=" * 70)
    
    counts_ref = db.collection('ingredient_counts')
    all_counts = list(counts_ref.stream())
    
    for count_doc in all_counts:
        db.collection('ingredient_counts').document(count_doc.id).delete()
    
    print(f"📊 Summary: Deleted {len(all_counts)} ingredient counts")

def cleanup_leave_requests():
    """Remove all leave requests"""
    print("\n🏖️ CLEANING UP LEAVE REQUESTS")
    print("=" * 70)
    
    leave_ref = db.collection('leave_requests')
    all_leave = list(leave_ref.stream())
    
    for leave_doc in all_leave:
        db.collection('leave_requests').document(leave_doc.id).delete()
    
    print(f"📊 Summary: Deleted {len(all_leave)} leave requests")

def verify_production_owner(owner_uid):
    """Verify production owner account is intact"""
    print("\n✅ VERIFYING PRODUCTION OWNER ACCOUNT")
    print("=" * 70)
    
    if not owner_uid:
        print("❌ ERROR: Production owner account not found!")
        return False
    
    # Check Firestore
    owner_doc = db.collection('users').document(owner_uid).get()
    if owner_doc.exists:
        owner_data = owner_doc.to_dict()
        print(f"✅ Firestore User: {owner_data.get('email')}")
        print(f"   Name: {owner_data.get('name')}")
        print(f"   Role: {owner_data.get('role')}")
        print(f"   UID: {owner_uid}")
    else:
        print("❌ ERROR: Owner not found in Firestore!")
        return False
    
    # Check Firebase Auth
    try:
        auth_user = firebase_auth.get_user(owner_uid)
        print(f"✅ Firebase Auth: {auth_user.email}")
    except Exception as e:
        print(f"❌ ERROR: Owner not found in Firebase Auth: {e}")
        return False
    
    return True

def main():
    print("\n" + "=" * 70)
    print("🚀 PRODUCTION CLEANUP - GOSTA EMPLOYEE MANAGEMENT SYSTEM")
    print("=" * 70)
    print(f"\n⚠️  This will DELETE all test data and keep only:")
    print(f"   - Owner: {PRODUCTION_OWNER_EMAIL}")
    print("\nPress ENTER to continue or Ctrl+C to cancel...")
    input()
    
    # Cleanup all collections
    owner_uid = cleanup_test_users()
    cleanup_stores()
    cleanup_ingredients()
    cleanup_shifts()
    cleanup_attendance()
    cleanup_ingredient_counts()
    cleanup_leave_requests()
    
    # Verify production owner
    if verify_production_owner(owner_uid):
        print("\n" + "=" * 70)
        print("✅ CLEANUP COMPLETE - PRODUCTION READY!")
        print("=" * 70)
        print("\n📋 REMAINING DATA:")
        print(f"   ✅ 1 Owner Account: {PRODUCTION_OWNER_EMAIL}")
        print(f"   ✅ 0 Test Users")
        print(f"   ✅ 0 Stores")
        print(f"   ✅ 0 Employees")
        print(f"   ✅ 0 Shifts")
        print(f"   ✅ 0 Test Data")
        print("\n🎉 App is clean and ready for production deployment!")
    else:
        print("\n❌ ERROR: Production owner verification failed!")
        print("Please check the owner account manually.")

if __name__ == "__main__":
    main()
