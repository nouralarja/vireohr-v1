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
APP_TIMEZONE = pytz.timezone('Asia/Amman')

print("="*60)
print("CREATING SUPERVISOR TEST ENVIRONMENT")
print("="*60)

# 1. Create or get supervisor account
try:
    supervisor_user = auth.get_user_by_email('supervisor@vireohr.com')
    print(f"\n✅ Supervisor account exists: supervisor@vireohr.com")
    print(f"   UID: {supervisor_user.uid}")
except:
    supervisor_user = auth.create_user(
        email='supervisor@vireohr.com',
        password='vireohr123',
        display_name='Test Supervisor'
    )
    print(f"\n✅ Created supervisor account: supervisor@vireohr.com / vireohr123")
    print(f"   UID: {supervisor_user.uid}")

# 2. Create/update supervisor user in Firestore
supervisor_data = {
    'uid': supervisor_user.uid,
    'email': 'supervisor@vireohr.com',
    'name': 'Test Supervisor',
    'role': 'EMPLOYEE',  # Regular employee who can be assigned as supervisor
    'phone': '+962791234567',
    'createdAt': datetime.now(APP_TIMEZONE).isoformat()
}

db.collection('users').document(supervisor_user.uid).set(supervisor_data, merge=True)
print(f"   Firestore user data updated")

# 3. Get first store
stores = list(db.collection('stores').limit(1).stream())
if not stores:
    print("\n❌ No stores found! Please create a store first.")
    exit(1)

store = stores[0]
store_data = store.to_dict()
print(f"\n🏪 Store: {store_data.get('name')}")
print(f"   Location: {store_data.get('lat')}, {store_data.get('lng')}")

# 4. Delete old shifts for today
now = datetime.now(APP_TIMEZONE)
today = now.date().isoformat()

old_shifts = list(db.collection('shifts')
                 .where('employeeId', '==', supervisor_user.uid)
                 .where('date', '==', today)
                 .stream())

for shift in old_shifts:
    db.collection('shifts').document(shift.id).delete()
    print(f"🗑️  Deleted old shift")

# 5. Create shift that started 30 minutes ago, supervisor is also the employee
shift_start_time = now - timedelta(minutes=30)
shift_end_time = shift_start_time + timedelta(hours=8)

shift_id = str(uuid.uuid4())
shift = {
    'id': shift_id,
    'employeeId': supervisor_user.uid,
    'employeeName': 'Test Supervisor',
    'storeId': store.id,
    'storeName': store_data.get('name'),
    'date': today,
    'startTime': shift_start_time.strftime('%H:%M'),
    'endTime': shift_end_time.strftime('%H:%M'),
    'supervisorId': supervisor_user.uid,  # Supervisor is themselves
    'createdAt': now.isoformat()
}
db.collection('shifts').document(shift_id).set(shift)

print(f"\n⏰ Test Shift Created:")
print(f"   Date: {today}")
print(f"   Start: {shift['startTime']} (30 min ago)")
print(f"   End: {shift['endTime']}")
print(f"   Supervisor: {shift['employeeName']} (self)")

# 6. Create test ingredient for this shift
ingredient_id = str(uuid.uuid4())
ingredient = {
    'id': ingredient_id,
    'shiftId': shift_id,
    'storeId': store.id,
    'storeName': store_data.get('name'),
    'supervisorId': supervisor_user.uid,
    'supervisorName': 'Test Supervisor',
    'date': today,
    'name': 'Coffee Beans',
    'type': 'KILO',
    'firstCount': None,
    'addCount': None,
    'finalCount': None,
    'createdAt': now.isoformat()
}
db.collection('ingredients').document(ingredient_id).set(ingredient)

print(f"\n🥤 Test Ingredient Created:")
print(f"   Name: Coffee Beans")
print(f"   Type: KILO (allows decimals)")
print(f"   Status: Ready for First Count")

print("\n" + "="*60)
print("✅ SUPERVISOR TEST ENVIRONMENT READY!")
print("="*60)
print(f"\n📱 Test Instructions:")
print(f"1. Login with: supervisor@vireohr.com / vireohr123")
print(f"2. Go to Clock tab and clock in")
print(f"3. After clocking in, Ingredients tab should appear")
print(f"4. Go to Ingredients tab")
print(f"5. You should see 'Coffee Beans' ingredient")
print(f"6. Test the flow:")
print(f"   - First Count (e.g., 5.5 kg)")
print(f"   - Add Count (e.g., 2.0 kg)")
print(f"   - Final Count (e.g., 6.8 kg)")
print(f"\n🚀 Ready to test!")
