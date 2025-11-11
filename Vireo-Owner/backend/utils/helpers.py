"""
Helper functions for VireoHR backend API
Consolidates duplicate logic across endpoints
"""
from fastapi import HTTPException
from typing import Optional, Dict, List, Any


def get_user_document(uid: str, firebase_db, tenant_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Fetch user document from Firestore with existence validation
    
    Args:
        uid: Firebase user ID
        firebase_db: Firestore client instance
        tenant_id: Optional tenant ID for multi-tenant filtering
        
    Returns:
        User document as dictionary
        
    Raises:
        HTTPException: 404 if user not found
        HTTPException: 403 if user belongs to different tenant
        
    Usage:
        user_data = get_user_document(uid, firebase_db, tenant_id)
    """
    user_doc = firebase_db.collection('users').document(uid).get()
    
    if not user_doc.exists:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_data = user_doc.to_dict()
    
    # Tenant isolation check
    if tenant_id is not None and user_data.get('tenantId') != tenant_id:
        raise HTTPException(status_code=403, detail="Access denied to this tenant's data")
    
    return user_data


def calculate_net_earnings(
    hours: float,
    hourly_rate: float,
    late_penalty_hours: float = 0.0,
    no_show_penalty_hours: float = 0.0
) -> Dict[str, float]:
    """
    Calculate net earnings with penalties
    
    Args:
        hours: Total hours worked
        hourly_rate: Hourly pay rate in JD
        late_penalty_hours: Hours deducted for lateness (default: 0)
        no_show_penalty_hours: Hours deducted for no-shows (default: 0)
        
    Returns:
        Dictionary with earnings breakdown:
        {
            'gross': float,           # Gross earnings before penalties
            'late_penalty': float,    # Late penalty amount
            'no_show_penalty': float, # No-show penalty amount
            'net': float              # Net earnings after penalties
        }
        
    Example:
        >>> calculate_net_earnings(40, 5.0, 1.0, 0.5)
        {
            'gross': 200.0,
            'late_penalty': 5.0,
            'no_show_penalty': 2.5,
            'net': 192.5
        }
    """
    gross = round(hours * hourly_rate, 2)
    late_penalty = round(late_penalty_hours * hourly_rate, 2)
    no_show_penalty = round(no_show_penalty_hours * hourly_rate, 2)
    net = round(gross - late_penalty - no_show_penalty, 2)
    
    return {
        'gross': gross,
        'late_penalty': late_penalty,
        'no_show_penalty': no_show_penalty,
        'net': net
    }


def get_all_employees(
    firebase_db,
    exclude_owner_for_co: bool = False,
    current_user_role: Optional[str] = None,
    tenant_id: Optional[str] = None
) -> List[Any]:
    """
    Fetch all employees from Firestore with optional CO filtering and tenant isolation
    
    Args:
        firebase_db: Firestore client instance
        exclude_owner_for_co: If True and user is CO, filter out OWNER (default: False)
        current_user_role: Current user's role (required if exclude_owner_for_co is True)
        tenant_id: Optional tenant ID for multi-tenant filtering (None = super admin)
        
    Returns:
        List of Firestore document snapshots
        
    Usage:
        # Get all employees for a tenant
        all_users = get_all_employees(firebase_db, tenant_id='uuid-123')
        
        # Get all employees (CO can't see OWNER)
        all_users = get_all_employees(
            firebase_db,
            exclude_owner_for_co=True,
            current_user_role='CO',
            tenant_id='uuid-123'
        )
    """
    # Apply tenant filter if provided
    query = firebase_db.collection('users')
    if tenant_id is not None:
        query = query.where('tenantId', '==', tenant_id)
    
    all_users = list(query.stream())
    
    # CO users cannot see OWNER accounts
    if exclude_owner_for_co and current_user_role == 'CO':
        return [
            u for u in all_users 
            if u.to_dict().get('role', '').upper() != 'OWNER'
        ]
    
    return all_users
