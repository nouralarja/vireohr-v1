import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timedelta
import uuid

# Initialize Firebase
cred = credentials.Certificate('/app/backend/firebase-service-account.json')
try:
    firebase_admin.get_app()
except ValueError:
    firebase_admin.initialize_app(cred)

db = firestore.client()

# Get all stores
stores = list(db.collection('stores').stream())
print(f"Found {len(stores)} stores")

# Get all employees (excluding owners/accountants)
all_users = list(db.collection('users').stream())
employees = [u for u in all_users if u.to_dict().get('role') in ['EMPLOYEE', 'MANAGER']]
print(f"Found {len(employees)} employees")

if len(stores) == 0:
    print("❌ No stores found!")
    exit(1)

if len(employees) == 0:
    print("❌ No employees found!")
    exit(1)

# Current time
now = datetime.utcnow()
today = now.date().isoformat()

# Shift times (started 2 hours ago, ends in 6 hours)
shift_start = (now - timedelta(hours=2)).replace(minute=0, second=0, microsecond=0)
shift_end = (now + timedelta(hours=6)).replace(minute=0, second=0, microsecond=0)

print(f"\nCreating shifts for today: {today}")
print(f"Shift time: {shift_start.strftime('%H:%M')} - {shift_end.strftime('%H:%M')}")
print("="*60)

# Assign 1-2 employees per store
employee_index = 0
created_count = 0

for store in stores:
    store_data = store.to_dict()
    store_name = store_data.get('name', 'Unknown')
    
    # Assign 1-2 employees to this store (wrap around if not enough employees)
    num_employees = min(2, len(employees))
    
    for i in range(num_employees):
        if employee_index >= len(employees):
            employee_index = 0  # Wrap around
        
        employee = employees[employee_index]
        employee_data = employee.to_dict()
        
        # Create shift
        shift_id = str(uuid.uuid4())
        shift = {
            'id': shift_id,
            'employeeId': employee.id,
            'employeeName': employee_data.get('name', 'Unknown'),
            'storeId': store.id,
            'storeName': store_name,
            'date': today,
            'startTime': shift_start.strftime('%H:%M'),
            'endTime': shift_end.strftime('%H:%M'),
            'supervisorId': employee.id if i == 0 else None,  # First employee is supervisor
            'createdAt': now.isoformat()
        }
        db.collection('shifts').document(shift_id).set(shift)
        
        # Create attendance (clocked in)
        attendance_id = str(uuid.uuid4())
        attendance = {
            'id': attendance_id,
            'employeeId': employee.id,
            'employeeName': employee_data.get('name', 'Unknown'),
            'storeId': store.id,
            'shiftId': shift_id,
            'clockInTime': shift_start.isoformat(),
            'clockInLatitude': store_data.get('lat', 0),
            'clockInLongitude': store_data.get('lng', 0),
            'status': 'CLOCKED_IN',
            'isLate': False,
            'minutesLate': 0,
            'createdAt': shift_start.isoformat(),
            'updatedAt': shift_start.isoformat()
        }
        db.collection('attendance').document(attendance_id).set(attendance)
        
        role = "Supervisor" if i == 0 else "Employee"
        print(f"✅ {store_name}: {employee_data.get('name')} ({role})")
        
        employee_index += 1
        created_count += 1

print("="*60)
print(f"\n🎉 Created {created_count} active shifts across {len(stores)} stores!")
print(f"All employees are currently CLOCKED IN")
print(f"Shift ends at: {shift_end.strftime('%H:%M')}")
print("\nNow check the Attendance tab in your app!")

