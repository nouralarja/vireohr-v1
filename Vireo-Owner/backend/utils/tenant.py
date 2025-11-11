"""
Multi-tenant utilities for VireoHR
Handles tenant isolation, middleware, and custom token generation
"""
from fastapi import HTTPException, Request, Depends
from firebase_admin import auth as admin_auth
from typing import Optional, Dict, Any
import uuid


class TenantMiddleware:
    """
    Middleware to inject tenantId into all Firestore queries
    Reads from JWT custom claim 'tenantId'
    """
    
    @staticmethod
    def get_tenant_id(request: Request) -> Optional[str]:
        """
        Extract tenantId from JWT token
        Returns None for unauthenticated requests
        """
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return None
        
        token = auth_header.split('Bearer ')[1]
        try:
            decoded_token = admin_auth.verify_id_token(token)
            return decoded_token.get('tenantId')
        except Exception:
            return None


async def get_current_tenant(request: Request) -> Dict[str, Any]:
    """
    FastAPI dependency to get current tenant info
    Extracts tenantId from JWT and validates
    
    Returns:
        {
            'tenantId': str,
            'role': str,
            'uid': str,
            'isSuperAdmin': bool
        }
    
    Raises:
        HTTPException: 401 if no valid token
    """
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="No token provided")
    
    token = auth_header.split('Bearer ')[1]
    try:
        decoded_token = admin_auth.verify_id_token(token)
        
        # Check for super admin
        is_super_admin = decoded_token.get('role') == 'superadmin'
        
        return {
            'tenantId': decoded_token.get('tenantId'),
            'role': decoded_token.get('role', 'EMPLOYEE'),
            'uid': decoded_token.get('uid'),
            'isSuperAdmin': is_super_admin
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


def filter_by_tenant(query, tenant_id: Optional[str], field_name: str = 'tenantId'):
    """
    Apply tenant filter to Firestore query
    Skip filter if tenant_id is None (super admin)
    
    Args:
        query: Firestore query object
        tenant_id: Tenant ID to filter by (None = no filter)
        field_name: Field name for tenant ID (default: 'tenantId')
    
    Returns:
        Filtered query or original query if tenant_id is None
    
    Usage:
        query = firebase_db.collection('users')
        query = filter_by_tenant(query, tenant_id)
        users = list(query.stream())
    """
    if tenant_id is not None:
        return query.where(field_name, '==', tenant_id)
    return query


def create_tenant_document(firebase_db, owner_email: str, business_name: str) -> str:
    """
    Create a new tenant document in Firestore
    
    Args:
        firebase_db: Firestore client
        owner_email: Owner's email address
        business_name: Business/tenant name
    
    Returns:
        tenantId (UUID string)
    """
    from datetime import datetime, timedelta
    import pytz
    
    tenant_id = str(uuid.uuid4())
    
    tenant_doc = {
        'tenantId': tenant_id,
        'name': business_name,
        'ownerEmail': owner_email,
        'status': 'active',
        'subscriptionEnd': (datetime.now(pytz.UTC) + timedelta(days=30)).isoformat(),
        'createdAt': datetime.now(pytz.UTC).isoformat(),
        'updatedAt': datetime.now(pytz.UTC).isoformat()
    }
    
    firebase_db.collection('tenants').document(tenant_id).set(tenant_doc)
    
    return tenant_id


def create_custom_token_with_tenant(uid: str, tenant_id: str, role: str = 'OWNER') -> str:
    """
    Create Firebase custom token with tenantId claim
    
    Args:
        uid: Firebase user ID
        tenant_id: Tenant ID to embed in token
        role: User role (default: 'OWNER')
    
    Returns:
        Custom token string
    """
    custom_claims = {
        'tenantId': tenant_id,
        'role': role
    }
    
    return admin_auth.create_custom_token(uid, custom_claims).decode('utf-8')


def set_user_custom_claims(uid: str, tenant_id: str, role: str):
    """
    Set custom claims on Firebase user
    
    Args:
        uid: Firebase user ID
        tenant_id: Tenant ID
        role: User role
    """
    admin_auth.set_custom_user_claims(uid, {
        'tenantId': tenant_id,
        'role': role
    })
