#!/usr/bin/env python3
import firebase_admin
from firebase_admin import credentials, firestore, auth
from datetime import datetime
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
print("FORCE CLOCK-IN FOR SUPERVISOR (BYPASS GEOFENCE)")
print("="*60)

# Get supervisor
supervisor_user = auth.get_user_by_email('supervisor@gosta.com')
now = datetime.now(APP_TIMEZONE)
today = now.date().isoformat()

print(f"\n👤 Supervisor: {supervisor_user.email}")
print(f"   UID: {supervisor_user.uid}")

# Get shift
shifts = list(db.collection('shifts')
             .where('employeeId', '==', supervisor_user.uid)
             .where('date', '==', today)
             .stream())

if not shifts:
    print(f"\n❌ No shift found for today!")
    exit(1)

shift = shifts[0]
shift_data = shift.to_dict()
print(f"\n⏰ Shift Found:")
print(f"   Start: {shift_data.get('startTime')}")
print(f"   End: {shift_data.get('endTime')}")
print(f"   Store: {shift_data.get('storeName')}")
print(f"   Supervisor ID: {shift_data.get('supervisorId')}")

# Create attendance record manually
attendance_id = str(uuid.uuid4())
attendance = {
    'id': attendance_id,
    'employeeId': supervisor_user.uid,
    'employeeName': 'Test Supervisor',
    'storeId': shift_data.get('storeId'),
    'storeName': shift_data.get('storeName'),
    'shiftId': shift.id,
    'date': today,
    'clockInTime': now.isoformat(),
    'clockInLatitude': 32.077236,
    'clockInLongitude': 36.1021849,
    'status': 'CLOCKED_IN',
    'isLate': False,
    'minutesLate': 0,
    'createdAt': now.isoformat()
}

db.collection('attendance').document(attendance_id).set(attendance)

print(f"\n✅ FORCE CLOCKED IN!")
print(f"   Attendance ID: {attendance_id}")
print(f"   Status: CLOCKED_IN")
print(f"   Clock In Time: {now.strftime('%H:%M:%S')}")

print("\n" + "="*60)
print("✅ SUPERVISOR IS NOW CLOCKED IN!")
print("="*60)
print("\n📱 Now in the app:")
print("1. The Ingredients tab should appear within 30 seconds")
print("2. Or close and reopen the app to trigger immediate check")
print("3. Go to Ingredients tab")
print("4. You should see 'Coffee Beans' ingredient")
print("\n🚀 Ready to test ingredient flow!")
