import firebase_admin
from firebase_admin import credentials, firestore, auth
import json

# Initialize Firebase
cred = credentials.Certificate('/app/backend/firebase-service-account.json')
try:
    firebase_admin.get_app()
except ValueError:
    firebase_admin.initialize_app(cred)

db = firestore.client()

print("="*60)
print("FIREBASE CONFIGURATION CHECK")
print("="*60)

# Check service account
with open('/app/backend/firebase-service-account.json', 'r') as f:
    service_account = json.load(f)
    print(f"\n📋 Firebase Project ID: {service_account.get('project_id')}")
    print(f"📧 Service Account Email: {service_account.get('client_email')}")

# List all users
print("\n" + "="*60)
print("ALL FIREBASE AUTH USERS:")
print("="*60)

page = auth.list_users()
user_count = 0
for user in page.users:
    user_count += 1
    print(f"\n{user_count}. {user.email}")
    print(f"   UID: {user.uid}")
    print(f"   Email Verified: {user.email_verified}")
    print(f"   Disabled: {user.disabled}")
    
    if user.email == 'geotest@vireohr.com':
        print("   >>> THIS IS THE GEOTEST USER <<<")

if user_count == 0:
    print("\n⚠️  No users found in Firebase Auth!")

# Check Firestore users
print("\n" + "="*60)
print("FIRESTORE USERS COLLECTION:")
print("="*60)

firestore_users = list(db.collection('users').stream())
print(f"\nTotal Firestore users: {len(firestore_users)}")

for u in firestore_users:
    u_data = u.to_dict()
    if u_data.get('email') == 'geotest@vireohr.com':
        print(f"\n✅ Found geotest in Firestore:")
        print(f"   UID: {u.id}")
        print(f"   Email: {u_data.get('email')}")
        print(f"   Name: {u_data.get('name')}")
        print(f"   Role: {u_data.get('role')}")

# Try to authenticate with geotest credentials (server-side test)
print("\n" + "="*60)
print("AUTHENTICATION TEST:")
print("="*60)

try:
    # Get the user
    user = auth.get_user_by_email('geotest@vireohr.com')
    print(f"\n✅ User exists in Firebase Auth")
    print(f"   Email: {user.email}")
    print(f"   UID: {user.uid}")
    print(f"   Disabled: {user.disabled}")
    print(f"   Email Verified: {user.email_verified}")
    
    # Check if user has password set
    print(f"\n🔐 Password Provider: {user.provider_data}")
    
except Exception as e:
    print(f"\n❌ Error: {e}")

print("\n" + "="*60)
print("SUGGESTION:")
print("="*60)
print("\nThe issue might be:")
print("1. Frontend connecting to different Firebase project")
print("2. Check frontend firebase config in /app/frontend/config/firebase.ts")
print("3. Try using the Owner account to verify Firebase connection")
print("\n📧 Try Owner account: nouralarja.dev@gmail.com / 256997")

