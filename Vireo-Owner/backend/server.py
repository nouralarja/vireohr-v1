from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta, time
import firebase_admin
from firebase_admin import credentials, firestore, auth as admin_auth
import os
import json
from dotenv import load_dotenv
import pytz
import uuid
import math

# Import helper functions
from utils.helpers import get_user_document, calculate_net_earnings, get_all_employees

load_dotenv()

# Initialize FastAPI app
app = FastAPI()
api_router = FastAPI()

# CORS middleware - Production-ready with env-based origins
cors_origins_str = os.getenv("CORS_ORIGINS", "https://vireohr.app,http://localhost:3000")
cors_origins = [origin.strip() for origin in cors_origins_str.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Firebase Admin - SECURE: Load from environment variable
try:
    # Try to load from environment variable first (production)
    firebase_creds = os.getenv('FIREBASE_SERVICE_ACCOUNT_KEY')
    if firebase_creds:
        cred_dict = json.loads(firebase_creds)
        cred = credentials.Certificate(cred_dict)
        print("✓ Firebase credentials loaded from environment variable")
    else:
        # Fallback to file for local development only
        from pathlib import Path
        ROOT_DIR = Path(__file__).parent
        cred_file = ROOT_DIR / 'firebase-service-account.json'
        if cred_file.exists():
            cred = credentials.Certificate(str(cred_file))
            print("⚠ Firebase credentials loaded from file (dev mode)")
        else:
            raise Exception("No Firebase credentials found")
    
    firebase_admin.initialize_app(cred)
    firebase_db = firestore.client()
    print("✓ Firebase Admin initialized successfully")
except Exception as e:
    print(f"✗ Firebase initialization error: {e}")
    raise

# Timezone configuration
TIMEZONE = pytz.timezone('Asia/Amman')  # GMT+03:00 (Jordan)

def get_current_time():
    """Get current time in configured timezone"""
    return datetime.now(TIMEZONE)

# Pydantic models
class UserCreate(BaseModel):
    email: str
    password: str = "gosta123"  # Default password if not provided
    name: str
    role: str
    assignedStoreId: Optional[str] = None

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    assignedStoreId: Optional[str] = None
    salary: Optional[float] = None

class StoreCreate(BaseModel):
    name: str
    address: str
    phone: Optional[str] = None
    lat: float = 31.9539
    lng: float = 35.9106
    radius: int = 10

class ShiftCreate(BaseModel):
    employeeId: str
    employeeName: str
    employeeRole: str
    storeId: str
    storeName: str
    date: str
    startTime: str
    endTime: str
    supervisorId: Optional[str] = None

class ClockInRequest(BaseModel):
    shiftId: str
    lat: float
    lng: float

class ClockOutRequest(BaseModel):
    attendanceId: str
    lat: float
    lng: float

class IngredientCreate(BaseModel):
    name: str
    storeId: str
    countType: str = 'BOX'
    unitsPerBox: int = 1
    lowStockThreshold: float = 10.0

class IngredientCountCreate(BaseModel):
    ingredientId: str
    storeId: str
    countType: str
    value: float

class LeaveRequestCreate(BaseModel):
    date: str
    reason: str
    type: str = 'leave'

class LeaveStatusUpdate(BaseModel):
    status: str

class PaymentRecord(BaseModel):
    employeeId: str
    month: int
    year: int

# Authentication dependency
async def verify_token(request: Request):
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="No token provided")
    
    token = auth_header.split('Bearer ')[1]
    try:
        decoded_token = admin_auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")

# Role-based access control
def require_role(allowed_roles: list):
    async def role_checker(token: dict = Depends(verify_token)):
        uid = token['uid']
        
        # Extract tenantId from token (custom claim)
        tenant_id = token.get('tenantId')
        
        # Check for super admin bypass (no tenant filtering)
        is_super_admin = token.get('role') == 'superadmin'
        tenant_filter = None if is_super_admin else tenant_id
        
        user_data = get_user_document(uid, firebase_db, tenant_filter)
        user_role = user_data.get('role', '').upper()
        
        # Normalize allowed roles to uppercase
        normalized_allowed = [r.upper() for r in allowed_roles]
        
        if user_role not in normalized_allowed and not is_super_admin:
            raise HTTPException(status_code=403, detail=f"Access denied. Required roles: {', '.join(normalized_allowed)}")
        
        return {**user_data, 'uid': uid, 'tenantId': tenant_id, 'isSuperAdmin': is_super_admin}
    
    return role_checker

# Geofencing helper
def calculate_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance between two coordinates using Haversine formula (in meters)"""
    R = 6371000  # Earth's radius in meters
    
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)
    
    a = math.sin(delta_phi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

# Routes
@api_router.get("/")
async def health_check():
    return {"status": "ok", "service": "Gosta Employee Analysis API", "version": "1.0.0"}

# ==================== USER/EMPLOYEE ROUTES ====================

@api_router.post("/users")
async def create_user(user_data: UserCreate, current_user: dict = Depends(require_role(['OWNER']))):
    """Create a new user - OWNER only"""
    try:
        # Create user in Firebase Auth
        user = admin_auth.create_user(
            email=user_data.email,
            password=user_data.password,
            display_name=user_data.name
        )
        
        # Store user data in Firestore
        user_doc = {
            'email': user_data.email,
            'name': user_data.name,
            'role': user_data.role.upper(),
            'assignedStoreId': user_data.assignedStoreId,
            'createdAt': get_current_time().isoformat(),
            'updatedAt': get_current_time().isoformat()
        }
        
        firebase_db.collection('users').document(user.uid).set(user_doc)
        
        return {"id": user.uid, **user_doc}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/employees")
async def create_employee(user_data: UserCreate, current_user: dict = Depends(require_role(['OWNER', 'CO']))):
    """Create a new employee - OWNER/CO only (alias for /users)"""
    try:
        # Create user in Firebase Auth
        user = admin_auth.create_user(
            email=user_data.email,
            password=user_data.password,
            display_name=user_data.name
        )
        
        # Store user data in Firestore
        user_doc = {
            'email': user_data.email,
            'name': user_data.name,
            'role': user_data.role.upper(),
            'assignedStoreId': user_data.assignedStoreId,
            'createdAt': get_current_time().isoformat(),
            'updatedAt': get_current_time().isoformat(),
            'isActive': True
        }
        
        firebase_db.collection('users').document(user.uid).set(user_doc)
        
        return {"id": user.uid, **user_doc}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/employees")
async def get_employees(user: dict = Depends(require_role(['OWNER', 'CO', 'MANAGER', 'SUPERVISOR', 'EMPLOYEE', 'ACCOUNTANT']))):
    """Get all employees - filtered by role (all authenticated users can access)"""
    user_role = user.get('role', '').upper()
    
    # DEBUG: Log the request
    print(f"[DEBUG] GET /api/employees - User Role: {user_role}, User ID: {user.get('uid')}")
    
    # Get all employees using helper
    all_users = get_all_employees(
        firebase_db,
        exclude_owner_for_co=True,  # CO can't see OWNER
        current_user_role=user_role
    )
    
    employees_list = [{"id": emp.id, **emp.to_dict()} for emp in all_users]
    
    print(f"[DEBUG] Before filtering: {len(employees_list)} employees")
    
    # Additional filtering: MANAGER and lower roles can't see OWNER or CO
    if user_role in ['MANAGER', 'SUPERVISOR', 'EMPLOYEE', 'ACCOUNTANT']:
        print(f"[DEBUG] Applying filter for {user_role}")
        filtered_list = [
            emp for emp in employees_list 
            if emp.get('role', '').upper() not in ['OWNER', 'CO']
        ]
        print(f"[DEBUG] After filtering: {len(filtered_list)} employees")
        return filtered_list
    
    print(f"[DEBUG] No filter applied (OWNER or CO) - returning all {len(employees_list)} employees")
    return employees_list

@api_router.put("/employees/{employee_id}")
async def update_employee(employee_id: str, employee_data: UserUpdate, user: dict = Depends(require_role(['OWNER', 'CO']))):
    """Update employee - OWNER/CO only"""
    user_ref = firebase_db.collection('users').document(employee_id)
    user_doc = user_ref.get()
    
    if not user_doc.exists:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    update_data = employee_data.dict(exclude_unset=True)
    update_data['updatedAt'] = get_current_time().isoformat()
    
    # Update role in uppercase
    if 'role' in update_data:
        update_data['role'] = update_data['role'].upper()
    
    user_ref.update(update_data)
    
    # If email changed, update Firebase Auth
    if 'email' in update_data:
        try:
            admin_auth.update_user(employee_id, email=update_data['email'])
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to update email: {str(e)}")
    
    updated_doc = user_ref.get()
    return {"id": employee_id, **updated_doc.to_dict()}

@api_router.delete("/employees/{employee_id}")
async def delete_employee(employee_id: str, user: dict = Depends(require_role(['OWNER']))):
    """Delete an employee - OWNER only
    
    Security: Only OWNER can delete employees. CO cannot delete anyone.
    """
    # Additional check: prevent deleting OWNER accounts
    user_ref = firebase_db.collection('users').document(employee_id)
    user_doc = user_ref.get()
    
    if not user_doc.exists:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    employee_data = user_doc.to_dict()
    
    # CRITICAL: Cannot delete OWNER accounts
    if employee_data.get('role', '').upper() == 'OWNER':
        raise HTTPException(status_code=403, detail="Cannot delete OWNER accounts")
    
    try:
        # Delete from Firebase Auth
        admin_auth.delete_user(employee_id)
        
        # Delete from Firestore
        user_ref.delete()
        
        return {"message": "Employee deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/employees/{employee_id}/reset-password")
async def reset_employee_password(employee_id: str, user: dict = Depends(require_role(['OWNER']))):
    """Reset employee password to default - OWNER only"""
    user_ref = firebase_db.collection('users').document(employee_id)
    user_doc = user_ref.get()
    
    if not user_doc.exists:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    employee_data = user_doc.to_dict()
    employee_email = employee_data.get('email')
    
    if not employee_email:
        raise HTTPException(status_code=400, detail="Employee email not found")
    
    # Get default password from environment variable
    default_password = os.getenv('DEFAULT_EMPLOYEE_PASSWORD', 'gosta123')
    
    # Reset password using Firebase Admin
    try:
        from firebase_admin import auth as admin_auth
        
        # Update user password in Firebase Auth
        admin_auth.update_user(
            employee_id,
            password=default_password
        )
        
        # Log the password reset
        user_ref.update({
            'passwordResetAt': get_current_time().isoformat(),
            'passwordResetBy': user['uid'],
        })
        
        return {
            "message": "Password reset successfully",
            "email": employee_email,
            "newPassword": default_password
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reset password: {str(e)}")


# ==================== SHIFT/SCHEDULE ROUTES ====================

@api_router.get("/shifts")
async def get_shifts(storeId: Optional[str] = None, date: Optional[str] = None, startDate: Optional[str] = None, endDate: Optional[str] = None, token: dict = Depends(verify_token)):
    """Get shifts with optional filters including date range"""
    shifts_ref = firebase_db.collection('shifts')
    
    if storeId:
        shifts_ref = shifts_ref.where('storeId', '==', storeId)
    if date:
        shifts_ref = shifts_ref.where('date', '==', date)
    
    shifts = list(shifts_ref.stream())
    
    # Filter by date range if provided
    if startDate and endDate:
        filtered_shifts = []
        for shift in shifts:
            shift_date = shift.to_dict().get('date')
            if shift_date and startDate <= shift_date <= endDate:
                filtered_shifts.append({"id": shift.id, **shift.to_dict()})
        return filtered_shifts
    
    return [{"id": shift.id, **shift.to_dict()} for shift in shifts]

@api_router.post("/shifts")
async def create_shift(shift_data: ShiftCreate, user: dict = Depends(require_role(['OWNER', 'CO', 'MANAGER']))):
    """Create a new shift with conflict detection - OWNER/CO/MANAGER only
    
    Employees can work at multiple stores on the same day, as long as shift times don't overlap.
    """
    # Check for overlapping shifts for the same employee on the same date (any store)
    existing_shifts_ref = firebase_db.collection('shifts').where('employeeId', '==', shift_data.employeeId).where('date', '==', shift_data.date)
    existing_shifts = list(existing_shifts_ref.stream())
    
    if existing_shifts:
        # Check time overlap - employees can work at multiple stores if times don't overlap
        new_start = datetime.strptime(shift_data.startTime, '%H:%M').time()
        new_end = datetime.strptime(shift_data.endTime, '%H:%M').time()
        
        for shift in existing_shifts:
            shift_data_existing = shift.to_dict()
            existing_start = datetime.strptime(shift_data_existing['startTime'], '%H:%M').time()
            existing_end = datetime.strptime(shift_data_existing['endTime'], '%H:%M').time()
            existing_store_name = shift_data_existing.get('storeName', 'Unknown Store')
            
            # Check if times overlap - this prevents double booking
            if (new_start < existing_end and new_end > existing_start):
                raise HTTPException(
                    status_code=400, 
                    detail=f"Time conflict: Employee already has a shift at {existing_store_name} from {shift_data_existing['startTime']} to {shift_data_existing['endTime']} on {shift_data.date}"
                )
    
    shift_dict = shift_data.dict()
    shift_dict['id'] = str(uuid.uuid4())
    shift_dict['createdAt'] = get_current_time().isoformat()
    shift_dict['updatedAt'] = get_current_time().isoformat()
    
    # If supervisor is assigned, get supervisor details
    if shift_dict.get('supervisorId'):
        supervisor_doc = firebase_db.collection('users').document(shift_dict['supervisorId']).get()
        if supervisor_doc.exists:
            shift_dict['supervisorName'] = supervisor_doc.to_dict().get('name', 'Unknown')
        else:
            shift_dict['supervisorId'] = None
    
    firebase_db.collection('shifts').document(shift_dict['id']).set(shift_dict)
    return shift_dict

@api_router.delete("/shifts/{shift_id}")
async def delete_shift(shift_id: str, user: dict = Depends(require_role(['OWNER', 'CO', 'MANAGER']))):
    """Delete a shift - OWNER/CO/MANAGER only"""
    firebase_db.collection('shifts').document(shift_id).delete()
    return {"message": "Shift deleted successfully"}

# ==================== ATTENDANCE/CLOCK ROUTES ====================

@api_router.get("/attendance")
async def get_attendance(storeId: Optional[str] = None, date: Optional[str] = None, startDate: Optional[str] = None, endDate: Optional[str] = None, token: dict = Depends(verify_token)):
    """Get attendance records with optional filters"""
    attendance_ref = firebase_db.collection('attendance')
    
    if storeId:
        attendance_ref = attendance_ref.where('storeId', '==', storeId)
    
    # If date range is provided, filter by clockInTime
    if startDate and endDate:
        start_date = datetime.fromisoformat(startDate)
        end_date = datetime.fromisoformat(endDate) + timedelta(days=1)  # Include end date
        attendance_ref = attendance_ref.where('clockInTime', '>=', start_date.isoformat()).where('clockInTime', '<', end_date.isoformat())
    elif date:
        # Single date filter
        start_of_day = datetime.fromisoformat(date)
        end_of_day = start_of_day + timedelta(days=1)
        attendance_ref = attendance_ref.where('clockInTime', '>=', start_of_day.isoformat()).where('clockInTime', '<', end_of_day.isoformat())
    
    attendance = list(attendance_ref.stream())
    return [{"id": att.id, **att.to_dict()} for att in attendance]

@api_router.post("/attendance/clock-in")
async def clock_in(request: ClockInRequest, token: dict = Depends(verify_token)):
    """Clock in with geofencing validation and race condition protection"""
    uid = token['uid']
    
    # Get shift details
    shift_doc = firebase_db.collection('shifts').document(request.shiftId).get()
    if not shift_doc.exists:
        raise HTTPException(status_code=404, detail="Shift not found")
    
    shift_data = shift_doc.to_dict()
    
    # Get store details for geofencing
    store_doc = firebase_db.collection('stores').document(shift_data['storeId']).get()
    if not store_doc.exists:
        raise HTTPException(status_code=404, detail="Store not found")
    
    store_data = store_doc.to_dict()
    
    # Geofencing check
    distance = calculate_distance(
        request.lat, request.lng,
        store_data['lat'], store_data['lng']
    )
    
    store_radius = store_data.get('radius', 10)  # Default 10m if not set
    if distance > store_radius:
        raise HTTPException(
            status_code=400,
            detail=f"You are {int(distance)}m away from the store. Must be within {store_radius}m to clock in."
        )
    
    # CRITICAL FIX: Use Firestore transaction to prevent race condition
    # This prevents duplicate clock-ins when user taps button rapidly
    transaction = firebase_db.transaction()
    
    @firestore.transactional
    def clock_in_transaction(transaction):
        # Check if already clocked in within transaction
        existing_attendance = list(firebase_db.collection('attendance').where(
            'employeeId', '==', uid
        ).where('status', '==', 'CLOCKED_IN').stream())
        
        if existing_attendance:
            raise HTTPException(status_code=400, detail="Already clocked in")
        
        # Create attendance record
        now = get_current_time()
        attendance_id = str(uuid.uuid4())
        attendance_dict = {
            'id': attendance_id,
            'employeeId': uid,
            'employeeName': shift_data['employeeName'],
            'shiftId': request.shiftId,
            'storeId': shift_data['storeId'],
            'storeName': shift_data['storeName'],
            'clockInTime': now.isoformat(),
            'clockInLat': request.lat,
            'clockInLng': request.lng,
            'status': 'CLOCKED_IN',
            'createdAt': now.isoformat()
        }
        
        # Check if late (more than 15 minutes after shift start)
        shift_start_time = datetime.fromisoformat(f"{shift_data['date']}T{shift_data['startTime']}")
        shift_start_time = TIMEZONE.localize(shift_start_time.replace(tzinfo=None))
        
        if now > shift_start_time + timedelta(minutes=15):
            attendance_dict['isLate'] = True
            attendance_dict['lateByMinutes'] = int((now - shift_start_time).total_seconds() / 60)
        else:
            attendance_dict['isLate'] = False
            attendance_dict['lateByMinutes'] = 0
        
        # Create within transaction (atomic operation)
        attendance_ref = firebase_db.collection('attendance').document(attendance_id)
        transaction.set(attendance_ref, attendance_dict)
        
        return attendance_dict
    
    # Execute transaction
    result = clock_in_transaction(transaction)
    return result

@api_router.post("/attendance/clock-out")
async def clock_out(request: ClockOutRequest, token: dict = Depends(verify_token)):
    """Clock out with geofencing validation"""
    uid = token['uid']
    
    # Get attendance record
    attendance_doc = firebase_db.collection('attendance').document(request.attendanceId).get()
    if not attendance_doc.exists:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    
    attendance_data = attendance_doc.to_dict()
    
    if attendance_data['employeeId'] != uid:
        raise HTTPException(status_code=403, detail="Not your attendance record")
    
    if attendance_data['status'] == 'CLOCKED_OUT':
        raise HTTPException(status_code=400, detail="Already clocked out")
    
    # Get store details for geofencing
    store_doc = firebase_db.collection('stores').document(attendance_data['storeId']).get()
    if not store_doc.exists:
        raise HTTPException(status_code=404, detail="Store not found")
    
    store_data = store_doc.to_dict()
    
    # Geofencing check
    distance = calculate_distance(
        request.lat, request.lng,
        store_data['lat'], store_data['lng']
    )
    
    store_radius = store_data.get('radius', 10)
    if distance > store_radius:
        raise HTTPException(
            status_code=400,
            detail=f"You are {int(distance)}m away from the store. Must be within {store_radius}m to clock out."
        )
    
    # Update attendance record
    now = get_current_time()
    firebase_db.collection('attendance').document(request.attendanceId).update({
        'clockOutTime': now.isoformat(),
        'clockOutLat': request.lat,
        'clockOutLng': request.lng,
        'status': 'CLOCKED_OUT',
        'updatedAt': now.isoformat()
    })
    
    updated_doc = firebase_db.collection('attendance').document(request.attendanceId).get()
    return {"id": request.attendanceId, **updated_doc.to_dict()}

@api_router.get("/attendance/currently-working-by-store")
async def get_currently_working_by_store(token: dict = Depends(verify_token)):
    """Get employees currently working, grouped by store"""
    # Get all active attendance records
    active_attendance = list(firebase_db.collection('attendance').where(
        'status', '==', 'CLOCKED_IN'
    ).stream())
    
    # Group by store
    stores_map = {}
    for att in active_attendance:
        att_data = att.to_dict()
        store_id = att_data.get('storeId')
        
        if store_id not in stores_map:
            stores_map[store_id] = {
                'storeId': store_id,
                'storeName': att_data.get('storeName', 'Unknown Store'),
                'employees': [],
                'employeeCount': 0
            }
        
        # Check if employee is a supervisor on this shift
        shift_id = att_data.get('shiftId')
        is_supervisor = False
        if shift_id:
            shift_doc = firebase_db.collection('shifts').document(shift_id).get()
            if shift_doc.exists:
                shift_data = shift_doc.to_dict()
                if shift_data.get('supervisorId') == att_data.get('employeeId'):
                    is_supervisor = True
        
        stores_map[store_id]['employees'].append({
            'id': att_data.get('employeeId'),
            'employeeName': att_data.get('employeeName'),
            'isSupervisor': is_supervisor
        })
        stores_map[store_id]['employeeCount'] += 1
    
    return list(stores_map.values())

@api_router.post("/attendance/auto-clock-out")
async def auto_clock_out_expired(user: dict = Depends(require_role(['OWNER', 'CO']))):
    """Auto clock out employees whose shift has ended - OWNER/CO only"""
    now = get_current_time()
    
    # Get all active attendance records
    active_records = list(firebase_db.collection('attendance').where(
        'status', '==', 'CLOCKED_IN'
    ).stream())
    
    auto_clocked_out = []
    
    for record in active_records:
        record_data = record.to_dict()
        shift_id = record_data.get('shiftId')
        
        if not shift_id:
            continue
        
        # Get shift end time
        shift_doc = firebase_db.collection('shifts').document(shift_id).get()
        if not shift_doc.exists:
            continue
        
        shift_data = shift_doc.to_dict()
        shift_end = datetime.fromisoformat(f"{shift_data['date']}T{shift_data['endTime']}")
        shift_end = TIMEZONE.localize(shift_end.replace(tzinfo=None))
        
        # Auto clock out if shift ended more than 1 hour ago
        if now > shift_end + timedelta(hours=1):
            firebase_db.collection('attendance').document(record.id).update({
                'clockOutTime': shift_end.isoformat(),
                'status': 'CLOCKED_OUT',
                'autoClockOut': True,
                'updatedAt': now.isoformat()
            })
            auto_clocked_out.append({
                'employeeName': record_data.get('employeeName'),
                'storeName': record_data.get('storeName'),
                'shiftEnd': shift_end.isoformat()
            })
    
    return {
        'message': f'Auto clocked out {len(auto_clocked_out)} employees',
        'employees': auto_clocked_out
    }

@api_router.post("/attendance/detect-no-shows")
async def detect_no_shows(user: dict = Depends(require_role(['OWNER', 'CO']))):
    """
    CRITICAL FIX: Auto-detect no-shows for shifts with no attendance
    
    This endpoint should be called by a cron job every 30 minutes.
    It checks all shifts that started more than 30 minutes ago and have no attendance record.
    Creates a no-show attendance record with penalty flag.
    
    Usage:
    - Schedule with cron: curl -X POST https://api.example.com/api/attendance/detect-no-shows
    - Or use Cloud Scheduler (GCP), EventBridge (AWS), etc.
    - Recommended: Run every 30 minutes
    
    Returns:
        List of employees marked as no-show
    """
    return await _detect_no_shows_logic()

@api_router.post("/internal/detect-no-shows")
async def detect_no_shows_internal(request: Request):
    """
    Internal endpoint for cron jobs (localhost only, no auth required)
    
    Security: Only accessible from localhost/127.0.0.1
    Purpose: Allow cron jobs to run without managing auth tokens
    """
    client_host = request.client.host
    
    # Only allow from localhost
    if client_host not in ['127.0.0.1', 'localhost', '::1']:
        raise HTTPException(
            status_code=403, 
            detail=f"Access denied. This endpoint is only accessible from localhost (got {client_host})"
        )
    
    return await _detect_no_shows_logic()

async def _detect_no_shows_logic():
    now = get_current_time()
    no_show_threshold = now - timedelta(minutes=30)  # 30 min after shift start
    
    # Get all shifts that started more than 30 minutes ago
    all_shifts = list(firebase_db.collection('shifts').stream())
    
    no_shows_detected = []
    
    for shift in all_shifts:
        shift_data = shift.to_dict()
        shift_id = shift_data.get('id')
        employee_id = shift_data.get('employeeId')
        
        if not shift_id or not employee_id:
            continue
        
        # Parse shift start time
        try:
            shift_start = datetime.fromisoformat(f"{shift_data['date']}T{shift_data['startTime']}")
            shift_start = TIMEZONE.localize(shift_start.replace(tzinfo=None))
        except Exception as e:
            print(f"Error parsing shift time: {e}")
            continue
        
        # Only process shifts that started more than 30 minutes ago
        if shift_start > no_show_threshold:
            continue
        
        # Check if attendance record exists for this shift
        attendance_records = list(firebase_db.collection('attendance').where(
            'shiftId', '==', shift_id
        ).stream())
        
        # If no attendance record exists, mark as no-show
        if not attendance_records:
            # Check if we already created a no-show record (idempotent)
            existing_no_show = list(firebase_db.collection('attendance').where(
                'shiftId', '==', shift_id
            ).where('noShow', '==', True).stream())
            
            if not existing_no_show:
                # Create no-show attendance record
                no_show_dict = {
                    'id': str(uuid.uuid4()),
                    'employeeId': employee_id,
                    'employeeName': shift_data.get('employeeName', 'Unknown'),
                    'shiftId': shift_id,
                    'storeId': shift_data.get('storeId', ''),
                    'storeName': shift_data.get('storeName', 'Unknown Store'),
                    'status': 'NO_SHOW',
                    'noShow': True,
                    'clockInTime': None,
                    'clockOutTime': None,
                    'isLate': False,
                    'lateByMinutes': 0,
                    'createdAt': now.isoformat(),
                    'detectedAt': now.isoformat(),
                    'autoDetected': True
                }
                
                # Save no-show record
                firebase_db.collection('attendance').document(no_show_dict['id']).set(no_show_dict)
                
                no_shows_detected.append({
                    'employeeId': employee_id,
                    'employeeName': shift_data.get('employeeName'),
                    'storeName': shift_data.get('storeName'),
                    'shiftDate': shift_data.get('date'),
                    'shiftStartTime': shift_data.get('startTime')
                })
    
    return {
        'message': f'Detected {len(no_shows_detected)} no-shows',
        'noShows': no_shows_detected,
        'timestamp': now.isoformat()
    }

# ==================== STORE ROUTES ====================

@api_router.get("/stores")
async def get_stores(token: dict = Depends(verify_token)):
    """Get all stores"""
    stores = firebase_db.collection('stores').stream()
    return [{"id": store.id, **store.to_dict()} for store in stores]

@api_router.get("/stores/count")
async def get_store_count(user: dict = Depends(require_role(['OWNER', 'CO']))):
    """Get store count and max limit - OWNER/CO only"""
    stores = list(firebase_db.collection('stores').stream())
    count = len(stores)
    max_stores = 50
    
    return {
        'count': count,
        'max': max_stores,
        'canAdd': count < max_stores
    }

@api_router.post("/stores")
async def create_store(store_data: StoreCreate, user: dict = Depends(require_role(['OWNER']))):
    """Create a new store - OWNER only"""
    # Check store limit
    stores = list(firebase_db.collection('stores').stream())
    if len(stores) >= 50:
        raise HTTPException(status_code=400, detail="Maximum store limit (50) reached")
    
    store_dict = store_data.dict()
    store_dict['id'] = str(uuid.uuid4())
    store_dict['createdAt'] = get_current_time().isoformat()
    store_dict['updatedAt'] = get_current_time().isoformat()
    
    firebase_db.collection('stores').document(store_dict['id']).set(store_dict)
    return store_dict

@api_router.put("/stores/{store_id}")
async def update_store(store_id: str, store_data: StoreCreate, user: dict = Depends(require_role(['OWNER']))):
    """Update a store - OWNER only"""
    store_ref = firebase_db.collection('stores').document(store_id)
    store_doc = store_ref.get()
    
    if not store_doc.exists:
        raise HTTPException(status_code=404, detail="Store not found")
    
    update_data = store_data.dict()
    update_data['updatedAt'] = get_current_time().isoformat()
    
    store_ref.update(update_data)
    
    updated_doc = store_ref.get()
    return {"id": store_id, **updated_doc.to_dict()}

@api_router.delete("/stores/{store_id}")
async def delete_store(store_id: str, user: dict = Depends(require_role(['OWNER']))):
    """Delete a store - OWNER only"""
    firebase_db.collection('stores').document(store_id).delete()
    return {"message": "Store deleted successfully"}

# ==================== INGREDIENT ROUTES ====================

@api_router.get("/ingredients")
async def get_ingredients(storeId: Optional[str] = None, token: dict = Depends(verify_token)):
    """Get ingredients with optional store filter"""
    ingredients_ref = firebase_db.collection('ingredients')
    
    if storeId:
        ingredients_ref = ingredients_ref.where('storeId', '==', storeId)
    
    ingredients = list(ingredients_ref.stream())
    return [{"id": ing.id, **ing.to_dict()} for ing in ingredients]

@api_router.post("/ingredients")
async def create_ingredient(ingredient_data: IngredientCreate, user: dict = Depends(require_role(['OWNER']))):
    """Create a new ingredient - OWNER only"""
    ingredient_dict = ingredient_data.dict()
    ingredient_dict['id'] = str(uuid.uuid4())
    ingredient_dict['createdAt'] = get_current_time().isoformat()
    ingredient_dict['updatedAt'] = get_current_time().isoformat()
    
    firebase_db.collection('ingredients').document(ingredient_dict['id']).set(ingredient_dict)
    return ingredient_dict

@api_router.put("/ingredients/{ingredient_id}")
async def update_ingredient(ingredient_id: str, ingredient_data: IngredientCreate, user: dict = Depends(require_role(['OWNER']))):
    """Update an ingredient - OWNER only"""
    ingredient_ref = firebase_db.collection('ingredients').document(ingredient_id)
    ingredient_doc = ingredient_ref.get()
    
    if not ingredient_doc.exists:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    
    update_data = ingredient_data.dict()
    update_data['updatedAt'] = get_current_time().isoformat()
    
    ingredient_ref.update(update_data)
    
    updated_doc = ingredient_ref.get()
    return {"id": ingredient_id, **updated_doc.to_dict()}

@api_router.delete("/ingredients/{ingredient_id}")
async def delete_ingredient(ingredient_id: str, user: dict = Depends(require_role(['OWNER']))):
    """Delete an ingredient - OWNER only"""
    firebase_db.collection('ingredients').document(ingredient_id).delete()
    return {"message": "Ingredient deleted successfully"}

@api_router.post("/ingredient-counts")
async def submit_ingredient_count(count_data: IngredientCountCreate, token: dict = Depends(verify_token)):
    """Submit ingredient count"""
    uid = token['uid']
    
    # Get user details
    user_doc = firebase_db.collection('users').document(uid).get()
    if not user_doc.exists:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_data = user_doc.to_dict()
    
    # Verify user has access to this store (for supervisor role)
    if user_data.get('role') == 'SUPERVISOR' and user_data.get('assignedStoreId') != count_data.storeId:
        raise HTTPException(status_code=403, detail="Not authorized for this store")
    
    count_dict = count_data.dict()
    count_dict['id'] = str(uuid.uuid4())
    count_dict['submittedBy'] = uid
    count_dict['submittedByName'] = user_data.get('name', 'Unknown')
    count_dict['submittedAt'] = get_current_time().isoformat()
    count_dict['date'] = get_current_time().date().isoformat()
    
    firebase_db.collection('ingredient_counts').document(count_dict['id']).set(count_dict)
    return count_dict

@api_router.get("/ingredient-counts")
async def get_ingredient_counts(
    storeId: Optional[str] = None,
    ingredientId: Optional[str] = None,
    date: Optional[str] = None,
    token: dict = Depends(verify_token)
):
    """Get ingredient counts with optional filters"""
    counts_ref = firebase_db.collection('ingredient_counts')
    
    if storeId:
        counts_ref = counts_ref.where('storeId', '==', storeId)
    if ingredientId:
        counts_ref = counts_ref.where('ingredientId', '==', ingredientId)
    if date:
        counts_ref = counts_ref.where('date', '==', date)
    
    counts = list(counts_ref.stream())
    return [{"id": count.id, **count.to_dict()} for count in counts]

# ==================== LEAVE REQUEST ROUTES ====================

@api_router.get("/leave-requests")
async def get_leave_requests(status: Optional[str] = None, token: dict = Depends(verify_token)):
    """Get leave requests - employees see their own, managers see all"""
    uid = token['uid']
    user_doc = firebase_db.collection('users').document(uid).get()
    
    if not user_doc.exists:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_data = user_doc.to_dict()
    user_role = user_data.get('role', '').upper()
    
    leaves_ref = firebase_db.collection('leave_requests')
    
    # Regular employees only see their own requests
    if user_role not in ['OWNER', 'CO', 'MANAGER']:
        leaves_ref = leaves_ref.where('employeeId', '==', uid)
    
    # Filter by status if provided
    if status:
        leaves_ref = leaves_ref.where('status', '==', status.upper())
    
    leaves = list(leaves_ref.stream())
    return [{"id": leave.id, **leave.to_dict()} for leave in leaves]

@api_router.post("/leave-requests")
async def create_leave_request(leave_data: LeaveRequestCreate, token: dict = Depends(verify_token)):
    """Create a leave request"""
    uid = token['uid']
    
    # Get user details
    user_doc = firebase_db.collection('users').document(uid).get()
    if not user_doc.exists:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_data = user_doc.to_dict()
    
    # For 'leave' type, check if employee has a shift on that date
    if leave_data.type == 'leave':
        shifts_on_date = list(firebase_db.collection('shifts').where(
            'employeeId', '==', uid
        ).where('date', '==', leave_data.date).stream())
        
        if not shifts_on_date:
            raise HTTPException(
                status_code=400,
                detail="Cannot request leave: No scheduled shift on this date. Use 'Day-Off' instead."
            )
        
        # Check if already clocked in for this date
        today = get_current_time().date()
        request_date = datetime.fromisoformat(leave_data.date).date()
        
        if request_date == today:
            # Check for active attendance
            active_attendance = list(firebase_db.collection('attendance').where(
                'employeeId', '==', uid
            ).where('status', '==', 'CLOCKED_IN').stream())
            
            if active_attendance:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot request leave: You are currently clocked in. Please clock out first."
                )
    
    # For 'day_off' type, no shift is required
    
    leave_dict = leave_data.dict()
    leave_dict['id'] = str(uuid.uuid4())
    leave_dict['employeeId'] = uid
    leave_dict['employeeName'] = user_data.get('name', 'Unknown')
    leave_dict['status'] = 'PENDING'
    leave_dict['createdAt'] = get_current_time().isoformat()
    leave_dict['updatedAt'] = get_current_time().isoformat()
    
    firebase_db.collection('leave_requests').document(leave_dict['id']).set(leave_dict)
    return leave_dict

@api_router.put("/leave-requests/{request_id}")
async def update_leave_status(request_id: str, status_update: LeaveStatusUpdate, user: dict = Depends(require_role(['OWNER', 'CO', 'MANAGER']))):
    """Update leave request status - OWNER/CO/MANAGER only"""
    leave_ref = firebase_db.collection('leave_requests').document(request_id)
    leave_doc = leave_ref.get()
    
    if not leave_doc.exists:
        raise HTTPException(status_code=404, detail="Leave request not found")
    
    leave_ref.update({
        'status': status_update.status.upper(),
        'reviewedBy': user['uid'],
        'reviewedByName': user.get('name', 'Unknown'),
        'reviewedAt': get_current_time().isoformat(),
        'updatedAt': get_current_time().isoformat()
    })
    
    updated_doc = leave_ref.get()
    return {"id": request_id, **updated_doc.to_dict()}

# ==================== EARNINGS/PAYROLL ROUTES ====================

@api_router.get("/earnings/my-earnings")
async def get_my_earnings(token: dict = Depends(verify_token)):
    """Get logged-in employee's earnings (today + this month) with penalties"""
    uid = token['uid']
    
    # Get user data using helper
    user_data = get_user_document(uid, firebase_db)
    hourly_rate = user_data.get('salary', 0)
    
    if not hourly_rate or hourly_rate <= 0:
        return {
            "employeeId": uid,
            "employeeName": user_data.get('name', 'Unknown'),
            "hourlyRate": 0,
            "todayEarnings": 0,
            "todayHours": 0,
            "monthEarnings": 0,
            "monthHours": 0,
            "lateCount": 0,
            "latePenalty": 0,
            "noShowCount": 0,
            "noShowPenalty": 0,
            "message": "No salary configured"
        }
    
    today = get_current_time().date()
    month_start = datetime(today.year, today.month, 1).isoformat()
    month_end = datetime.combine(today, datetime.max.time()).isoformat()
    
    # Get all attendance for this employee (simplified query to avoid index requirement)
    all_attendance = list(firebase_db.collection('attendance').where(
        'employeeId', '==', uid
    ).stream())
    
    # Filter to this month's clocked out attendance in memory
    month_attendance = []
    for att in all_attendance:
        att_data = att.to_dict()
        if att_data.get('status') == 'CLOCKED_OUT':
            clock_in_time = att_data.get('clockInTime', '')
            if month_start <= clock_in_time <= month_end:
                month_attendance.append(att)
    
    # Calculate hours and count late arrivals
    month_hours = 0
    late_count = 0
    late_penalty_hours = 0
    
    for att in month_attendance:
        att_data = att.to_dict()
        clock_in = datetime.fromisoformat(att_data['clockInTime'].replace('Z', '+00:00'))
        clock_out = datetime.fromisoformat(att_data['clockOutTime'].replace('Z', '+00:00'))
        hours = (clock_out - clock_in).total_seconds() / 3600
        month_hours += hours
        
        # Count late arrivals
        if att_data.get('isLate', False):
            late_count += 1
            
            # Apply penalty for 3rd+ late (after 2 warnings)
            if late_count > 2:
                # Get shift hours for this attendance
                shift_id = att_data.get('shiftId')
                if shift_id:
                    shift_doc = firebase_db.collection('shifts').document(shift_id).get()
                    if shift_doc.exists:
                        shift_data = shift_doc.to_dict()
                        start_time = datetime.fromisoformat(f"{shift_data['date']}T{shift_data['startTime']}")
                        end_time = datetime.fromisoformat(f"{shift_data['date']}T{shift_data['endTime']}")
                        shift_hours = (end_time - start_time).total_seconds() / 3600
                        # Penalty is half the shift hours
                        late_penalty_hours += shift_hours * 0.5
    
    # Calculate no-shows (scheduled shifts but no attendance) - simplified query
    all_shifts = list(firebase_db.collection('shifts').where(
        'employeeId', '==', uid
    ).stream())
    
    no_show_count = 0
    no_show_penalty_hours = 0
    
    # Filter to this month's past shifts in memory
    month_start_date = today.replace(day=1)
    for shift in all_shifts:
        shift_data = shift.to_dict()
        shift_date_str = shift_data.get('date', '')
        
        try:
            shift_date = datetime.fromisoformat(shift_date_str).date()
            
            # Only check shifts from this month that have passed
            if month_start_date <= shift_date < today:
                shift_id = shift.id
                
                # Check if there's attendance for this shift
                has_attendance = any(
                    att.to_dict().get('shiftId') == shift_id 
                    for att in month_attendance
                )
                
                if not has_attendance:
                    no_show_count += 1
                    # No-show penalty = 2 days worth of shift hours
                    start_time = datetime.fromisoformat(f"{shift_date_str}T{shift_data['startTime']}")
                    end_time = datetime.fromisoformat(f"{shift_date_str}T{shift_data['endTime']}")
                    shift_hours = (end_time - start_time).total_seconds() / 3600
                    no_show_penalty_hours += shift_hours * 2
        except:
            continue
    
    # Calculate today's earnings (separate from month for display)
    today_start = datetime.combine(today, datetime.min.time()).isoformat()
    today_end = datetime.combine(today, datetime.max.time()).isoformat()
    
    today_attendance = [att for att in month_attendance if att.to_dict().get('clockInTime', '').startswith(today.isoformat())]
    today_hours = 0
    today_late_penalty = 0
    
    for att in today_attendance:
        att_data = att.to_dict()
        clock_in = datetime.fromisoformat(att_data['clockInTime'].replace('Z', '+00:00'))
        clock_out = datetime.fromisoformat(att_data['clockOutTime'].replace('Z', '+00:00'))
        hours = (clock_out - clock_in).total_seconds() / 3600
        today_hours += hours
        
        # Check if today's attendance was late and counts toward penalty
        if att_data.get('isLate', False) and late_count > 2:
            shift_id = att_data.get('shiftId')
            if shift_id:
                shift_doc = firebase_db.collection('shifts').document(shift_id).get()
                if shift_doc.exists:
                    shift_data = shift_doc.to_dict()
                    start_time = datetime.fromisoformat(f"{shift_data['date']}T{shift_data['startTime']}")
                    end_time = datetime.fromisoformat(f"{shift_data['date']}T{shift_data['endTime']}")
                    shift_hours = (end_time - start_time).total_seconds() / 3600
                    today_late_penalty = shift_hours * 0.5
    
    # Calculate earnings using helper
    month_earnings_calc = calculate_net_earnings(month_hours, hourly_rate, late_penalty_hours, no_show_penalty_hours)
    today_earnings_calc = calculate_net_earnings(today_hours, hourly_rate, today_late_penalty, 0)
    
    return {
        "employeeId": uid,
        "employeeName": user_data.get('name', 'Unknown'),
        "hourlyRate": hourly_rate,
        "todayEarnings": today_earnings_calc['net'],
        "todayHours": round(today_hours, 2),
        "monthEarnings": month_earnings_calc['net'],
        "monthGrossEarnings": month_earnings_calc['gross'],
        "monthHours": round(month_hours, 2),
        "lateCount": late_count,
        "latePenalty": month_earnings_calc['late_penalty'],
        "noShowCount": no_show_count,
        "noShowPenalty": month_earnings_calc['no_show_penalty'],
    }

@api_router.get("/earnings/all-employees")
async def get_all_employees_earnings(user: dict = Depends(require_role(['OWNER', 'CO']))):
    """Get all employees' earnings for current month - OWNER/CO only"""
    today = get_current_time().date()
    month_start = datetime(today.year, today.month, 1).isoformat()
    month_end = datetime.combine(today, datetime.max.time()).isoformat()
    
    # Get all employees
    all_users = list(firebase_db.collection('users').stream())
    
    earnings_list = []
    
    for user_doc in all_users:
        user_data = user_doc.to_dict()
        uid = user_doc.id
        hourly_rate = user_data.get('salary', 0)
        
        if not hourly_rate or hourly_rate <= 0:
            continue
        
        # Get this month's attendance
        all_attendance = list(firebase_db.collection('attendance').where(
            'employeeId', '==', uid
        ).stream())
        
        month_attendance = []
        for att in all_attendance:
            att_data = att.to_dict()
            if att_data.get('status') == 'CLOCKED_OUT':
                clock_in_time = att_data.get('clockInTime', '')
                if month_start <= clock_in_time <= month_end:
                    month_attendance.append(att)
        
        # Calculate hours
        month_hours = 0
        for att in month_attendance:
            att_data = att.to_dict()
            clock_in = datetime.fromisoformat(att_data['clockInTime'].replace('Z', '+00:00'))
            clock_out = datetime.fromisoformat(att_data['clockOutTime'].replace('Z', '+00:00'))
            hours = (clock_out - clock_in).total_seconds() / 3600
            month_hours += hours
        
        month_earnings = round(month_hours * hourly_rate, 2)
        
        earnings_list.append({
            "employeeId": uid,
            "employeeName": user_data.get('name', 'Unknown'),
            "role": user_data.get('role', 'EMPLOYEE'),
            "hourlyRate": hourly_rate,
            "monthHours": round(month_hours, 2),
            "monthEarnings": month_earnings,
        })
    
    return earnings_list

@api_router.get("/payroll/all-earnings")
async def get_all_earnings_with_status(user: dict = Depends(require_role(['OWNER', 'CO', 'ACCOUNTANT']))):
    """Get all employees with payment status - OWNER/CO/ACCOUNTANT"""
    today = get_current_time().date()
    current_month = today.month
    current_year = today.year
    
    # Get all employees using helper
    user_role = user.get('role', '').upper()
    all_users = get_all_employees(firebase_db, exclude_owner_for_co=True, current_user_role=user_role)
    
    earnings_list = []
    
    for user_doc in all_users:
        user_data = user_doc.to_dict()
        uid = user_doc.id
        
        hourly_rate = user_data.get('salary', 0)
        
        if not hourly_rate or hourly_rate <= 0:
            continue
        
        # Get all attendance for this month
        month_start = datetime(current_year, current_month, 1).isoformat()
        month_end = datetime.combine(today, datetime.max.time()).isoformat()
        
        all_attendance = list(firebase_db.collection('attendance').where(
            'employeeId', '==', uid
        ).stream())
        
        month_attendance = []
        for att in all_attendance:
            att_data = att.to_dict()
            if att_data.get('status') == 'CLOCKED_OUT':
                clock_in_time = att_data.get('clockInTime', '')
                if month_start <= clock_in_time <= month_end:
                    month_attendance.append(att)
        
        # Separate paid and unpaid hours
        paid_hours = 0
        unpaid_hours = 0
        late_count = 0
        late_penalty_hours = 0
        
        for att in month_attendance:
            att_data = att.to_dict()
            clock_in = datetime.fromisoformat(att_data['clockInTime'].replace('Z', '+00:00'))
            clock_out = datetime.fromisoformat(att_data['clockOutTime'].replace('Z', '+00:00'))
            hours = (clock_out - clock_in).total_seconds() / 3600
            
            if att_data.get('paid', False):
                paid_hours += hours
            else:
                unpaid_hours += hours
            
            # Count late arrivals
            if att_data.get('isLate', False):
                late_count += 1
                if late_count > 2:
                    shift_id = att_data.get('shiftId')
                    if shift_id:
                        shift_doc = firebase_db.collection('shifts').document(shift_id).get()
                        if shift_doc.exists:
                            shift_data = shift_doc.to_dict()
                            start_time = datetime.fromisoformat(f"{shift_data['date']}T{shift_data['startTime']}")
                            end_time = datetime.fromisoformat(f"{shift_data['date']}T{shift_data['endTime']}")
                            shift_hours = (end_time - start_time).total_seconds() / 3600
                            late_penalty_hours += shift_hours * 0.5
        
        # Calculate no-shows (both auto-detected and manual)
        # CRITICAL FIX: Now includes NO_SHOW status from auto-detection endpoint
        all_shifts = list(firebase_db.collection('shifts').where(
            'employeeId', '==', uid
        ).stream())
        
        no_show_count = 0
        no_show_penalty_hours = 0
        month_start_date = today.replace(day=1)
        
        # Get all attendance including NO_SHOW records
        all_attendance_with_no_shows = list(firebase_db.collection('attendance').where(
            'employeeId', '==', uid
        ).stream())
        
        for shift in all_shifts:
            shift_data = shift.to_dict()
            shift_date_str = shift_data.get('date', '')
            
            try:
                shift_date = datetime.fromisoformat(shift_date_str).date()
                
                if month_start_date <= shift_date <= today:
                    shift_id = shift.id
                    
                    # Check if there's any attendance record (including NO_SHOW)
                    attendance_for_shift = [
                        att for att in all_attendance_with_no_shows
                        if att.to_dict().get('shiftId') == shift_id
                    ]
                    
                    # If no attendance at all (legacy detection)
                    if not attendance_for_shift:
                        no_show_count += 1
                        start_time = datetime.fromisoformat(f"{shift_date_str}T{shift_data['startTime']}")
                        end_time = datetime.fromisoformat(f"{shift_date_str}T{shift_data['endTime']}")
                        shift_hours = (end_time - start_time).total_seconds() / 3600
                        no_show_penalty_hours += shift_hours * 2
                    else:
                        # Check if marked as NO_SHOW by auto-detection
                        for att in attendance_for_shift:
                            att_data = att.to_dict()
                            if att_data.get('noShow', False) or att_data.get('status') == 'NO_SHOW':
                                no_show_count += 1
                                start_time = datetime.fromisoformat(f"{shift_date_str}T{shift_data['startTime']}")
                                end_time = datetime.fromisoformat(f"{shift_date_str}T{shift_data['endTime']}")
                                shift_hours = (end_time - start_time).total_seconds() / 3600
                                no_show_penalty_hours += shift_hours * 2
                                break
            except:
                continue
        
        # Calculate earnings using helper
        total_hours = paid_hours + unpaid_hours
        unpaid_calc = calculate_net_earnings(unpaid_hours, hourly_rate, late_penalty_hours, no_show_penalty_hours)
        
        # Check if there's a payment record for this month
        payment_records = list(firebase_db.collection('payment_history').where(
            'employeeId', '==', uid
        ).where('month', '==', current_month).where('year', '==', current_year).stream())
        
        is_paid = len(payment_records) > 0
        has_unpaid = unpaid_hours > 0
        last_payment_date = payment_records[0].to_dict().get('paymentDate') if payment_records else None
        
        earnings_list.append({
            "employeeId": uid,
            "employeeName": user_data.get('name', 'Unknown'),
            "role": user_data.get('role', 'EMPLOYEE'),
            "hourlyRate": hourly_rate,
            "totalHours": round(total_hours, 2),
            "paidHours": round(paid_hours, 2),
            "unpaidHours": round(unpaid_hours, 2),
            "grossUnpaid": unpaid_calc['gross'],
            "lateCount": late_count,
            "latePenalty": unpaid_calc['late_penalty'],
            "noShowCount": no_show_count,
            "noShowPenalty": unpaid_calc['no_show_penalty'],
            "netUnpaid": unpaid_calc['net'],
            "isPaid": is_paid,
            "hasUnpaid": has_unpaid,
            "lastPaymentDate": last_payment_date,
            "month": current_month,
            "year": current_year,
        })
    
    return earnings_list

@api_router.get("/payroll/unpaid-earnings")
async def get_unpaid_earnings(user: dict = Depends(require_role(['OWNER', 'CO']))):
    """Get employees with unpaid earnings - OWNER/CO only"""
    today = get_current_time().date()
    current_month = today.month
    current_year = today.year
    
    # Get all employees
    all_users = list(firebase_db.collection('users').stream())
    
    unpaid_list = []
    
    for user_doc in all_users:
        user_data = user_doc.to_dict()
        uid = user_doc.id
        
        hourly_rate = user_data.get('salary', 0)
        
        if not hourly_rate or hourly_rate <= 0:
            continue
        
        # Get unpaid attendance for this month
        month_start = datetime(current_year, current_month, 1).isoformat()
        month_end = datetime.combine(today, datetime.max.time()).isoformat()
        
        all_attendance = list(firebase_db.collection('attendance').where(
            'employeeId', '==', uid
        ).stream())
        
        unpaid_attendance = []
        for att in all_attendance:
            att_data = att.to_dict()
            if att_data.get('status') == 'CLOCKED_OUT' and not att_data.get('paid', False):
                clock_in_time = att_data.get('clockInTime', '')
                if month_start <= clock_in_time <= month_end:
                    unpaid_attendance.append(att)
        
        if not unpaid_attendance:
            continue
        
        # Calculate unpaid hours
        unpaid_hours = 0
        late_count = 0
        late_penalty_hours = 0
        
        for att in unpaid_attendance:
            att_data = att.to_dict()
            clock_in = datetime.fromisoformat(att_data['clockInTime'].replace('Z', '+00:00'))
            clock_out = datetime.fromisoformat(att_data['clockOutTime'].replace('Z', '+00:00'))
            hours = (clock_out - clock_in).total_seconds() / 3600
            unpaid_hours += hours
            
            # Count late arrivals
            if att_data.get('isLate', False):
                late_count += 1
                if late_count > 2:
                    shift_id = att_data.get('shiftId')
                    if shift_id:
                        shift_doc = firebase_db.collection('shifts').document(shift_id).get()
                        if shift_doc.exists:
                            shift_data = shift_doc.to_dict()
                            start_time = datetime.fromisoformat(f"{shift_data['date']}T{shift_data['startTime']}")
                            end_time = datetime.fromisoformat(f"{shift_data['date']}T{shift_data['endTime']}")
                            shift_hours = (end_time - start_time).total_seconds() / 3600
                            late_penalty_hours += shift_hours * 0.5
        
        # Calculate no-shows for this month
        all_shifts = list(firebase_db.collection('shifts').where(
            'employeeId', '==', uid
        ).stream())
        
        no_show_count = 0
        no_show_penalty_hours = 0
        month_start_date = today.replace(day=1)
        
        for shift in all_shifts:
            shift_data = shift.to_dict()
            shift_date_str = shift_data.get('date', '')
            
            try:
                shift_date = datetime.fromisoformat(shift_date_str).date()
                
                if month_start_date <= shift_date < today:
                    shift_id = shift.id
                    has_attendance = any(
                        att.to_dict().get('shiftId') == shift_id 
                        for att in unpaid_attendance
                    )
                    
                    if not has_attendance:
                        no_show_count += 1
                        start_time = datetime.fromisoformat(f"{shift_date_str}T{shift_data['startTime']}")
                        end_time = datetime.fromisoformat(f"{shift_date_str}T{shift_data['endTime']}")
                        shift_hours = (end_time - start_time).total_seconds() / 3600
                        no_show_penalty_hours += shift_hours * 2
            except:
                continue
        
        # Calculate earnings
        gross_earnings = round(unpaid_hours * hourly_rate, 2)
        late_penalty = round(late_penalty_hours * hourly_rate, 2)
        no_show_penalty = round(no_show_penalty_hours * hourly_rate, 2)
        net_earnings = round(gross_earnings - late_penalty - no_show_penalty, 2)
        
        if net_earnings > 0:
            unpaid_list.append({
                "employeeId": uid,
                "employeeName": user_data.get('name', 'Unknown'),
                "role": user_data.get('role', 'EMPLOYEE'),
                "hourlyRate": hourly_rate,
                "unpaidHours": round(unpaid_hours, 2),
                "grossEarnings": gross_earnings,
                "lateCount": late_count,
                "latePenalty": late_penalty,
                "noShowCount": no_show_count,
                "noShowPenalty": no_show_penalty,
                "netEarnings": net_earnings,
                "month": current_month,
                "year": current_year,
            })
    
    return unpaid_list

@api_router.post("/payroll/mark-as-paid")
async def mark_as_paid(payment_data: PaymentRecord, user: dict = Depends(require_role(['OWNER', 'CO']))):
    """Mark employee's earnings as paid for a specific month - OWNER/CO only"""
    employee_id = payment_data.employeeId
    month = payment_data.month
    year = payment_data.year
    
    # Get all unpaid attendance for this employee and month
    month_start = datetime(year, month, 1).isoformat()
    # Get last day of month
    if month == 12:
        next_month = datetime(year + 1, 1, 1)
    else:
        next_month = datetime(year, month + 1, 1)
    month_end = (next_month - timedelta(days=1)).replace(hour=23, minute=59, second=59).isoformat()
    
    all_attendance = list(firebase_db.collection('attendance').where(
        'employeeId', '==', employee_id
    ).stream())
    
    # Filter unpaid attendance for this month
    unpaid_attendance = []
    for att in all_attendance:
        att_data = att.to_dict()
        if att_data.get('status') == 'CLOCKED_OUT' and not att_data.get('paid', False):
            clock_in_time = att_data.get('clockInTime', '')
            if month_start <= clock_in_time <= month_end:
                unpaid_attendance.append(att)
    
    if not unpaid_attendance:
        raise HTTPException(status_code=400, detail="No unpaid earnings for this period")
    
    # Get employee data
    user_doc = firebase_db.collection('users').document(employee_id).get()
    if not user_doc.exists:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    user_data = user_doc.to_dict()
    hourly_rate = user_data.get('salary', 0)
    
    # Calculate total earnings
    total_hours = 0
    late_count = 0
    late_penalty_hours = 0
    
    for att in unpaid_attendance:
        att_data = att.to_dict()
        clock_in = datetime.fromisoformat(att_data['clockInTime'].replace('Z', '+00:00'))
        clock_out = datetime.fromisoformat(att_data['clockOutTime'].replace('Z', '+00:00'))
        hours = (clock_out - clock_in).total_seconds() / 3600
        total_hours += hours
        
        if att_data.get('isLate', False):
            late_count += 1
            if late_count > 2:
                shift_id = att_data.get('shiftId')
                if shift_id:
                    shift_doc = firebase_db.collection('shifts').document(shift_id).get()
                    if shift_doc.exists:
                        shift_data = shift_doc.to_dict()
                        start_time = datetime.fromisoformat(f"{shift_data['date']}T{shift_data['startTime']}")
                        end_time = datetime.fromisoformat(f"{shift_data['date']}T{shift_data['endTime']}")
                        shift_hours = (end_time - start_time).total_seconds() / 3600
                        late_penalty_hours += shift_hours * 0.5
    
    # Calculate no-shows
    all_shifts = list(firebase_db.collection('shifts').where(
        'employeeId', '==', employee_id
    ).stream())
    
    no_show_count = 0
    no_show_penalty_hours = 0
    
    for shift in all_shifts:
        shift_data = shift.to_dict()
        shift_date_str = shift_data.get('date', '')
        
        try:
            shift_date = datetime.fromisoformat(shift_date_str).date()
            
            # Only check shifts in the payment period
            period_start = datetime(year, month, 1).date()
            period_end = (next_month - timedelta(days=1)).date()
            
            if period_start <= shift_date <= period_end:
                shift_id = shift.id
                has_attendance = any(
                    att.to_dict().get('shiftId') == shift_id 
                    for att in unpaid_attendance
                )
                
                if not has_attendance:
                    no_show_count += 1
                    start_time = datetime.fromisoformat(f"{shift_date_str}T{shift_data['startTime']}")
                    end_time = datetime.fromisoformat(f"{shift_date_str}T{shift_data['endTime']}")
                    shift_hours = (end_time - start_time).total_seconds() / 3600
                    no_show_penalty_hours += shift_hours * 2
        except:
            continue
    
    gross_earnings = round(total_hours * hourly_rate, 2)
    late_penalty = round(late_penalty_hours * hourly_rate, 2)
    no_show_penalty = round(no_show_penalty_hours * hourly_rate, 2)
    net_earnings = round(gross_earnings - late_penalty - no_show_penalty, 2)
    
    # Mark all attendance as paid
    for att in unpaid_attendance:
        firebase_db.collection('attendance').document(att.id).update({
            'paid': True,
            'paidAt': get_current_time().isoformat(),
            'paidBy': user['uid'],
        })
    
    # Create payment history record
    payment_record = {
        'id': str(uuid.uuid4()),
        'employeeId': employee_id,
        'employeeName': user_data.get('name', 'Unknown'),
        'month': month,
        'year': year,
        'totalHours': round(total_hours, 2),
        'grossEarnings': gross_earnings,
        'lateCount': late_count,
        'latePenalty': late_penalty,
        'noShowCount': no_show_count,
        'noShowPenalty': no_show_penalty,
        'netEarnings': net_earnings,
        'paymentDate': get_current_time().isoformat(),
        'paidBy': user['uid'],
        'paidByName': user.get('name', 'Unknown'),
    }
    
    firebase_db.collection('payment_history').document(payment_record['id']).set(payment_record)
    
    return payment_record

@api_router.get("/payroll/payment-history/{employee_id}")
async def get_payment_history(employee_id: str, user: dict = Depends(require_role(['OWNER', 'CO', 'ACCOUNTANT']))):
    """Get payment history for an employee - OWNER/CO/ACCOUNTANT"""
    payments = list(firebase_db.collection('payment_history').where(
        'employeeId', '==', employee_id
    ).stream())
    
    # Sort by date descending
    payment_list = [{"id": payment.id, **payment.to_dict()} for payment in payments]
    payment_list.sort(key=lambda x: x.get('paymentDate', ''), reverse=True)
    
    return payment_list

# ==================== EXPORT ROUTES ====================

@api_router.get("/exports/hours/{store_id}")
async def export_hours_csv(store_id: str, user: dict = Depends(require_role(['OWNER', 'CO', 'MANAGER', 'ACCOUNTANT']))):
    """Export hours worked to CSV with analytics - Management only"""
    from fastapi.responses import StreamingResponse
    import io
    
    # Get store details
    store_doc = firebase_db.collection('stores').document(store_id).get()
    if not store_doc.exists:
        raise HTTPException(status_code=404, detail="Store not found")
    
    store_data = store_doc.to_dict()
    store_name = store_data.get('name', 'Unknown')
    
    # Get all attendance for this store
    attendance_records = list(firebase_db.collection('attendance').where(
        'storeId', '==', store_id
    ).stream())
    
    # Create CSV content with BOM for Arabic support
    csv_content = "\ufeff"  # UTF-8 BOM
    csv_content += f"Store: {store_name}\n"
    csv_content += f"Generated: {get_current_time().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
    csv_content += "Date,Employee,Clock In,Clock Out,Total Hours\n"
    
    # Sort by employee name, then by date
    attendance_list = [{"id": att.id, **att.to_dict()} for att in attendance_records if att.to_dict().get('status') == 'CLOCKED_OUT']
    attendance_list.sort(key=lambda x: (x.get('employeeName', ''), x.get('clockInTime', '')))
    
    current_employee = None
    employee_total_minutes = 0
    grand_total_minutes = 0
    
    for record in attendance_list:
        employee_name = record.get('employeeName', 'Unknown')
        clock_in_str = record.get('clockInTime', '')
        clock_out_str = record.get('clockOutTime', '')
        
        if clock_in_str and clock_out_str:
            clock_in = datetime.fromisoformat(clock_in_str.replace('Z', '+00:00'))
            clock_out = datetime.fromisoformat(clock_out_str.replace('Z', '+00:00'))
            
            # Calculate duration in minutes and round to nearest minute
            duration_seconds = (clock_out - clock_in).total_seconds()
            duration_minutes = round(duration_seconds / 60)
            hours = duration_minutes // 60
            minutes = duration_minutes % 60
            duration_str = f"{hours:02d}:{minutes:02d}"
            
            # Check if we're starting a new employee section
            if current_employee != employee_name:
                # Print previous employee's subtotal
                if current_employee is not None and employee_total_minutes > 0:
                    hours = employee_total_minutes // 60
                    minutes = employee_total_minutes % 60
                    csv_content += f",,,,Subtotal: {hours:02d}:{minutes:02d}\n"
                    csv_content += "\n"  # Blank line between employees
                
                current_employee = employee_name
                employee_total_minutes = 0
            
            # Add to totals
            employee_total_minutes += duration_minutes
            grand_total_minutes += duration_minutes
            
            date_str = clock_in.strftime('%Y-%m-%d')
            time_in = clock_in.strftime('%H:%M')
            time_out = clock_out.strftime('%H:%M')
            
            csv_content += f"{date_str},{employee_name},{time_in},{time_out},{duration_str}\n"
    
    # Add last employee's subtotal
    if current_employee is not None and employee_total_minutes > 0:
        hours = employee_total_minutes // 60
        minutes = employee_total_minutes % 60
        csv_content += f",,,,Subtotal: {hours:02d}:{minutes:02d}\n"
    
    # Add grand total
    csv_content += "\n"
    hours = grand_total_minutes // 60
    minutes = grand_total_minutes % 60
    csv_content += f",,,,GRAND TOTAL: {hours:02d}:{minutes:02d}\n"
    
    # Create streaming response with URL-encoded filename for Arabic support
    output = io.StringIO()
    output.write(csv_content)
    output.seek(0)
    
    # URL-encode filename to support Arabic characters
    from urllib.parse import quote
    safe_store_name = quote(store_name.replace(' ', '_'))
    filename = f"hours_{safe_store_name}_{get_current_time().strftime('%Y%m%d')}.csv"
    
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8')),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{filename}"
        }
    )

@api_router.get("/exports/ingredients/{store_id}")
async def export_ingredients_csv(store_id: str, user: dict = Depends(require_role(['OWNER', 'CO', 'MANAGER']))):
    """Export ingredient counts to CSV with analytics - Management only"""
    from fastapi.responses import StreamingResponse
    import io
    
    # Get store details
    store_doc = firebase_db.collection('stores').document(store_id).get()
    if not store_doc.exists:
        raise HTTPException(status_code=404, detail="Store not found")
    
    store_data = store_doc.to_dict()
    store_name = store_data.get('name', 'Unknown')
    
    # Get all ingredient counts for this store
    counts = list(firebase_db.collection('ingredient_counts').where(
        'storeId', '==', store_id
    ).stream())
    
    # Get ingredient details
    ingredients_map = {}
    ingredients = list(firebase_db.collection('ingredients').where(
        'storeId', '==', store_id
    ).stream())
    
    for ing in ingredients:
        ing_data = ing.to_dict()
        ingredients_map[ing.id] = ing_data
    
    # Create CSV content with BOM for Arabic support
    csv_content = "\ufeff"  # UTF-8 BOM
    csv_content += f"Store: {store_name}\n"
    csv_content += f"Generated: {get_current_time().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
    csv_content += "Date,Ingredient,Count Type,First Count,Added,Final Count,Usage\n"
    
    # Group counts by ingredient and date
    counts_by_ingredient = {}
    for count in counts:
        count_data = count.to_dict()
        ingredient_id = count_data.get('ingredientId')
        date = count_data.get('date', '')
        
        if ingredient_id not in counts_by_ingredient:
            counts_by_ingredient[ingredient_id] = {}
        
        if date not in counts_by_ingredient[ingredient_id]:
            counts_by_ingredient[ingredient_id][date] = {
                'FIRST': 0,
                'ADD': 0,
                'FINAL': 0
            }
        
        count_type = count_data.get('countType', 'FIRST')
        value = count_data.get('value', 0)
        counts_by_ingredient[ingredient_id][date][count_type] = value
    
    # Sort ingredients by name
    sorted_ingredients = sorted(
        ingredients_map.items(),
        key=lambda x: x[1].get('name', '')
    )
    
    grand_total_usage = 0
    
    for ingredient_id, ingredient_data in sorted_ingredients:
        ingredient_name = ingredient_data.get('name', 'Unknown')
        count_type_str = ingredient_data.get('countType', 'BOX')
        
        if ingredient_id not in counts_by_ingredient:
            continue
        
        ingredient_total_usage = 0
        
        # Sort dates
        sorted_dates = sorted(counts_by_ingredient[ingredient_id].items())
        
        for date, counts_dict in sorted_dates:
            first = counts_dict['FIRST']
            added = counts_dict['ADD']
            final = counts_dict['FINAL']
            
            # Calculate usage: (First + Added) - Final
            usage = (first + added) - final
            ingredient_total_usage += usage
            grand_total_usage += usage
            
            # Format based on count type
            if count_type_str == 'KILO':
                first_str = f"{first:.2f}"
                added_str = f"{added:.2f}"
                final_str = f"{final:.2f}"
                usage_str = f"{usage:.2f}"
            else:
                first_str = f"{int(first)}"
                added_str = f"{int(added)}"
                final_str = f"{int(final)}"
                usage_str = f"{int(usage)}"
            
            csv_content += f"{date},{ingredient_name},{count_type_str},{first_str},{added_str},{final_str},{usage_str}\n"
        
        # Add ingredient subtotal
        if count_type_str == 'KILO':
            csv_content += f",,,,,,Subtotal: {ingredient_total_usage:.2f}\n"
        else:
            csv_content += f",,,,,,Subtotal: {int(ingredient_total_usage)}\n"
        csv_content += "\n"  # Blank line between ingredients
    
    # Add grand total
    csv_content += f",,,,,,GRAND TOTAL: {grand_total_usage:.2f}\n"
    
    # Create streaming response with URL-encoded filename for Arabic support
    output = io.StringIO()
    output.write(csv_content)
    output.seek(0)
    
    # URL-encode filename to support Arabic characters
    from urllib.parse import quote
    safe_store_name = quote(store_name.replace(' ', '_'))
    filename = f"ingredients_{safe_store_name}_{get_current_time().strftime('%Y%m%d')}.csv"
    
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8')),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{filename}"
        }
    )

# ==================== MULTI-TENANT ROUTES (VireoHR) ====================

@api_router.post("/auth/custom-token")
async def create_custom_token_signup(
    business_name: str,
    owner_name: str,
    owner_email: str,
    password: str
):
    """
    Create a new tenant and owner user, return custom token with tenantId claim
    Public endpoint (no auth required)
    
    Flow:
    1. Create tenant document in Firestore
    2. Create owner user in Firebase Auth
    3. Create owner document in Firestore with tenantId
    4. Generate custom token with tenantId claim
    5. Return token for client-side signInWithCustomToken
    """
    from utils.tenant import create_tenant_document, create_custom_token_with_tenant
    
    try:
        # Check if email already exists
        try:
            existing_user = admin_auth.get_user_by_email(owner_email)
            raise HTTPException(status_code=400, detail="Email already registered")
        except admin_auth.UserNotFoundError:
            pass  # Good, email is available
        
        # 1. Create tenant document
        tenant_id = create_tenant_document(firebase_db, owner_email, business_name)
        
        # 2. Create owner user in Firebase Auth
        owner_user = admin_auth.create_user(
            email=owner_email,
            password=password,
            display_name=owner_name
        )
        
        # 3. Create owner document in Firestore
        owner_doc = {
            'email': owner_email,
            'name': owner_name,
            'role': 'OWNER',
            'tenantId': tenant_id,
            'createdAt': get_current_time().isoformat(),
            'updatedAt': get_current_time().isoformat()
        }
        
        firebase_db.collection('users').document(owner_user.uid).set(owner_doc)
        
        # 4. Set custom claims on user
        admin_auth.set_custom_user_claims(owner_user.uid, {
            'tenantId': tenant_id,
            'role': 'OWNER'
        })
        
        # 5. Create custom token
        custom_token = create_custom_token_with_tenant(owner_user.uid, tenant_id, 'OWNER')
        
        return {
            'customToken': custom_token,
            'tenantId': tenant_id,
            'uid': owner_user.uid,
            'email': owner_email,
            'businessName': business_name
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating tenant: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create tenant: {str(e)}")


@api_router.get("/tenant/me")
async def get_my_tenant(token: dict = Depends(verify_token)):
    """Get current user's tenant information"""
    # Get tenant ID from token custom claims
    tenant_id = token.get('tenantId')
    
    if not tenant_id:
        raise HTTPException(status_code=404, detail="No tenant associated with this user")
    
    # Fetch tenant document
    tenant_doc = firebase_db.collection('tenants').document(tenant_id).get()
    
    if not tenant_doc.exists:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    tenant_data = tenant_doc.to_dict()
    
    return {
        'tenantId': tenant_id,
        'name': tenant_data.get('name', 'Unknown Business'),
        'status': tenant_data.get('status', 'active'),
        'subscriptionEnd': tenant_data.get('subscriptionEnd'),
        'ownerEmail': tenant_data.get('ownerEmail')
    }


@api_router.post("/tenant/overtime-toggle")
async def toggle_overtime(
    date: str,
    enabled: bool,
    user: dict = Depends(require_role(['OWNER', 'CO']))
):
    """
    Toggle overtime mode for a specific date
    When enabled, auto clock-out is disabled for that day
    OWNER/CO only
    """
    uid = user.get('uid')
    tenant_id = user.get('tenantId')
    
    if not tenant_id:
        raise HTTPException(status_code=400, detail="No tenant ID found")
    
    # Store overtime toggle in tenants/{tenantId}/overtime/{date} subcollection
    overtime_doc = {
        'date': date,
        'enabled': enabled,
        'setBy': uid,
        'setByName': user.get('name', 'Unknown'),
        'setAt': get_current_time().isoformat()
    }
    
    firebase_db.collection('tenants').document(tenant_id).collection('overtime').document(date).set(overtime_doc)
    
    return {
        'date': date,
        'enabled': enabled,
        'message': f"Overtime {'enabled' if enabled else 'disabled'} for {date}"
    }


@api_router.get("/tenant/overtime-toggle")
async def get_overtime_toggle(date: str, token: dict = Depends(verify_token)):
    """Get overtime toggle status for a specific date"""
    tenant_id = token.get('tenantId')
    
    if not tenant_id:
        return {'enabled': False}
    
    overtime_doc = firebase_db.collection('tenants').document(tenant_id).collection('overtime').document(date).get()
    
    if not overtime_doc.exists:
        return {'enabled': False, 'date': date}
    
    overtime_data = overtime_doc.to_dict()
    return {
        'enabled': overtime_data.get('enabled', False),
        'date': date
    }


# ==================== SUPER-ADMIN ROUTES ====================

@api_router.get("/admin/tenants")
async def list_all_tenants(
    request: Request,
    user: dict = Depends(require_role(['superadmin']))
):
    """List all tenants with pagination - Super Admin only"""
    # Get pagination params from query string
    skip = int(request.query_params.get("skip", 0))
    limit = int(request.query_params.get("limit", 50))
    
    tenants = list(firebase_db.collection('tenants').stream())
    
    tenant_list = []
    for tenant in tenants:
        tenant_data = tenant.to_dict()
        tenant_list.append({
            'id': tenant.id,
            'tenantId': tenant_data.get('tenantId'),
            'name': tenant_data.get('name'),
            'ownerEmail': tenant_data.get('ownerEmail'),
            'status': tenant_data.get('status', 'active'),
            'subscriptionEnd': tenant_data.get('subscriptionEnd'),
            'createdAt': tenant_data.get('createdAt')
        })
    
    # Sort by creation date descending
    tenant_list.sort(key=lambda x: x.get('createdAt', ''), reverse=True)
    
    # Apply pagination
    total = len(tenant_list)
    paginated_list = tenant_list[skip:skip + limit]
    
    return {
        'tenants': paginated_list,
        'total': total,
        'skip': skip,
        'limit': limit,
        'hasMore': skip + limit < total
    }


@api_router.post("/admin/tenants/{tenant_id}/suspend")
async def suspend_tenant(tenant_id: str, suspend: bool, user: dict = Depends(require_role(['superadmin']))):
    """Suspend or activate a tenant - Super Admin only"""
    tenant_ref = firebase_db.collection('tenants').document(tenant_id)
    tenant_doc = tenant_ref.get()
    
    if not tenant_doc.exists:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    new_status = 'suspended' if suspend else 'active'
    
    tenant_ref.update({
        'status': new_status,
        'updatedAt': get_current_time().isoformat(),
        'updatedBy': user.get('uid')
    })
    
    return {
        'tenantId': tenant_id,
        'status': new_status,
        'message': f"Tenant {'suspended' if suspend else 'activated'} successfully"
    }


@api_router.put("/admin/tenants/{tenant_id}/subscription")
async def update_subscription(
    tenant_id: str,
    subscription_end: str,
    user: dict = Depends(require_role(['superadmin']))
):
    """Update tenant subscription end date - Super Admin only"""
    tenant_ref = firebase_db.collection('tenants').document(tenant_id)
    tenant_doc = tenant_ref.get()
    
    if not tenant_doc.exists:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    tenant_ref.update({
        'subscriptionEnd': subscription_end,
        'updatedAt': get_current_time().isoformat(),
        'updatedBy': user.get('uid')
    })
    
    return {
        'tenantId': tenant_id,
        'subscriptionEnd': subscription_end,
        'message': 'Subscription updated successfully'
    }


# ==================== PAYROLL EXPORT ROUTE ====================

@api_router.get("/export/payroll")
async def export_payroll_csv(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    user: dict = Depends(require_role(['OWNER', 'CO', 'ACCOUNTANT']))
):
    """
    Export payroll data to CSV
    Includes: employee name, hours worked, salary, penalties, net pay
    """
    from fastapi.responses import StreamingResponse
    import io
    from datetime import datetime
    
    tenant_id = user.get('tenantId')
    
    # Default to current month if no dates provided
    if not from_date or not to_date:
        today = get_current_time().date()
        from_date = datetime(today.year, today.month, 1).isoformat()
        to_date = datetime.combine(today, datetime.max.time()).isoformat()
    
    # Get all employees for this tenant
    from utils.helpers import get_all_employees
    all_users = get_all_employees(firebase_db, tenant_id=tenant_id)
    
    # Create CSV content with BOM for Arabic support
    csv_content = "\ufeff"  # UTF-8 BOM
    csv_content += f"Payroll Report\n"
    csv_content += f"Period: {from_date[:10]} to {to_date[:10]}\n"
    csv_content += f"Generated: {get_current_time().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
    csv_content += "Employee Name,Role,Hourly Rate,Hours Worked,Gross Pay,Late Count,Late Penalty,No-Show Count,No-Show Penalty,Net Pay\n"
    
    total_hours = 0
    total_gross = 0
    total_net = 0
    
    for user_doc in all_users:
        user_data = user_doc.to_dict()
        uid = user_doc.id
        employee_name = user_data.get('name', 'Unknown')
        role = user_data.get('role', 'EMPLOYEE')
        hourly_rate = user_data.get('salary', 0)
        
        if not hourly_rate or hourly_rate <= 0:
            continue
        
        # Get attendance for this period
        all_attendance = list(firebase_db.collection('attendance').where(
            'employeeId', '==', uid
        ).where('tenantId', '==', tenant_id).stream())
        
        period_attendance = []
        for att in all_attendance:
            att_data = att.to_dict()
            if att_data.get('status') == 'CLOCKED_OUT':
                clock_in_time = att_data.get('clockInTime', '')
                if from_date <= clock_in_time <= to_date:
                    period_attendance.append(att)
        
        # Calculate hours and penalties
        hours_worked = 0
        late_count = 0
        late_penalty_hours = 0
        
        for att in period_attendance:
            att_data = att.to_dict()
            clock_in = datetime.fromisoformat(att_data['clockInTime'].replace('Z', '+00:00'))
            clock_out = datetime.fromisoformat(att_data['clockOutTime'].replace('Z', '+00:00'))
            hours = (clock_out - clock_in).total_seconds() / 3600
            hours_worked += hours
            
            if att_data.get('isLate', False):
                late_count += 1
                if late_count > 2:
                    shift_id = att_data.get('shiftId')
                    if shift_id:
                        shift_doc = firebase_db.collection('shifts').document(shift_id).get()
                        if shift_doc.exists:
                            shift_data = shift_doc.to_dict()
                            start_time = datetime.fromisoformat(f"{shift_data['date']}T{shift_data['startTime']}")
                            end_time = datetime.fromisoformat(f"{shift_data['date']}T{shift_data['endTime']}")
                            shift_hours = (end_time - start_time).total_seconds() / 3600
                            late_penalty_hours += shift_hours * 0.5
        
        # Calculate no-shows
        all_shifts = list(firebase_db.collection('shifts').where(
            'employeeId', '==', uid
        ).where('tenantId', '==', tenant_id).stream())
        
        no_show_count = 0
        no_show_penalty_hours = 0
        
        from_date_obj = datetime.fromisoformat(from_date).date()
        to_date_obj = datetime.fromisoformat(to_date).date()
        
        for shift in all_shifts:
            shift_data = shift.to_dict()
            shift_date_str = shift_data.get('date', '')
            
            try:
                shift_date = datetime.fromisoformat(shift_date_str).date()
                
                if from_date_obj <= shift_date <= to_date_obj:
                    shift_id = shift.id
                    has_attendance = any(
                        att.to_dict().get('shiftId') == shift_id 
                        for att in period_attendance
                    )
                    
                    if not has_attendance:
                        no_show_count += 1
                        start_time = datetime.fromisoformat(f"{shift_date_str}T{shift_data['startTime']}")
                        end_time = datetime.fromisoformat(f"{shift_date_str}T{shift_data['endTime']}")
                        shift_hours = (end_time - start_time).total_seconds() / 3600
                        no_show_penalty_hours += shift_hours * 2
            except:
                continue
        
        # Calculate earnings
        from utils.helpers import calculate_net_earnings
        earnings = calculate_net_earnings(hours_worked, hourly_rate, late_penalty_hours, no_show_penalty_hours)
        
        if hours_worked > 0 or no_show_count > 0:
            csv_content += f"{employee_name},{role},{hourly_rate:.2f},{hours_worked:.2f},{earnings['gross']:.2f},{late_count},{earnings['late_penalty']:.2f},{no_show_count},{earnings['no_show_penalty']:.2f},{earnings['net']:.2f}\n"
            
            total_hours += hours_worked
            total_gross += earnings['gross']
            total_net += earnings['net']
    
    # Add totals row
    csv_content += f"\nTOTALS,,{total_hours:.2f},{total_gross:.2f},,,,{total_net:.2f}\n"
    
    # Create streaming response
    output = io.StringIO()
    output.write(csv_content)
    output.seek(0)
    
    filename = f"payroll_{from_date[:7]}.csv"
    
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8')),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


# Mount API router
app.mount("/api", api_router)

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get('PORT', 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)