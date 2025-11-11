# VireoHR Multi-Tenant MVP - Implementation Guide

## 📋 Overview

VireoHR extends the Gosta employee management system with multi-tenancy support, allowing multiple businesses to use the same platform with complete data isolation.

## 🏗️ Architecture

### Backend (FastAPI)
- **Tenant Middleware**: Extracts `tenantId` from JWT custom claims
- **Tenant Isolation**: All Firestore queries filtered by `tenantId`
- **Super Admin Bypass**: Users with `role='superadmin'` can access all tenants
- **Custom Token Generation**: Creates tenants and returns Firebase custom tokens

### Frontend (React Native/Expo)
- **TenantContext**: Provides tenant information throughout the app
- **Signup Flow**: Creates new tenant + owner user in one step
- **HeaderBar**: Displays tenant business name
- **Role-based UI**: Different screens for Owner, Employee, Super Admin

## 🚀 Setup & Deployment

### 1. Run Migration Script

```bash
cd /app/Vireo-Owner
python3 scripts/migrate_multi_tenant.py
```

This script will:
- Create a default tenant from the first OWNER user
- Add `tenantId` field to all existing Firestore documents
- Set custom claims with `tenantId` for all users

### 2. Configure Environment Variables

Update `backend/.env`:

```env
# Multi-Tenant Configuration
JWT_SECRET=vireohr_secret_key_change_in_production
SUPER_ADMIN_EMAIL=admin@vireohr.com
```

### 3. Setup Auto Clock-Out Cron Job

**Option A: Using crontab**

```bash
# Make script executable
chmod +x /app/Vireo-Owner/cron/auto_clockout.sh

# Edit crontab
crontab -e

# Add this line (runs daily at 00:05 AM)
5 0 * * * /app/Vireo-Owner/cron/auto_clockout.sh >> /var/log/vireohr_clockout.log 2>&1
```

**Option B: Using systemd timer**

Create `/etc/systemd/system/vireohr-clockout.service`:

```ini
[Unit]
Description=VireoHR Auto Clock-Out Service

[Service]
Type=oneshot
ExecStart=/app/Vireo-Owner/cron/auto_clockout.sh
User=www-data
Environment="API_URL=http://localhost:8001/api"
```

Create `/etc/systemd/system/vireohr-clockout.timer`:

```ini
[Unit]
Description=VireoHR Auto Clock-Out Timer

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable vireohr-clockout.timer
sudo systemctl start vireohr-clockout.timer
```

### 4. Create Super Admin User (Manual)

```bash
# In Firebase Console or using Firebase Admin SDK
# Set custom claims for super admin user:
{
  "role": "superadmin",
  "tenantId": null
}
```

Or using Firebase CLI:

```bash
firebase auth:set-claims <uid> '{"role":"superadmin"}'
```

## 📱 New Features

### 1. Tenant Signup (Public)

**Endpoint**: `POST /api/auth/custom-token`

**Parameters**:
- `business_name`: Business/tenant name
- `owner_name`: Owner's full name
- `owner_email`: Owner's email
- `password`: Owner's password

**Flow**:
1. Creates tenant document in Firestore
2. Creates owner user in Firebase Auth
3. Creates owner document with `tenantId`
4. Returns custom token with `tenantId` claim
5. Client signs in with custom token

**Frontend**: `app/(auth)/signup.tsx`

### 2. Tenant Context (Frontend)

**Hook**: `useTenant()`

```typescript
import { useTenant } from '../contexts/TenantContext';

const { tenant, loading, refreshTenant } = useTenant();

// tenant object:
{
  tenantId: string;
  name: string;
  status: 'active' | 'suspended';
  subscriptionEnd: string;
  ownerEmail: string;
}
```

### 3. Overtime Toggle (Owner/CO)

**Endpoints**:
- `POST /api/tenant/overtime-toggle?date=YYYY-MM-DD&enabled=true`
- `GET /api/tenant/overtime-toggle?date=YYYY-MM-DD`

**Usage**: When overtime is enabled for a date, auto clock-out is skipped for that day.

### 4. Super Admin Dashboard

**Screen**: `app/(admin)/index.tsx` (TODO: Implement)

**Endpoints**:
- `GET /api/admin/tenants` - List all tenants
- `POST /api/admin/tenants/{id}/suspend?suspend=true` - Suspend/activate
- `PUT /api/admin/tenants/{id}/subscription` - Update subscription date

### 5. Payroll CSV Export (Owner/CO/Accountant)

**Endpoint**: `GET /api/export/payroll?from_date=YYYY-MM-DD&to_date=YYYY-MM-DD`

**Returns**: CSV file with:
- Employee name, role, hourly rate
- Hours worked, gross pay
- Late count/penalty, no-show count/penalty
- Net pay

**Frontend**: Add export button to `app/(tabs)/payroll.tsx` (TODO: Implement)

## 🔧 Backend API Changes

### All Existing Endpoints

All existing endpoints now support multi-tenancy:
- Automatically filter by `tenantId` from JWT
- Super admin can access all tenants
- No breaking changes to endpoint signatures

### New Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/custom-token` | None | Create tenant + owner |
| GET | `/api/tenant/me` | User | Get current tenant info |
| POST | `/api/tenant/overtime-toggle` | Owner/CO | Toggle overtime mode |
| GET | `/api/tenant/overtime-toggle` | User | Get overtime status |
| GET | `/api/admin/tenants` | Super Admin | List all tenants |
| POST | `/api/admin/tenants/{id}/suspend` | Super Admin | Suspend/activate tenant |
| PUT | `/api/admin/tenants/{id}/subscription` | Super Admin | Update subscription |
| GET | `/api/export/payroll` | Owner/CO/Accountant | Export payroll CSV |

## 📂 File Changes

### Backend

**New Files**:
- `backend/utils/tenant.py` - Tenant utilities
- `scripts/migrate_multi_tenant.py` - Migration script
- `cron/auto_clockout.sh` - Cron script

**Modified Files**:
- `backend/server.py` - Added tenant middleware, new endpoints
- `backend/utils/helpers.py` - Added tenant filtering support
- `backend/.env` - Added JWT_SECRET, SUPER_ADMIN_EMAIL

### Frontend

**New Files**:
- `frontend/contexts/TenantContext.tsx` - Tenant context provider
- `frontend/app/(auth)/signup.tsx` - Signup screen

**Modified Files**:
- `frontend/app/_layout.tsx` - Added TenantProvider
- `frontend/app/(auth)/sign-in.tsx` - Added signup link
- `frontend/components/HeaderBar.tsx` - Display tenant name

**TODO Files** (Phase 2):
- `frontend/app/(admin)/index.tsx` - Super admin dashboard
- `frontend/app/(tabs)/home.tsx` - Add overtime toggle for owners
- `frontend/app/(tabs)/payroll.tsx` - Add export CSV button

## 🔒 Security

### Tenant Isolation

1. **JWT Custom Claims**: `tenantId` embedded in Firebase token
2. **Backend Middleware**: All queries filtered by `tenantId`
3. **Super Admin Bypass**: Only users with `role='superadmin'` can bypass
4. **No Firestore Rules**: Security enforced in FastAPI middleware

### Authentication Flow

```
1. User signs up → Tenant created → Custom token generated
2. Client signs in with custom token → Firebase sets custom claims
3. All API requests include JWT with tenantId
4. Backend validates and filters by tenantId
```

## 🧪 Testing

### Test Tenant Creation

```bash
curl -X POST "http://localhost:8001/api/auth/custom-token" \
  -G \
  --data-urlencode "business_name=Test Business" \
  --data-urlencode "owner_name=John Doe" \
  --data-urlencode "owner_email=john@test.com" \
  --data-urlencode "password=test123"
```

### Test Overtime Toggle

```bash
# Enable overtime
curl -X POST "http://localhost:8001/api/tenant/overtime-toggle?date=2025-01-15&enabled=true" \
  -H "Authorization: Bearer <token>"

# Check status
curl -X GET "http://localhost:8001/api/tenant/overtime-toggle?date=2025-01-15" \
  -H "Authorization: Bearer <token>"
```

### Test Payroll Export

```bash
curl -X GET "http://localhost:8001/api/export/payroll?from_date=2025-01-01&to_date=2025-01-31" \
  -H "Authorization: Bearer <token>" \
  -o payroll_january.csv
```

## 📊 Database Schema

### New Collection: `tenants`

```javascript
{
  tenantId: string (UUID),
  name: string,
  ownerEmail: string,
  status: 'active' | 'suspended',
  subscriptionEnd: string (ISO date),
  createdAt: string (ISO timestamp),
  updatedAt: string (ISO timestamp)
}
```

### New Field on All Collections: `tenantId`

All existing collections now have `tenantId: string` field:
- `users`
- `stores`
- `shifts`
- `attendance`
- `ingredients`
- `ingredient_counts`
- `leave_requests`
- `payment_history`

### Subcollection: `tenants/{tenantId}/overtime/{date}`

```javascript
{
  date: string (YYYY-MM-DD),
  enabled: boolean,
  setBy: string (uid),
  setByName: string,
  setAt: string (ISO timestamp)
}
```

## 🚧 Remaining Work (Phase 2)

### High Priority

1. **Super Admin Dashboard** (app/(admin)/index.tsx)
   - List all tenants
   - Suspend/activate toggle
   - Update subscription date picker

2. **Owner Home Enhancement** (app/(tabs)/home.tsx)
   - Add overtime toggle switch
   - Show store names in "Currently Working" list

3. **Payroll Enhancements** (app/(tabs)/payroll.tsx)
   - Add "Export CSV" button
   - Add "Mark Paid" switch per employee
   - Add edit modal for salary + expected hours

4. **Employee Home Enhancement** (app/(tabs)/clock.tsx)
   - Add "Store: X" label under clock button

### Medium Priority

5. **Push Notifications**
   - Shift reminders
   - Leave decision notifications

6. **Arabic Translations**
   - Add i18n keys for new UI strings

### Low Priority

7. **Documentation**
   - Video tutorial for tenant creation
   - Admin user guide

## 🐛 Known Issues

None at this time.

## 📞 Support

For issues or questions, contact the development team.

---

**VireoHR** - Built on Gosta | Multi-tenant employee management for modern businesses
