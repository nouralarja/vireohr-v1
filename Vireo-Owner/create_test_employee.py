import firebase_admin
from firebase_admin import credentials, firestore, auth
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

load_dotenv()

# Initialize Firebase
cred = credentials.Certificate('/app/backend/firebase-service-account.json')
try:
    firebase_admin.get_app()
except ValueError:
    firebase_admin.initialize_app(cred)

db = firestore.client()

# Create test employee in Firebase Auth
try:
    user = auth.create_user(
        email='testemployee@vireohr.com',
        password='test123456',
        display_name='Test Employee'
    )
    uid = user.uid
    print(f"✅ Created Firebase Auth user: {uid}")
except Exception as e:
    # User might already exist, try to get it
    try:
        user = auth.get_user_by_email('testemployee@vireohr.com')
        uid = user.uid
        print(f"✅ Using existing Firebase Auth user: {uid}")
    except:
        print(f"❌ Error creating user: {e}")
        exit(1)

# Create user in Firestore with salary
user_data = {
    'uid': uid,
    'email': 'testemployee@vireohr.com',
    'name': 'Test Employee',
    'role': 'EMPLOYEE',
    'salary': 50,  # 50 JD/hour
    'createdAt': datetime.utcnow().isoformat(),
    'isActive': True
}

db.collection('users').document(uid).set(user_data)
print(f"✅ Created Firestore user document")

# Get a test store
stores = list(db.collection('stores').limit(1).stream())
if stores:
    store = stores[0]
    store_id = store.id
    store_data = store.to_dict()
    print(f"✅ Using store: {store_data.get('name')} ({store_id})")
    
    # Create shifts for testing
    today = datetime.utcnow().date()
    
    # Shift 1: Current shift (started 2 hours ago, ends in 6 hours) - for testing clock in/out
    shift1_start = (datetime.utcnow() - timedelta(hours=2)).replace(minute=0, second=0, microsecond=0)
    shift1_end = (datetime.utcnow() + timedelta(hours=6)).replace(minute=0, second=0, microsecond=0)
    
    shift1 = {
        'id': f'test_shift_1_{uid}',
        'employeeId': uid,
        'employeeName': 'Test Employee',
        'storeId': store_id,
        'storeName': store_data.get('name'),
        'date': today.isoformat(),
        'startTime': shift1_start.strftime('%H:%M'),
        'endTime': shift1_end.strftime('%H:%M'),
        'supervisorId': None,
        'createdAt': datetime.utcnow().isoformat()
    }
    db.collection('shifts').document(shift1['id']).set(shift1)
    print(f"✅ Created current shift: {shift1_start.strftime('%H:%M')} - {shift1_end.strftime('%H:%M')}")
    
    # Shift 2: Tomorrow (for testing late penalties)
    tomorrow = today + timedelta(days=1)
    shift2 = {
        'id': f'test_shift_2_{uid}',
        'employeeId': uid,
        'employeeName': 'Test Employee',
        'storeId': store_id,
        'storeName': store_data.get('name'),
        'date': tomorrow.isoformat(),
        'startTime': '09:00',
        'endTime': '17:00',
        'supervisorId': None,
        'createdAt': datetime.utcnow().isoformat()
    }
    db.collection('shifts').document(shift2['id']).set(shift2)
    print(f"✅ Created tomorrow's shift: 09:00 - 17:00")
    
    # Shift 3: Past shift (2 days ago) - for no-show testing
    past_date = today - timedelta(days=2)
    shift3 = {
        'id': f'test_shift_3_{uid}',
        'employeeId': uid,
        'employeeName': 'Test Employee',
        'storeId': store_id,
        'storeName': store_data.get('name'),
        'date': past_date.isoformat(),
        'startTime': '09:00',
        'endTime': '17:00',
        'supervisorId': uid,  # Make them supervisor for ingredient testing
        'createdAt': datetime.utcnow().isoformat()
    }
    db.collection('shifts').document(shift3['id']).set(shift3)
    print(f"✅ Created past shift (no-show): {past_date.isoformat()} 09:00 - 17:00")
    
    print("\n" + "="*60)
    print("TEST ACCOUNT CREATED SUCCESSFULLY!")
    print("="*60)
    print(f"Email: testemployee@vireohr.com")
    print(f"Password: test123456")
    print(f"UID: {uid}")
    print(f"Role: EMPLOYEE")
    print(f"Hourly Rate: 50 JD/hour")
    print(f"Store: {store_data.get('name')}")
    print(f"Current Shift: {shift1_start.strftime('%H:%M')} - {shift1_end.strftime('%H:%M')}")
    print("="*60)
else:
    print("❌ No stores found. Please create a store first.")

