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
print("FIXING GEOTEST USER")
print("="*60)

# Try to get the user
try:
    user = auth.get_user_by_email('geotest@gosta.com')
    print(f"\n✅ User found: {user.uid}")
    
    # Update the password
    auth.update_user(
        user.uid,
        password='test123456',
        email_verified=True
    )
    print("✅ Password reset to: test123456")
    
    # Update Firestore
    user_data = {
        'uid': user.uid,
        'email': 'geotest@gosta.com',
        'name': 'Geofence Test',
        'role': 'EMPLOYEE',
        'salary': 50,
        'createdAt': user.user_metadata.creation_timestamp,
        'isActive': True
    }
    db.collection('users').document(user.uid).set(user_data)
    print("✅ Firestore user updated")
    
except auth.UserNotFoundError:
    print("\n⚠️  User not found, creating new user...")
    
    # Delete any existing Firestore user with this email
    users_ref = db.collection('users').where('email', '==', 'geotest@gosta.com').stream()
    for u in users_ref:
        db.collection('users').document(u.id).delete()
        print(f"🗑️  Deleted orphaned Firestore user: {u.id}")
    
    # Create new user
    user = auth.create_user(
        email='geotest@gosta.com',
        password='test123456',
        display_name='Geofence Test',
        email_verified=True
    )
    print(f"✅ Created new user: {user.uid}")
    
    # Create Firestore user
    user_data = {
        'uid': user.uid,
        'email': 'geotest@gosta.com',
        'name': 'Geofence Test',
        'role': 'EMPLOYEE',
        'salary': 50,
        'createdAt': user.user_metadata.creation_timestamp,
        'isActive': True
    }
    db.collection('users').document(user.uid).set(user_data)
    print("✅ Firestore user created")

except Exception as e:
    print(f"❌ Error: {e}")
    exit(1)

print("\n" + "="*60)
print("✅ USER READY!")
print("="*60)
print(f"\n📧 Email: geotest@gosta.com")
print(f"🔑 Password: test123456")
print(f"👤 UID: {user.uid}")
print(f"✅ Email Verified: True")
print("\n🚀 Try logging in now!")

