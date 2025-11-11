#!/usr/bin/env python3
import firebase_admin
from firebase_admin import credentials, firestore, auth
from datetime import datetime
import pytz

# Initialize Firebase
cred = credentials.Certificate('/app/backend/firebase-service-account.json')
try:
    firebase_admin.get_app()
except ValueError:
    firebase_admin.initialize_app(cred)

db = firestore.client()
APP_TIMEZONE = pytz.timezone('Asia/Amman')

print("="*60)
print("CHECKING SUPERVISOR STATUS")
print("="*60)

# Get supervisor
supervisor_user = auth.get_user_by_email('supervisor@gosta.com')
print(f"\n👤 Supervisor: {supervisor_user.email}")
print(f"   UID: {supervisor_user.uid}")

# Check today's attendance
now = datetime.now(APP_TIMEZONE)
today = now.date().isoformat()

attendance_records = list(db.collection('attendance')
                         .where('employeeId', '==', supervisor_user.uid)
                         .where('date', '==', today)
                         .stream())

if attendance_records:
    print(f"\n⏰ Found {len(attendance_records)} attendance record(s) for today:")
    for record in attendance_records:
        data = record.to_dict()
        print(f"\n   Record ID: {record.id}")
        print(f"   Status: {data.get('status')}")
        print(f"   Clock In: {data.get('clockInTime')}")
        print(f"   Clock Out: {data.get('clockOutTime')}")
        print(f"   Shift ID: {data.get('shiftId')}")
        
        # Delete the record to allow fresh clock-in
        db.collection('attendance').document(record.id).delete()
        print(f"   🗑️  Deleted attendance record")
else:
    print(f"\n✅ No attendance records found for today - ready for fresh clock-in")

# Check shift
shifts = list(db.collection('shifts')
             .where('employeeId', '==', supervisor_user.uid)
             .where('date', '==', today)
             .stream())

if shifts:
    print(f"\n📅 Active Shift:")
    shift_data = shifts[0].to_dict()
    print(f"   Start: {shift_data.get('startTime')}")
    print(f"   End: {shift_data.get('endTime')}")
    print(f"   Supervisor ID: {shift_data.get('supervisorId')}")
    print(f"   Store: {shift_data.get('storeName')}")
    
    if shift_data.get('supervisorId') == supervisor_user.uid:
        print(f"   ✅ This user IS the supervisor for this shift")
    else:
        print(f"   ❌ This user is NOT the supervisor")
else:
    print(f"\n❌ No shift found for today")

print("\n" + "="*60)
print("✅ CLEANUP COMPLETE - READY TO CLOCK IN")
print("="*60)
print("\nNow try:")
print("1. Open the app as supervisor@gosta.com")
print("2. Go to Clock tab")
print("3. Tap 'Clock In'")
print("4. Ingredients tab should appear after clocking in")
