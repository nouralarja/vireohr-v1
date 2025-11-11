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

# Create or get test employee
try:
    user = auth.create_user(
        email='payrolltest@gosta.com',
        password='test123456',
        display_name='Payroll Test Employee'
    )
    uid = user.uid
    print(f"✅ Created new test employee: {uid}")
except Exception as e:
    try:
        user = auth.get_user_by_email('payrolltest@gosta.com')
        uid = user.uid
        print(f"✅ Using existing test employee: {uid}")
    except:
        print(f"❌ Error: {e}")
        exit(1)

# Create user in Firestore
user_data = {
    'uid': uid,
    'email': 'payrolltest@gosta.com',
    'name': 'Payroll Test Employee',
    'role': 'EMPLOYEE',
    'salary': 60,  # 60 JD/hour
    'createdAt': datetime.utcnow().isoformat(),
    'isActive': True
}
db.collection('users').document(uid).set(user_data)
print(f"✅ Created/Updated user in Firestore")

# Get a test store
stores = list(db.collection('stores').limit(1).stream())
if not stores:
    print("❌ No stores found!")
    exit(1)

store = stores[0]
store_id = store.id
store_data = store.to_dict()
print(f"✅ Using store: {store_data.get('name')} ({store_id})")

# Calculate months
today = datetime.utcnow().date()
current_month = datetime(today.year, today.month, 1)
month_2_ago = current_month - timedelta(days=60)  # ~2 months ago
month_1_ago = current_month - timedelta(days=30)  # ~1 month ago

print("\n" + "="*60)
print("CREATING 3 MONTHS OF DATA")
print("="*60)

def create_month_attendance(month_date, month_name, hours_per_day=8):
    """Create attendance records for a month"""
    print(f"\n📅 {month_name}: {month_date.strftime('%B %Y')}")
    
    # Calculate days in month
    if month_date.month == 12:
        next_month = datetime(month_date.year + 1, 1, 1)
    else:
        next_month = datetime(month_date.year, month_date.month + 1, 1)
    
    days_in_month = (next_month - month_date).days
    work_days = min(20, days_in_month)  # ~20 work days per month
    
    attendance_ids = []
    total_hours = 0
    
    for day in range(work_days):
        work_date = month_date + timedelta(days=day)
        
        # Create shift
        shift_id = str(uuid.uuid4())
        shift = {
            'id': shift_id,
            'employeeId': uid,
            'employeeName': user_data['name'],
            'storeId': store_id,
            'storeName': store_data.get('name'),
            'date': work_date.date().isoformat(),
            'startTime': '09:00',
            'endTime': '17:00',
            'supervisorId': None,
            'createdAt': work_date.isoformat()
        }
        db.collection('shifts').document(shift_id).set(shift)
        
        # Create attendance (clocked out)
        attendance_id = str(uuid.uuid4())
        clock_in = work_date.replace(hour=9, minute=0)
        clock_out = work_date.replace(hour=17, minute=0)
        
        attendance = {
            'id': attendance_id,
            'employeeId': uid,
            'employeeName': user_data['name'],
            'storeId': store_id,
            'shiftId': shift_id,
            'clockInTime': clock_in.isoformat(),
            'clockOutTime': clock_out.isoformat(),
            'clockInLatitude': store_data.get('lat', 0),
            'clockInLongitude': store_data.get('lng', 0),
            'status': 'CLOCKED_OUT',
            'isLate': False,
            'minutesLate': 0,
            'createdAt': clock_in.isoformat(),
            'updatedAt': clock_out.isoformat()
        }
        db.collection('attendance').document(attendance_id).set(attendance)
        attendance_ids.append(attendance_id)
        total_hours += hours_per_day
    
    print(f"   ✅ Created {work_days} days of attendance ({total_hours} hours)")
    return attendance_ids, total_hours

# Month 1 (2 months ago) - PAID
print("\n🟢 MONTH 1 (2 months ago) - Will be marked as PAID")
month1_attendance_ids, month1_hours = create_month_attendance(month_2_ago, "Month 1")

# Create pay-run for Month 1
pay_run1_id = str(uuid.uuid4())
gross_earnings_1 = month1_hours * 60  # 60 JD/hour
pay_run1 = {
    'id': pay_run1_id,
    'employeeId': uid,
    'employeeName': user_data['name'],
    'month': month_2_ago.month,
    'year': month_2_ago.year,
    'totalHours': month1_hours,
    'grossEarnings': gross_earnings_1,
    'lateCount': 0,
    'latePenalty': 0,
    'noShowCount': 0,
    'noShowPenalty': 0,
    'netEarnings': gross_earnings_1,
    'paidBy': 'owner_uid',
    'paidByName': 'Owner',
    'paymentDate': (month_2_ago + timedelta(days=25)).isoformat(),
    'createdAt': datetime.utcnow().isoformat()
}
db.collection('pay_runs').document(pay_run1_id).set(pay_run1)
print(f"   ✅ Created pay-run: {gross_earnings_1:.2f} JD")

# Tag all Month 1 attendance as paid
for att_id in month1_attendance_ids:
    db.collection('attendance').document(att_id).update({
        'payRunId': pay_run1_id,
        'paidAt': pay_run1['paymentDate']
    })
print(f"   ✅ Tagged {len(month1_attendance_ids)} attendance records as PAID")

# Month 2 (1 month ago) - PAID
print("\n🟢 MONTH 2 (1 month ago) - Will be marked as PAID")
month2_attendance_ids, month2_hours = create_month_attendance(month_1_ago, "Month 2")

# Create pay-run for Month 2
pay_run2_id = str(uuid.uuid4())
gross_earnings_2 = month2_hours * 60
pay_run2 = {
    'id': pay_run2_id,
    'employeeId': uid,
    'employeeName': user_data['name'],
    'month': month_1_ago.month,
    'year': month_1_ago.year,
    'totalHours': month2_hours,
    'grossEarnings': gross_earnings_2,
    'lateCount': 0,
    'latePenalty': 0,
    'noShowCount': 0,
    'noShowPenalty': 0,
    'netEarnings': gross_earnings_2,
    'paidBy': 'owner_uid',
    'paidByName': 'Owner',
    'paymentDate': (month_1_ago + timedelta(days=25)).isoformat(),
    'createdAt': datetime.utcnow().isoformat()
}
db.collection('pay_runs').document(pay_run2_id).set(pay_run2)
print(f"   ✅ Created pay-run: {gross_earnings_2:.2f} JD")

# Tag all Month 2 attendance as paid
for att_id in month2_attendance_ids:
    db.collection('attendance').document(att_id).update({
        'payRunId': pay_run2_id,
        'paidAt': pay_run2['paymentDate']
    })
print(f"   ✅ Tagged {len(month2_attendance_ids)} attendance records as PAID")

# Month 3 (Current month) - UNPAID
print("\n🔴 MONTH 3 (Current month) - UNPAID")
month3_attendance_ids, month3_hours = create_month_attendance(current_month, "Month 3 (Current)")
gross_earnings_3 = month3_hours * 60
print(f"   ⚠️  NO pay-run created - remains UNPAID ({gross_earnings_3:.2f} JD)")

# Summary
print("\n" + "="*60)
print("✅ TEST DATA CREATION COMPLETE!")
print("="*60)
print(f"\n📧 Test Employee: payrolltest@gosta.com / test123456")
print(f"👤 Employee ID: {uid}")
print(f"💰 Hourly Rate: 60 JD/hour")
print(f"\n📊 PAYMENT SUMMARY:")
print(f"   Month 1 ({month_2_ago.strftime('%B %Y')}): {month1_hours}h = {gross_earnings_1:.2f} JD - ✅ PAID")
print(f"   Month 2 ({month_1_ago.strftime('%B %Y')}): {month2_hours}h = {gross_earnings_2:.2f} JD - ✅ PAID")
print(f"   Month 3 ({current_month.strftime('%B %Y')}): {month3_hours}h = {gross_earnings_3:.2f} JD - ⚠️  UNPAID")
print(f"\n💵 Total Paid: {gross_earnings_1 + gross_earnings_2:.2f} JD")
print(f"💵 Total Unpaid: {gross_earnings_3:.2f} JD")
print(f"💵 Grand Total: {gross_earnings_1 + gross_earnings_2 + gross_earnings_3:.2f} JD")
print("\n🎯 Now check the Payroll tab in your app!")
print("   - Employee will show as [Unpaid] with current month balance")
print("   - Tap 'History' to see 2 previous payments")

