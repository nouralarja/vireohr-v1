#!/usr/bin/env python3
"""
Update store location to user's current coordinates for geofencing testing
"""

import firebase_admin
from firebase_admin import credentials, firestore
from pathlib import Path

# Initialize Firebase
ROOT_DIR = Path(__file__).parent
cred = credentials.Certificate(ROOT_DIR / 'backend' / 'firebase-service-account.json')
try:
    firebase_admin.get_app()
except ValueError:
    firebase_admin.initialize_app(cred)

db = firestore.client()

# User's exact coordinates
USER_LAT = 32.076862
USER_LNG = 36.102066

def update_store_location():
    """Update the test store to user's current location"""
    
    # Get the الوينك store
    store_id = "22d8c11e-9b9f-4255-a046-f0dad4029deb"
    store_ref = db.collection('stores').document(store_id)
    store_doc = store_ref.get()
    
    if not store_doc.exists:
        print("❌ Store not found!")
        return
    
    store_data = store_doc.to_dict()
    old_lat = store_data.get('lat')
    old_lng = store_data.get('lng')
    
    print("🎯 UPDATING STORE LOCATION FOR GEOFENCING TEST")
    print("="*70)
    print(f"\n📍 Store: {store_data.get('name')}")
    print(f"\n⚠️  OLD Location:")
    print(f"   Latitude:  {old_lat}")
    print(f"   Longitude: {old_lng}")
    
    # Update to user's location
    store_ref.update({
        'lat': USER_LAT,
        'lng': USER_LNG,
        'radius': 10  # Keep 10 meter radius for accurate testing
    })
    
    print(f"\n✅ NEW Location (Your current position):")
    print(f"   Latitude:  {USER_LAT}")
    print(f"   Longitude: {USER_LNG}")
    print(f"   Radius: 10 meters")
    
    print("\n" + "="*70)
    print("GEOFENCING NOW CONFIGURED TO YOUR LOCATION!")
    print("="*70)
    
    print("\n📱 TEST INSTRUCTIONS:")
    print("\n1. Stay at your current location")
    print("2. Login as: geotest@gosta.com / vireohr123")
    print("3. Go to Clock tab")
    print("4. Tap 'Clock In'")
    print("5. Grant location permission")
    print("6. Result: ✅ Should succeed (you're at the store!)")
    
    print("\n7. Walk 20+ meters away")
    print("8. Try clocking in again")
    print("9. Result: ❌ Should fail with distance error")
    
    print("\n" + "="*70)
    print("🔄 TO RESTORE ORIGINAL LOCATION:")
    print("="*70)
    print(f"Run this command after testing:")
    print(f"python3 restore_store_location.py")
    print()

def create_restore_script():
    """Create a script to restore original location"""
    old_coords = {
        'lat': 31.9539,
        'lng': 35.9106
    }
    
    restore_script = f"""#!/usr/bin/env python3
import firebase_admin
from firebase_admin import credentials, firestore
from pathlib import Path

ROOT_DIR = Path(__file__).parent
cred = credentials.Certificate(ROOT_DIR / 'backend' / 'firebase-service-account.json')
try:
    firebase_admin.get_app()
except ValueError:
    firebase_admin.initialize_app(cred)

db = firestore.client()

# Restore original coordinates
store_id = "22d8c11e-9b9f-4255-a046-f0dad4029deb"
store_ref = db.collection('stores').document(store_id)

store_ref.update({{
    'lat': {old_coords['lat']},
    'lng': {old_coords['lng']},
    'radius': 10
}})

print("✅ Store location restored to original coordinates")
print(f"   Latitude:  {old_coords['lat']}")
print(f"   Longitude: {old_coords['lng']}")
"""
    
    with open('/app/restore_store_location.py', 'w') as f:
        f.write(restore_script)
    
    print("✅ Created restore_store_location.py for later use")

if __name__ == "__main__":
    update_store_location()
    create_restore_script()
