#!/usr/bin/env python3
"""
VireoHR Multi-Tenant Migration Script

This script:
1. Creates a default tenant from the first OWNER user found
2. Adds tenantId field to all existing Firestore documents
3. Sets custom claims with tenantId for all users

Usage:
    python3 scripts/migrate_multi_tenant.py

Prerequisites:
    - Firebase Admin SDK credentials must be configured
    - Run from project root directory
    - Backup your Firestore database before running!
"""

import sys
import os
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / 'backend'))

import firebase_admin
from firebase_admin import credentials, firestore, auth as admin_auth
from datetime import datetime, timedelta
import pytz
import uuid
import json
from dotenv import load_dotenv

# Load environment variables
env_path = Path(__file__).parent.parent / 'backend' / '.env'
load_dotenv(env_path)

print("=" * 60)
print("VireoHR Multi-Tenant Migration Script")
print("=" * 60)
print()

# Initialize Firebase Admin
try:
    firebase_creds = os.getenv('FIREBASE_SERVICE_ACCOUNT_KEY')
    if firebase_creds:
        cred_dict = json.loads(firebase_creds)
        cred = credentials.Certificate(cred_dict)
        print("✓ Firebase credentials loaded from environment variable")
    else:
        # Fallback to file for local development
        cred_file = Path(__file__).parent.parent / 'backend' / 'firebase-service-account.json'
        if cred_file.exists():
            cred = credentials.Certificate(str(cred_file))
            print("✓ Firebase credentials loaded from file")
        else:
            raise Exception("No Firebase credentials found")
    
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("✓ Firebase Admin initialized successfully")
    print()
except Exception as e:
    print(f"✗ Firebase initialization error: {e}")
    sys.exit(1)


def create_default_tenant(db):
    """
    Create default tenant from first OWNER user
    Returns: tenant_id (str)
    """
    print("Step 1: Creating default tenant...")
    print("-" * 60)
    
    # Find first OWNER user
    users = list(db.collection('users').where('role', '==', 'OWNER').limit(1).stream())
    
    if not users:
        print("✗ No OWNER user found. Please create an owner first.")
        sys.exit(1)
    
    owner = users[0]
    owner_data = owner.to_dict()
    owner_email = owner_data.get('email', 'unknown@example.com')
    owner_name = owner_data.get('name', 'Default Business')
    
    print(f"  Found OWNER: {owner_email}")
    
    # Check if tenant already exists
    existing_tenants = list(db.collection('tenants').where('ownerEmail', '==', owner_email).limit(1).stream())
    
    if existing_tenants:
        tenant = existing_tenants[0]
        tenant_id = tenant.to_dict().get('tenantId')
        print(f"  ℹ Tenant already exists: {tenant_id}")
        return tenant_id, owner.id
    
    # Create new tenant
    tenant_id = str(uuid.uuid4())
    
    tenant_doc = {
        'tenantId': tenant_id,
        'name': f"{owner_name}'s Business",
        'ownerEmail': owner_email,
        'status': 'active',
        'subscriptionEnd': (datetime.now(pytz.UTC) + timedelta(days=365)).isoformat(),
        'createdAt': datetime.now(pytz.UTC).isoformat(),
        'updatedAt': datetime.now(pytz.UTC).isoformat()
    }
    
    db.collection('tenants').document(tenant_id).set(tenant_doc)
    
    print(f"  ✓ Created tenant: {tenant_id}")
    print(f"  ✓ Business name: {tenant_doc['name']}")
    print(f"  ✓ Subscription valid until: {tenant_doc['subscriptionEnd'][:10]}")
    print()
    
    return tenant_id, owner.id


def backfill_tenant_id(db, tenant_id, collection_name):
    """
    Add tenantId field to all documents in a collection
    """
    print(f"  Processing collection: {collection_name}")
    
    docs = list(db.collection(collection_name).stream())
    
    if not docs:
        print(f"    ℹ No documents found in {collection_name}")
        return
    
    count = 0
    for doc in docs:
        doc_data = doc.to_dict()
        
        # Skip if tenantId already exists
        if 'tenantId' in doc_data:
            continue
        
        # Add tenantId
        db.collection(collection_name).document(doc.id).update({
            'tenantId': tenant_id
        })
        count += 1
    
    print(f"    ✓ Updated {count} documents (skipped {len(docs) - count} existing)")


def set_custom_claims(db, tenant_id, owner_uid):
    """
    Set custom claims with tenantId for all users
    """
    print("Step 3: Setting custom claims for users...")
    print("-" * 60)
    
    users = list(db.collection('users').stream())
    
    for user_doc in users:
        user_data = user_doc.to_dict()
        uid = user_doc.id
        role = user_data.get('role', 'EMPLOYEE')
        
        try:
            admin_auth.set_custom_user_claims(uid, {
                'tenantId': tenant_id,
                'role': role
            })
            
            status = "OWNER" if uid == owner_uid else role
            print(f"  ✓ Set claims for {user_data.get('email', 'unknown')} ({status})")
        except Exception as e:
            print(f"  ✗ Failed to set claims for {uid}: {str(e)}")
    
    print()


def main():
    """Main migration function"""
    
    # Step 1: Create default tenant
    tenant_id, owner_uid = create_default_tenant(db)
    
    # Step 2: Backfill tenantId on all collections
    print("Step 2: Backfilling tenantId on existing documents...")
    print("-" * 60)
    
    collections = [
        'users',
        'stores',
        'shifts',
        'attendance',
        'ingredients',
        'ingredient_counts',
        'leave_requests',
        'payment_history'
    ]
    
    for collection_name in collections:
        backfill_tenant_id(db, tenant_id, collection_name)
    
    print()
    
    # Step 3: Set custom claims
    set_custom_claims(db, tenant_id, owner_uid)
    
    # Summary
    print("=" * 60)
    print("Migration Complete!")
    print("=" * 60)
    print()
    print(f"Default Tenant ID: {tenant_id}")
    print()
    print("Next steps:")
    print("1. Test login with existing users - they should have tenantId in token")
    print("2. Create a super admin user with role='superadmin' (manual)")
    print("3. Test creating new tenants via signup endpoint")
    print("4. Update frontend to use tenant context")
    print()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n✗ Migration cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n✗ Migration failed: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
