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
print("VERIFYING SUPERVISOR CLOCK-IN STATUS")
print("="*60)

# Get supervisor
supervisor_user = auth.get_user_by_email('supervisor@vireohr.com')
print(f"\n👤 Supervisor UID: {supervisor_user.uid}")

# Check today's attendance
now = datetime.now(APP_TIMEZONE)
today = now.date().isoformat()
print(f"📅 Today: {today}")

attendance_records = list(db.collection('attendance')
                         .where('employeeId', '==', supervisor_user.uid)
                         .where('date', '==', today)
                         .stream())

if not attendance_records:
    print(f"\n❌ NO ATTENDANCE RECORD FOUND!")
    print(f"   User is NOT clocked in according to database")
else:
    print(f"\n✅ Found {len(attendance_records)} attendance record(s):")
    for record in attendance_records:
        data = record.to_dict()
        print(f"\n   Record ID: {record.id}")
        print(f"   Employee ID: {data.get('employeeId')}")
        print(f"   Status: {data.get('status')}")
        print(f"   Clock In Time: {data.get('clockInTime')}")
        print(f"   Shift ID: {data.get('shiftId')}")
        
        # Check if shift has supervisor
        if data.get('shiftId'):
            shift = db.collection('shifts').document(data.get('shiftId')).get()
            if shift.exists:
                shift_data = shift.to_dict()
                print(f"\n   📋 Shift Details:")
                print(f"      Shift ID: {data.get('shiftId')}")
                print(f"      Supervisor ID: {shift_data.get('supervisorId')}")
                print(f"      Store: {shift_data.get('storeName')}")
                
                if shift_data.get('supervisorId') == supervisor_user.uid:
                    print(f"      ✅ USER IS THE SUPERVISOR!")
                else:
                    print(f"      ❌ User is NOT the supervisor")
                    print(f"         Supervisor ID in shift: {shift_data.get('supervisorId')}")
                    print(f"         User UID: {supervisor_user.uid}")
        else:
            print(f"   ⚠️  No shift ID in attendance record")

# Check what the API would return
print("\n" + "="*60)
print("API RESPONSE SIMULATION")
print("="*60)

# Simulate what /api/attendance?date=today returns
all_attendance = list(db.collection('attendance').where('date', '==', today).stream())
print(f"\nTotal attendance records for today: {len(all_attendance)}")

supervisor_attendance = [a for a in all_attendance if a.to_dict().get('employeeId') == supervisor_user.uid]
if supervisor_attendance:
    print(f"Supervisor's attendance records: {len(supervisor_attendance)}")
    for att in supervisor_attendance:
        data = att.to_dict()
        print(f"  - Status: {data.get('status')}, ShiftId: {data.get('shiftId')}")
else:
    print(f"❌ No attendance records found for supervisor in today's attendance")

print("\n" + "="*60)
