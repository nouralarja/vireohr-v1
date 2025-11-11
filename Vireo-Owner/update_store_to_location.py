import firebase_admin
from firebase_admin import credentials, firestore
import sys

# Initialize Firebase
cred = credentials.Certificate('/app/backend/firebase-service-account.json')
try:
    firebase_admin.get_app()
except ValueError:
    firebase_admin.initialize_app(cred)

db = firestore.client()

print("="*60)
print("UPDATE STORE LOCATION FOR GEOFENCING TEST")
print("="*60)

# Get first store
stores = list(db.collection('stores').limit(1).stream())
if not stores:
    print("❌ No stores found!")
    exit(1)

store = stores[0]
store_data = store.to_dict()

print(f"\n🏪 Store: {store_data.get('name')}")
print(f"📍 Current Location: {store_data.get('lat', 0):.6f}, {store_data.get('lng', 0):.6f}")

print("\n" + "-"*60)
print("Enter your current GPS coordinates:")
print("(You can get these from Google Maps or your phone)")
print("-"*60)

try:
    lat_str = input("\n📍 Enter Latitude (e.g., 31.963158): ").strip()
    lng_str = input("📍 Enter Longitude (e.g., 35.930359): ").strip()
    
    new_lat = float(lat_str)
    new_lng = float(lng_str)
    
    # Validate coordinates
    if not (-90 <= new_lat <= 90):
        print("❌ Invalid latitude! Must be between -90 and 90")
        exit(1)
    
    if not (-180 <= new_lng <= 180):
        print("❌ Invalid longitude! Must be between -180 and 180")
        exit(1)
    
    # Create backup script
    backup_script = f"""#!/usr/bin/env python3
import firebase_admin
from firebase_admin import credentials, firestore

cred = credentials.Certificate('/app/backend/firebase-service-account.json')
try:
    firebase_admin.get_app()
except ValueError:
    firebase_admin.initialize_app(cred)

db = firestore.client()

# Restore original location
db.collection('stores').document('{store.id}').update({{
    'lat': {store_data.get('lat', 0)},
    'lng': {store_data.get('lng', 0)}
}})

print("✅ Store location restored to original coordinates")
print(f"📍 {store_data.get('name')}: {store_data.get('lat', 0):.6f}, {store_data.get('lng', 0):.6f}")
"""
    
    with open('/app/restore_store_location.py', 'w') as f:
        f.write(backup_script)
    
    # Update store location
    db.collection('stores').document(store.id).update({
        'lat': new_lat,
        'lng': new_lng
    })
    
    print("\n" + "="*60)
    print("✅ STORE LOCATION UPDATED!")
    print("="*60)
    print(f"\n🏪 Store: {store_data.get('name')}")
    print(f"📍 New Location: {new_lat:.6f}, {new_lng:.6f}")
    print(f"🔒 Geofence Radius: 10 meters")
    
    print("\n" + "-"*60)
    print("⚠️  IMPORTANT:")
    print("-"*60)
    print("To restore original location later, run:")
    print("   python /app/restore_store_location.py")
    
    print("\n" + "="*60)
    print("NOW TEST GEOFENCING:")
    print("="*60)
    print("\n1️⃣  Stay at your current location")
    print("2️⃣  Open app → Sign in: geotest@vireohr.com / test123456")
    print("3️⃣  Go to Clock tab")
    print("4️⃣  Allow location permissions when prompted")
    print("5️⃣  Tap 'Clock In'")
    print("6️⃣  ✅ Should succeed (you're at the store location)")
    print("\n7️⃣  Walk 15+ meters away")
    print("8️⃣  Try 'Clock In' again")
    print("9️⃣  ❌ Should fail with distance error")
    
except ValueError:
    print("❌ Invalid input! Please enter valid decimal numbers")
    exit(1)
except KeyboardInterrupt:
    print("\n\n❌ Cancelled")
    exit(1)

