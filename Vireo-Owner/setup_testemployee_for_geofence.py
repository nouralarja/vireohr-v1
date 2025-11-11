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

# Your coordinates
YOUR_LAT = 32.07685088999998
YOUR_LNG = 36.102073659999995

print("="*60)
print("SETTING UP TESTEMPLOYEE FOR GEOFENCE TEST")
print("="*60)

# Use existing testemployee account
uid = 'AStZ6ahsPwWxJAwxZjhNHM7oxMX2'

# Reset password for testemployee
try:
    auth.update_user(uid, password='test123456')
    print("✅ Password reset for testemployee@vireohr.com")
except Exception as e:
    print(f"❌ Error resetting password: {e}")

# Update store location
stores = list(db.collection('stores').limit(1).stream())
if stores:
    store = stores[0]
    store_data = store.to_dict()
    
    db.collection('stores').document(store.id).update({
        'lat': YOUR_LAT,
        'lng': YOUR_LNG
    })
    print(f"✅ Store updated to your location: {YOUR_LAT:.6f}, {YOUR_LNG:.6f}")
    
    # Create shift starting 10 minutes ago
    now = datetime.utcnow()
    today = now.date().isoformat()
    shift_start_time = now - timedelta(minutes=10)
    shift_end_time = shift_start_time + timedelta(hours=8)
    
    shift_id = str(uuid.uuid4())
    shift = {
        'id': shift_id,
        'employeeId': uid,
        'employeeName': 'Test Employee',
        'storeId': store.id,
        'storeName': store_data.get('name'),
        'date': today,
        'startTime': shift_start_time.strftime('%H:%M'),
        'endTime': shift_end_time.strftime('%H:%M'),
        'supervisorId': None,
        'createdAt': now.isoformat()
    }
    db.collection('shifts').document(shift_id).set(shift)
    print(f"✅ Shift created: {shift_start_time.strftime('%H:%M')} - {shift_end_time.strftime('%H:%M')}")
    
    print("\n" + "="*60)
    print("✅ READY TO TEST!")
    print("="*60)
    print(f"\n📧 Email: testemployee@vireohr.com")
    print(f"🔑 Password: test123456")
    print(f"📍 Store Location: {YOUR_LAT:.6f}, {YOUR_LNG:.6f}")
    print(f"🔒 Geofence: 10m radius")
    print(f"⏰ Shift Started: {shift_start_time.strftime('%H:%M')} (10 min ago - YOU'RE LATE!)")
    print(f"⏰ Shift Ends: {shift_end_time.strftime('%H:%M')}")
    print("\n🚀 Login with testemployee@vireohr.com / test123456")

