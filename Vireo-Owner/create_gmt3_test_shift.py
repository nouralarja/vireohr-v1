#!/usr/bin/env python3
import firebase_admin
from firebase_admin import credentials, firestore, auth
from datetime import datetime, timedelta
import pytz
import uuid

# Initialize Firebase
cred = credentials.Certificate('/app/backend/firebase-service-account.json')
try:
    firebase_admin.get_app()
except ValueError:
    firebase_admin.initialize_app(cred)

db = firestore.client()

# Set to GMT+03:00
APP_TIMEZONE = pytz.timezone('Asia/Amman')

print("="*60)
print("CREATING TEST SHIFT IN GMT+03:00 TIMEZONE")
print("="*60)

# Get current time in GMT+03:00
now = datetime.now(APP_TIMEZONE)
print(f"\n🕐 Current Time (GMT+03:00): {now.strftime('%Y-%m-%d %H:%M:%S %Z')}")

# Get test user and store
user = auth.get_user_by_email('geotest@gosta.com')
stores = list(db.collection('stores').limit(1).stream())
store = stores[0]
store_data = store.to_dict()

# Delete old shifts for today
today = now.date().isoformat()
old_shifts = list(db.collection('shifts')
                 .where('employeeId', '==', user.uid)
                 .where('date', '==', today)
                 .stream())

for shift in old_shifts:
    db.collection('shifts').document(shift.id).delete()
    print(f"🗑️  Deleted old shift")

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

print("\n" + "="*60)
print("✅ TEST SHIFT CREATED (GMT+03:00)")
print("="*60)
print(f"\n👤 Employee: geotest@gosta.com / test123456")
print(f"🏪 Store: {store_data.get('name')}")
print(f"📍 Location: {store_data.get('lat')}, {store_data.get('lng')}")
print(f"\n⏰ Shift Details:")
print(f"   Date: {today}")
print(f"   Started: {shift['startTime']} (10 minutes ago)")
print(f"   Ends: {shift['endTime']}")
print(f"   Current Time: {now.strftime('%H:%M')}")
print(f"   Timezone: GMT+03:00 (Asia/Amman)")
print(f"   ⚠️  Employee is ~10 minutes LATE!")
print("\n🚀 Ready to test geofencing with correct timezone!")
