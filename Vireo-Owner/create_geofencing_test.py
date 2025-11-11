#!/usr/bin/env python3
"""
Geofencing Test Scenario Creator
Creates test data to demonstrate location-based clock in/out validation
"""

import firebase_admin
from firebase_admin import credentials, auth as firebase_auth, firestore
from datetime import datetime, timedelta
import uuid
from pathlib import Path

# Initialize Firebase
ROOT_DIR = Path(__file__).parent
cred = credentials.Certificate(ROOT_DIR / 'backend' / 'firebase-service-account.json')
try:
    firebase_admin.get_app()
except ValueError:
    firebase_admin.initialize_app(cred)

db = firestore.client()

def create_test_employee():
    """Create a test employee for geofencing demo"""
    email = "geotest@gosta.com"
    password = "vireohr123"
    
    # Create Firebase user
    try:
        user = firebase_auth.create_user(
            email=email,
            password=password,
            display_name="Geo Test Employee"
        )
        uid = user.uid
        print(f"✅ Created Firebase user: {email}")
    except firebase_auth.EmailAlreadyExistsError:
        user = firebase_auth.get_user_by_email(email)
        uid = user.uid
        print(f"ℹ️  User already exists: {email}")
    
    # Get the first store
    stores = list(db.collection('stores').limit(1).stream())
    if not stores:
        print("❌ No stores found! Please create a store first.")
        return None
    
    store_id = stores[0].id
    store_data = stores[0].to_dict()
    
    # Create Firestore user document
    user_doc = {
        'uid': uid,
        'email': email,
        'name': 'Geo Test Employee',
        'role': 'EMPLOYEE',
        'storeId': store_id,
        'active': True,
        'createdAt': datetime.utcnow().isoformat(),
        'updatedAt': datetime.utcnow().isoformat()
    }
    
    db.collection('users').document(uid).set(user_doc)
    print(f"✅ Created Firestore user document")
    print(f"   Store: {store_data.get('name')} ({store_id})")
    
    return {
        'uid': uid,
        'email': email,
        'password': password,
        'storeId': store_id,
        'storeName': store_data.get('name'),
        'storeLat': store_data.get('lat'),
        'storeLng': store_data.get('lng'),
        'storeRadius': store_data.get('radius', 10)
    }

def create_test_shift(employee_data):
    """Create a shift for today"""
    today = datetime.now().strftime('%Y-%m-%d')
    
    # Create shift from now to 8 hours later
    now = datetime.now()
    start_time = (now - timedelta(minutes=15)).strftime('%H:%M')  # Started 15 min ago
    end_time = (now + timedelta(hours=8)).strftime('%H:%M')
    
    shift_id = str(uuid.uuid4())
    shift = {
        'id': shift_id,
        'employeeId': employee_data['uid'],
        'employeeName': 'Geo Test Employee',
        'storeId': employee_data['storeId'],
        'storeName': employee_data['storeName'],
        'date': today,
        'startTime': start_time,
        'endTime': end_time,
        'supervisorId': None,
        'createdAt': datetime.utcnow().isoformat(),
        'updatedAt': datetime.utcnow().isoformat()
    }
    
    db.collection('shifts').document(shift_id).set(shift)
    print(f"✅ Created shift for today")
    print(f"   Date: {today}")
    print(f"   Time: {start_time} - {end_time}")
    
    return shift

def print_test_scenarios(employee_data):
    """Print test scenarios for curl commands"""
    store_lat = employee_data['storeLat']
    store_lng = employee_data['storeLng']
    radius = employee_data['storeRadius']
    
    # Calculate coordinates outside radius (50 meters away)
    # Rough approximation: 1 degree latitude ≈ 111km
    lat_offset = 50 / 111000  # 50 meters in degrees
    outside_lat = store_lat + lat_offset
    outside_lng = store_lng
    
    # Coordinates inside radius (5 meters away)
    inside_lat_offset = 5 / 111000
    inside_lat = store_lat + inside_lat_offset
    inside_lng = store_lng
    
    print("\n" + "="*70)
    print("GEOFENCING TEST SCENARIOS")
    print("="*70)
    
    print(f"\n📍 STORE LOCATION:")
    print(f"   Name: {employee_data['storeName']}")
    print(f"   Latitude: {store_lat}")
    print(f"   Longitude: {store_lng}")
    print(f"   Allowed Radius: {radius} meters")
    
    print(f"\n👤 TEST EMPLOYEE:")
    print(f"   Email: {employee_data['email']}")
    print(f"   Password: {employee_data['password']}")
    print(f"   UID: {employee_data['uid']}")
    
    print(f"\n📋 HOW TO TEST:")
    print(f"\n1️⃣  LOGIN AS TEST EMPLOYEE:")
    print(f"   - Open app on your device")
    print(f"   - Login with: {employee_data['email']} / {employee_data['password']}")
    print(f"   - Navigate to Clock tab")
    
    print(f"\n2️⃣  TEST SCENARIO A: OUTSIDE RADIUS (Should FAIL ❌)")
    print(f"   Location: ~50m away from store")
    print(f"   Latitude: {outside_lat}")
    print(f"   Longitude: {outside_lng}")
    print(f"   Expected: Error message \"You are 50m away from the store...\"")
    
    print(f"\n3️⃣  TEST SCENARIO B: INSIDE RADIUS (Should SUCCEED ✅)")
    print(f"   Location: ~5m away from store")
    print(f"   Latitude: {inside_lat}")
    print(f"   Longitude: {inside_lng}")
    print(f"   Expected: Clock in successful!")
    
    print(f"\n🧪 CURL TEST COMMANDS (Backend Testing):")
    print(f"\nFirst, get auth token:")
    print(f"""curl -X POST https://stafftracker-12.preview.emergentagent.com/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{{"email": "{employee_data['email']}", "password": "{employee_data['password']}"}}'""")
    
    print(f"\nTest OUTSIDE radius (should fail):")
    print(f"""curl -X POST https://stafftracker-12.preview.emergentagent.com/api/attendance/clock-in \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \\
  -d '{{"shiftId": "SHIFT_ID", "storeId": "{employee_data['storeId']}", "latitude": {outside_lat}, "longitude": {outside_lng}}}'""")
    
    print(f"\nTest INSIDE radius (should succeed):")
    print(f"""curl -X POST https://stafftracker-12.preview.emergentagent.com/api/attendance/clock-in \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \\
  -d '{{"shiftId": "SHIFT_ID", "storeId": "{employee_data['storeId']}", "latitude": {inside_lat}, "longitude": {inside_lng}}}'""")
    
    print("\n" + "="*70)
    print("📱 TESTING ON DEVICE:")
    print("="*70)
    print("Since you're testing on a real device, the app will use your")
    print("actual GPS location. To test geofencing:")
    print()
    print("OPTION 1: Use iOS Simulator Location Simulation")
    print("  - In simulator: Debug > Location > Custom Location")
    print(f"  - Set to store coords: {store_lat}, {store_lng}")
    print()
    print("OPTION 2: Test at actual store location")
    print("  - Go to the physical store location")
    print("  - Try clocking in (should succeed)")
    print("  - Walk 20+ meters away")
    print("  - Try clocking in again (should fail)")
    print()
    print("OPTION 3: Temporarily increase store radius for testing")
    print(f"  - In Stores screen, edit store radius to 1000m")
    print(f"  - This allows clock in from anywhere nearby")
    print(f"  - Change back to 10m after testing")
    print("\n" + "="*70)

def main():
    print("\n🎯 GEOFENCING TEST SETUP")
    print("="*70)
    
    # Create test employee
    employee_data = create_test_employee()
    if not employee_data:
        return
    
    # Create test shift
    shift = create_test_shift(employee_data)
    
    # Print test scenarios
    print_test_scenarios(employee_data)
    
    print("\n✅ Test setup complete!")
    print(f"\n🔑 Quick Login:")
    print(f"   Email: {employee_data['email']}")
    print(f"   Password: {employee_data['password']}")

if __name__ == "__main__":
    main()
