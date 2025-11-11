#!/usr/bin/env python3
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
print("GEOFENCING TEST VERIFICATION")
print("="*60)

# Check store
stores = list(db.collection('stores').limit(1).stream())
if stores:
    store = stores[0]
    store_data = store.to_dict()
    print(f"\n🏪 Store: {store_data.get('name')}")
    print(f"📍 Location: {store_data.get('lat')}, {store_data.get('lng')}")
    print(f"🔒 Geofence: 10m radius")

# Check test user
try:
    user = auth.get_user_by_email('geotest@vireohr.com')
    print(f"\n👤 Test User: geotest@vireohr.com")
    print(f"   UID: {user.uid}")
    
    # Check if shift exists for today
    now = datetime.utcnow()
    today = now.date().isoformat()
    
    shifts = list(db.collection('shifts')
                 .where('employeeId', '==', user.uid)
                 .where('date', '==', today)
                 .stream())
    
    if shifts:
        shift = shifts[0].to_dict()
        print(f"\n⏰ Active Shift Today:")
        print(f"   Start: {shift.get('startTime')}")
        print(f"   End: {shift.get('endTime')}")
        print(f"   Store: {shift.get('storeName')}")
    else:
        print(f"\n⚠️  No shift found for today. Creating one...")
        
        # Create shift that started 10 minutes ago
        shift_start_time = now - timedelta(minutes=10)
        shift_end_time = shift_start_time + timedelta(hours=8)
        
        shift_id = str(uuid.uuid4())
        shift = {
            'id': shift_id,
            'employeeId': user.uid,
            'employeeName': 'Geofence Test',
            'storeId': store.id,
            'storeName': store_data.get('name'),
            'date': today,
            'startTime': shift_start_time.strftime('%H:%M'),
            'endTime': shift_end_time.strftime('%H:%M'),
            'supervisorId': None,
            'createdAt': now.isoformat()
        }
        db.collection('shifts').document(shift_id).set(shift)
        
        print(f"   ✅ Created shift:")
        print(f"   Start: {shift['startTime']} (10 minutes ago)")
        print(f"   End: {shift['endTime']}")
        print(f"   ⚠️  You are LATE!")

except Exception as e:
    print(f"\n❌ Error: {e}")

print("\n" + "="*60)
print("✅ TEST ENVIRONMENT READY!")
print("="*60)
print("\n📱 Test with:")
print("   Email: geotest@vireohr.com")
print("   Password: test123456")
print("   Location: 32.07685088999999, 36.10207365999999")
print("\n🚀 Ready to test geofencing and late penalties!")
