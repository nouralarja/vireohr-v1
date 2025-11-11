import firebase_admin
from firebase_admin import credentials, firestore, auth
from datetime import datetime, timedelta
import uuid

# Initialize Firebase
cred = credentials.Certificate('/app/backend/firebase-service-account.json')
try:
    firebase_admin.get_app()
except ValueError:
    firebase_admin.initialize_app(cred)

db = firestore.client()

print("="*60)
print("GEOFENCING TEST SETUP")
print("="*60)

# Get or create test employee for geofencing
try:
    user = auth.get_user_by_email('geotest@gosta.com')
    uid = user.uid
    print(f"✅ Using existing test employee: {uid}")
except:
    try:
        user = auth.create_user(
            email='geotest@gosta.com',
            password='test123456',
            display_name='Geofence Test'
        )
        uid = user.uid
        print(f"✅ Created new test employee: {uid}")
    except Exception as e:
        print(f"❌ Error: {e}")
        exit(1)

# Create/update user in Firestore
user_data = {
    'uid': uid,
    'email': 'geotest@gosta.com',
    'name': 'Geofence Test',
    'role': 'EMPLOYEE',
    'salary': 50,
    'createdAt': datetime.utcnow().isoformat(),
    'isActive': True
}
db.collection('users').document(uid).set(user_data)

# Get all stores
stores = list(db.collection('stores').stream())
print(f"\n📍 Available Stores:")
print("-" * 60)

for store in stores:
    store_data = store.to_dict()
    print(f"   {store_data.get('name')}")
    print(f"   Location: {store_data.get('lat', 0):.6f}, {store_data.get('lng', 0):.6f}")
    print(f"   Store ID: {store.id}")
    print()

# Create shift for TODAY at the first store
if stores:
    store = stores[0]
    store_id = store.id
    store_data = store.to_dict()
    
    # Create shift starting now, ending in 8 hours
    now = datetime.utcnow()
    today = now.date().isoformat()
    shift_start = now.replace(minute=0, second=0, microsecond=0)
    shift_end = shift_start + timedelta(hours=8)
    
    shift_id = str(uuid.uuid4())
    shift = {
        'id': shift_id,
        'employeeId': uid,
        'employeeName': 'Geofence Test',
        'storeId': store_id,
        'storeName': store_data.get('name'),
        'date': today,
        'startTime': shift_start.strftime('%H:%M'),
        'endTime': shift_end.strftime('%H:%M'),
        'supervisorId': None,
        'createdAt': now.isoformat()
    }
    db.collection('shifts').document(shift_id).set(shift)
    
    print("="*60)
    print("✅ GEOFENCING TEST READY!")
    print("="*60)
    print(f"\n📧 Test Account: geotest@gosta.com / test123456")
    print(f"👤 Employee ID: {uid}")
    print(f"\n🏪 Store: {store_data.get('name')}")
    print(f"📍 Store Location: {store_data.get('lat', 0):.6f}, {store_data.get('lng', 0):.6f}")
    print(f"🔒 Geofence Radius: 10 meters")
    print(f"\n⏰ Active Shift:")
    print(f"   Date: {today}")
    print(f"   Time: {shift_start.strftime('%H:%M')} - {shift_end.strftime('%H:%M')}")
    print(f"   Shift ID: {shift_id}")
    
    print("\n" + "="*60)
    print("HOW TO TEST:")
    print("="*60)
    print("\n1️⃣  UPDATE STORE LOCATION TO YOUR CURRENT LOCATION:")
    print("   Run: python /app/update_store_to_location.py")
    print("   (This will prompt for your GPS coordinates)")
    
    print("\n2️⃣  TEST INSIDE GEOFENCE (Should Work):")
    print("   - Sign in as geotest@gosta.com")
    print("   - Go to Clock tab")
    print("   - Make sure location permissions are enabled")
    print("   - Tap 'Clock In'")
    print("   - ✅ Should succeed if within 10m of store")
    
    print("\n3️⃣  TEST OUTSIDE GEOFENCE (Should Fail):")
    print("   - Move >10 meters away from store location")
    print("   - Try to clock in")
    print("   - ❌ Should show error with distance")
    
    print("\n4️⃣  ERROR MESSAGE FORMAT:")
    print("   'You are [XX]m away from the store.'")
    print("   'You must be within 10m to clock in.'")
    
    print("\n📝 NOTES:")
    print("   - Make sure GPS is enabled on your device")
    print("   - App will request location permission")
    print("   - Geofence uses Haversine formula (accurate)")
    print("   - Clock out also requires geofencing")
    
else:
    print("❌ No stores found!")

