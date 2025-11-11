import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timedelta
import random

# Initialize Firebase
cred = credentials.Certificate('/app/backend/firebase-service-account.json')
try:
    firebase_admin.initialize_app(cred)
except:
    pass

db = firestore.client()

print("🌱 Starting seed data creation...")

# Create test stores with geolocation
stores_data = [
    {
        'name': 'Downtown Branch',
        'address': '123 Main St, Amman',
        'lat': 31.9539,
        'lng': 35.9106,
        'radius': 10,
        'phone': '+962791234567',
        'isActive': True
    },
    {
        'name': 'Abdali Mall Store',
        'address': 'Abdali Mall, Amman',
        'lat': 31.9629,
        'lng': 35.9116,
        'radius': 10,
        'phone': '+962791234568',
        'isActive': True
    },
    {
        'name': 'Airport Road Branch',
        'address': 'Queen Alia Airport Rd',
        'lat': 31.7229,
        'lng': 35.9932,
        'radius': 10,
        'phone': '+962791234569',
        'isActive': True
    }
]

store_ids = []
for store_data in stores_data:
    store_ref = db.collection('stores').document()
    store_data['id'] = store_ref.id
    store_data['createdAt'] = datetime.utcnow().isoformat()
    store_data['updatedAt'] = datetime.utcnow().isoformat()
    store_ref.set(store_data)
    store_ids.append(store_ref.id)
    print(f"✓ Created store: {store_data['name']}")

# Get existing users
users_ref = db.collection('users')
users = list(users_ref.stream())

if len(users) > 0:
    # Assign first user to first store
    first_user = users[0]
    db.collection('users').document(first_user.id).update({
        'assignedStoreId': store_ids[0]
    })
    user_data = first_user.to_dict()
    print(f"✓ Assigned {user_data.get('name', 'User')} to {stores_data[0]['name']}")

    # Create 2 weeks of shifts
    start_date = datetime.now()
    times = [
        ('08:00', '16:00'),
        ('16:00', '00:00'),
        ('00:00', '08:00')
    ]

    shift_count = 0
    for day_offset in range(14):  # 2 weeks
        shift_date = (start_date + timedelta(days=day_offset)).strftime('%Y-%m-%d')
        
        for store_id in store_ids:
            # Assign 2-3 employees per store per day
            employees_per_day = random.sample(users, min(3, len(users)))
            
            for user, (start_time, end_time) in zip(employees_per_day, times):
                user_data = user.to_dict()
                shift_ref = db.collection('shifts').document()
                shift_data = {
                    'id': shift_ref.id,
                    'storeId': store_id,
                    'employeeId': user.id,
                    'employeeName': user_data.get('name', 'Unknown'),
                    'employeeRole': user_data.get('role', 'EMPLOYEE'),
                    'date': shift_date,
                    'startTime': start_time,
                    'endTime': end_time,
                    'createdAt': datetime.utcnow().isoformat(),
                    'updatedAt': datetime.utcnow().isoformat()
                }
                shift_ref.set(shift_data)
                shift_count += 1

    print(f"✓ Created {shift_count} shifts for 2 weeks")

    # Create sample ingredients for each store
    ingredients = ['Flour', 'Sugar', 'Salt', 'Oil', 'Milk', 'Eggs', 'Butter', 'Yeast']
    ing_count = 0
    for store_id in store_ids:
        for ing_name in ingredients:
            ing_ref = db.collection('ingredients').document()
            ing_data = {
                'id': ing_ref.id,
                'storeId': store_id,
                'name': ing_name,
                'countType': random.choice(['BOX', 'UNIT']),
                'boxesPerUnit': random.choice([12, 24, 36]),
                'lowStockThreshold': 10,
                'createdAt': datetime.utcnow().isoformat(),
                'updatedAt': datetime.utcnow().isoformat()
            }
            ing_ref.set(ing_data)
            ing_count += 1

    print(f"✓ Created {ing_count} ingredients")

print("\n🎉 Seed data complete!")
print(f"   - {len(stores_data)} stores")
print(f"   - {shift_count if len(users) > 0 else 0} shifts (2 weeks)")
print(f"   - {ing_count if len(users) > 0 else 0} ingredients")
