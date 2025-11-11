#!/usr/bin/env python3
import firebase_admin
from firebase_admin import credentials, firestore

# Initialize Firebase
cred = credentials.Certificate('/app/backend/firebase-service-account.json')
try:
    firebase_admin.get_app()
except ValueError:
    firebase_admin.initialize_app(cred)

db = firestore.client()

# New coordinates (lat/lng)
NEW_LAT = 32.077236
NEW_LNG = 36.1021849

print("="*60)
print("UPDATING STORE LOCATION TO NEW COORDINATES")
print("="*60)

# Update first store to your location
stores = list(db.collection('stores').limit(1).stream())
if not stores:
    print("❌ No stores found!")
    exit(1)

store = stores[0]
store_data = store.to_dict()

# Update store location
db.collection('stores').document(store.id).update({
    'lat': NEW_LAT,
    'lng': NEW_LNG
})

print(f"\n🏪 Store: {store_data.get('name')}")
print(f"📍 Updated Location:")
print(f"   Latitude: {NEW_LAT}")
print(f"   Longitude: {NEW_LNG}")
print(f"🔒 Geofence Radius: 10 meters")
print("\n✅ Store location updated successfully!")
print("="*60)
