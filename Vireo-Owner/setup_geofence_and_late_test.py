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
print("GEOFENCING + LATENESS TEST SETUP")
print("="*60)

# Update first store to your location
stores = list(db.collection('stores').limit(1).stream())
if not stores:
    print("❌ No stores found!")
    exit(1)

store = stores[0]
store_data = store.to_dict()
original_lat = store_data.get('lat', 0)
original_lng = store_data.get('lng', 0)

# Update store location
db.collection('stores').document(store.id).update({
    'lat': YOUR_LAT,
    'lng': YOUR_LNG
})

print(f"\n🏪 Store: {store_data.get('name')}")
print(f"📍 Updated Location: {YOUR_LAT:.6f}, {YOUR_LNG:.6f}")
print(f"🔒 Geofence Radius: 10 meters")

# Get/create test employee
try:
    user = auth.get_user_by_email('geotest@gosta.com')
    uid = user.uid
    print(f"\n✅ Using test employee: geotest@gosta.com")
except:
    user = auth.create_user(
        email='geotest@gosta.com',
        password='test123456',
        display_name='Geofence Test'
    )
    uid = user.uid
    print(f"\n✅ Created test employee: geotest@gosta.com")

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

# Create shift that started 10 minutes ago (so you'll be late)
now = datetime.utcnow()
today = now.date().isoformat()
shift_start_time = now - timedelta(minutes=10)  # Started 10 min ago
shift_end_time = shift_start_time + timedelta(hours=8)  # 8 hour shift

shift_id = str(uuid.uuid4())
shift = {
    'id': shift_id,
    'employeeId': uid,
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

# Create backup/restore script
backup_script = f"""#!/usr/bin/env python3
import firebase_admin
from firebase_admin import credentials, firestore

cred = credentials.Certificate('/app/backend/firebase-service-account.json')
try:
    firebase_admin.get_app()
except ValueError:
    firebase_admin.initialize_app(cred)

db = firestore.client()

# Restore original location
db.collection('stores').document('{store.id}').update({{
    'lat': {original_lat},
    'lng': {original_lng}
}})

print("✅ Store location restored to original coordinates")
print(f"📍 {store_data.get('name')}: {original_lat:.6f}, {original_lng:.6f}")
"""

with open('/app/restore_store_location.py', 'w') as f:
    f.write(backup_script)

print("\n" + "="*60)
print("✅ TEST ENVIRONMENT READY!")
print("="*60)

print(f"\n📧 Test Account: geotest@gosta.com / test123456")
print(f"📍 Your Coordinates: {YOUR_LAT:.6f}, {YOUR_LNG:.6f}")
print(f"🏪 Store: {store_data.get('name')} (at your location)")
print(f"🔒 Geofence: 10m radius")

print(f"\n⏰ SHIFT DETAILS:")
print(f"   Started: {shift_start_time.strftime('%H:%M')} (10 minutes ago)")
print(f"   Ends: {shift_end_time.strftime('%H:%M')}")
print(f"   ⚠️  You are 10 minutes LATE!")

print("\n" + "="*60)
print("WHAT WILL HAPPEN WHEN YOU CLOCK IN:")
print("="*60)
print("\n✅ GEOFENCING:")
print("   - If within 10m: Clock in succeeds")
print("   - If >10m away: Error with distance shown")

print("\n⚠️  LATENESS PENALTY:")
print("   - Shift started at " + shift_start_time.strftime('%H:%M'))
print("   - You're clocking in ~10 minutes late")
print("   - Backend will mark: isLate = TRUE")
print("   - minutesLate = ~10")
print("   - This is your 1st late arrival (warning only)")
print("   - After 2 warnings, 3rd+ late = penalty")

print("\n" + "="*60)
print("HOW TO TEST:")
print("="*60)

print("\n1️⃣  TEST GEOFENCING AT YOUR LOCATION:")
print("   - Open app")
print("   - Sign in: geotest@gosta.com / test123456")
print("   - Go to Clock tab")
print("   - Allow location permissions")
print("   - ✅ Should show your shift")
print("   - Tap 'Clock In'")
print("   - ✅ Should succeed (you're at store location)")

print("\n2️⃣  CHECK LATE STATUS:")
print("   - After clocking in successfully")
print("   - Go to Home tab (as employee)")
print("   - Check if late warning shows")
print("   - Or check Payroll tab as Owner")

print("\n3️⃣  TEST GEOFENCING FAILURE:")
print("   - Clock out")
print("   - Walk 15+ meters away")
print("   - Try to clock in again")
print("   - ❌ Should fail with: 'You are XXm away...'")

print("\n4️⃣  TEST LATE PENALTY (Need 3+ lates):")
print("   - Clock in late today (1st late)")
print("   - Create another shift tomorrow, clock in late (2nd late)")
print("   - Create 3rd shift, clock in late (3rd late)")
print("   - 3rd late should show penalty in earnings")

print("\n" + "="*60)
print("RESTORE ORIGINAL LOCATION AFTER TESTING:")
print("="*60)
print("Run: python /app/restore_store_location.py")

print("\n🚀 Ready to test! Open your app now!")

