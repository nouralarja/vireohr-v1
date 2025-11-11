#!/usr/bin/env python3
import firebase_admin
from firebase_admin import credentials, firestore, auth
from datetime import datetime, timedelta
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
print("UPDATING SHIFT FOR FINAL COUNT TESTING")
print("="*60)

# Get supervisor
supervisor_user = auth.get_user_by_email('supervisor@gosta.com')
now = datetime.now(APP_TIMEZONE)
today = now.date().isoformat()

print(f"\n🕐 Current Time (GMT+03:00): {now.strftime('%H:%M:%S')}")

# Get shift
shifts = list(db.collection('shifts')
             .where('employeeId', '==', supervisor_user.uid)
             .where('date', '==', today)
             .stream())

if not shifts:
    print("\n❌ No shift found!")
    exit(1)

shift = shifts[0]
shift_data = shift.to_dict()

print(f"\n📅 Current Shift:")
print(f"   Start: {shift_data.get('startTime')}")
print(f"   End: {shift_data.get('endTime')}")

# Calculate new end time (25 minutes from now - so Final Count becomes available in 5 min)
new_end_time = now + timedelta(minutes=25)

print(f"\n🔧 Updating shift end time to enable Final Count testing...")
print(f"   New End Time: {new_end_time.strftime('%H:%M')}")
print(f"   Final Count will be available at: {(now + timedelta(minutes=0)).strftime('%H:%M')} (already available!)")

# Update shift
db.collection('shifts').document(shift.id).update({
    'endTime': new_end_time.strftime('%H:%M')
})

print(f"\n✅ Shift updated successfully!")
print("\n" + "="*60)
print("TEST FINAL COUNT TIMING")
print("="*60)
print("\n📱 Now in the app:")
print("1. Go to Ingredients tab (or close/reopen app)")
print("2. You should see 'Final Count' button is now VISIBLE")
print("3. (Because we're within 30 min of shift end)")
print("\nTo test BEFORE 30-min window:")
print("- I can set shift end to 2+ hours from now")
print("- Final Count button will be hidden")
print("- Warning message will appear")
