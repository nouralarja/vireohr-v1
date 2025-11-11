#!/usr/bin/env python3
import firebase_admin
from firebase_admin import credentials, firestore

cred = credentials.Certificate('/app/backend/firebase-service-account.json')
try:
    firebase_admin.get_app()
except ValueError:
    firebase_admin.initialize_app(cred)

db = firestore.client()

# Restore original location
db.collection('stores').document('174afe49-8596-4242-9b27-9b04629be544').update({
    'lat': 32.07685088999998,
    'lng': 36.102073659999995
})

print("✅ Store location restored to original coordinates")
print(f"📍 الوينك : 32.076851, 36.102074")
