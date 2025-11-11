#!/usr/bin/env python3
"""
Script to create test shift with supervisor and ingredient counts
"""
import firebase_admin
from firebase_admin import credentials, auth, firestore
from pathlib import Path
from datetime import datetime, timedelta
import uuid

# Initialize Firebase Admin
ROOT_DIR = Path(__file__).parent
cred = credentials.Certificate(ROOT_DIR / 'backend' / 'firebase-service-account.json')

# Check if already initialized
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)

db = firestore.client()

def create_test_data():
    """Create test shift with supervisor and ingredient counts"""
    
    print("\n" + "="*60)
    print("CREATING TEST DATA FOR CSV EXPORT")
    print("="*60)
    
    # Get stores
    stores = list(db.collection('stores').limit(1).stream())
    if not stores:
        print("❌ No stores found. Please create a store first.")
        return
    
    store = stores[0]
    store_data = store.to_dict()
    print(f"\n✅ Using Store: {store_data.get('name')} (ID: {store.id})")
    
    # Get ingredients for this store
    ingredients = list(db.collection('ingredients').where('storeId', '==', store.id).stream())
    if not ingredients:
        print("❌ No ingredients found for this store. Creating test ingredient...")
        
        # Create test ingredient
        ingredient_id = str(uuid.uuid4())
        ingredient_data = {
            'id': ingredient_id,
            'name': 'Test Flour',
            'storeId': store.id,
            'countType': 'BOX',
            'unitsPerBox': 12,
            'lowStockThreshold': 10,
            'createdAt': datetime.utcnow().isoformat(),
            'updatedAt': datetime.utcnow().isoformat()
        }
        db.collection('ingredients').document(ingredient_id).set(ingredient_data)
        print(f"✅ Created ingredient: Test Flour (12 units per box)")
        
        # Create a mock object
        class MockIngredient:
            def __init__(self, id, data):
                self.id = id
                self._data = data
            def to_dict(self):
                return self._data
        
        ingredient = MockIngredient(ingredient_id, ingredient_data)
        ingredients = [ingredient]
    else:
        print(f"✅ Found {len(ingredients)} ingredients")
    
    ingredient = ingredients[0]
    ingredient_data = ingredient.to_dict()
    print(f"   Using: {ingredient_data.get('name')}")
    
    # Get employees for this store (or any employees if none assigned)
    employees = list(db.collection('users').where('assignedStoreId', '==', store.id).stream())
    
    if len(employees) < 2:
        print(f"⚠️  Only {len(employees)} employees assigned to this store. Looking for any employees...")
        all_employees = list(db.collection('users').where('isActive', '==', True).limit(2).stream())
        
        if len(all_employees) < 2:
            print("❌ Need at least 2 active employees in the system.")
            return
        
        # Assign them to this store
        for emp in all_employees[:2]:
            db.collection('users').document(emp.id).update({
                'assignedStoreId': store.id
            })
            print(f"   ✅ Assigned {emp.to_dict().get('name')} to {store_data.get('name')}")
        
        employees = all_employees[:2]
    
    employee = employees[0]
    supervisor = employees[1]
    
    employee_data = employee.to_dict()
    supervisor_data = supervisor.to_dict()
    
    print(f"\n✅ Employee: {employee_data.get('name')}")
    print(f"✅ Supervisor: {supervisor_data.get('name')}")
    
    # Create shift for today
    today = datetime.now().strftime('%Y-%m-%d')
    shift_id = str(uuid.uuid4())
    
    shift_data = {
        'id': shift_id,
        'storeId': store.id,
        'employeeId': employee.id,
        'employeeName': employee_data.get('name'),
        'employeeRole': employee_data.get('role', 'EMPLOYEE'),
        'supervisorId': supervisor.id,
        'supervisorName': supervisor_data.get('name'),
        'date': today,
        'startTime': '09:00',
        'endTime': '17:00',
        'createdAt': datetime.utcnow().isoformat(),
        'updatedAt': datetime.utcnow().isoformat()
    }
    
    db.collection('shifts').document(shift_id).set(shift_data)
    print(f"\n✅ Created Shift: {today} 09:00-17:00")
    print(f"   Supervisor: {supervisor_data.get('name')}")
    
    # Create attendance record
    attendance_id = str(uuid.uuid4())
    attendance_data = {
        'id': attendance_id,
        'employeeId': supervisor.id,
        'employeeName': supervisor_data.get('name'),
        'shiftId': shift_id,
        'storeId': store.id,
        'clockInTime': datetime.utcnow().isoformat(),
        'status': 'CLOCKED_IN',
        'createdAt': datetime.utcnow().isoformat(),
        'updatedAt': datetime.utcnow().isoformat()
    }
    
    db.collection('attendance').document(attendance_id).set(attendance_data)
    print(f"✅ Created Attendance record for supervisor")
    
    # Create ingredient counts
    units_per_box = ingredient_data.get('unitsPerBox', 1)
    
    # First Count: 5 boxes, 3 units
    first_count_id = str(uuid.uuid4())
    first_count_data = {
        'id': first_count_id,
        'attendanceId': attendance_id,
        'ingredientId': ingredient.id,
        'storeId': store.id,
        'supervisorId': supervisor.id,
        'countType': 'FIRST',
        'boxes': 5,
        'units': 3,
        'timestamp': datetime.utcnow().isoformat()
    }
    db.collection('ingredient_counts').document(first_count_id).set(first_count_data)
    total_first = (5 * units_per_box) + 3
    print(f"\n✅ Created FIRST Count: 5 boxes, 3 units (Total: {total_first})")
    
    # Add Count: 2 boxes, 0 units
    add_count_id = str(uuid.uuid4())
    add_count_data = {
        'id': add_count_id,
        'attendanceId': attendance_id,
        'ingredientId': ingredient.id,
        'storeId': store.id,
        'supervisorId': supervisor.id,
        'countType': 'ADD',
        'boxes': 2,
        'units': 0,
        'timestamp': (datetime.utcnow() + timedelta(hours=1)).isoformat()
    }
    db.collection('ingredient_counts').document(add_count_id).set(add_count_data)
    total_add = (2 * units_per_box)
    print(f"✅ Created ADD Count: 2 boxes (Total: {total_add})")
    
    # Final Count: 7 boxes, 3 units
    final_count_id = str(uuid.uuid4())
    final_count_data = {
        'id': final_count_id,
        'attendanceId': attendance_id,
        'ingredientId': ingredient.id,
        'storeId': store.id,
        'supervisorId': supervisor.id,
        'countType': 'FINAL',
        'boxes': 7,
        'units': 3,
        'timestamp': (datetime.utcnow() + timedelta(hours=2)).isoformat()
    }
    db.collection('ingredient_counts').document(final_count_id).set(final_count_data)
    total_final = (7 * units_per_box) + 3
    print(f"✅ Created FINAL Count: 7 boxes, 3 units (Total: {total_final})")
    
    print("\n" + "="*60)
    print("✅ TEST DATA CREATED SUCCESSFULLY!")
    print("="*60)
    print(f"\n📊 TO TEST CSV EXPORT:")
    print(f"1. Log in as Owner/CO/Accountant")
    print(f"2. Go to Reports tab")
    print(f"3. Select store: {store_data.get('name')}")
    print(f"4. Click 'Export Ingredients'")
    print(f"5. You should see:")
    print(f"   - Store: {store_data.get('name')}")
    print(f"   - Shift: {today}")
    print(f"   - Supervisor: {supervisor_data.get('name')}")
    print(f"   - Ingredient: {ingredient_data.get('name')}")
    print(f"   - First Count: 5 boxes, 3 units ({total_first} total)")
    print(f"   - Added: 2 boxes ({total_add} total)")
    print(f"   - Final Count: 7 boxes, 3 units ({total_final} total)")
    print("="*60)

if __name__ == "__main__":
    create_test_data()
