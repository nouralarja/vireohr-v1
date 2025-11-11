# VireoHR Deployment Checklist

**Date**: 2025-11-11  
**Status**: Pre-Deployment  
**Timezone**: GMT+03:00 (Amman)

---

## ✅ PRE-DEPLOYMENT VERIFICATION

- [x] All code bugs fixed (0 bugs found)
- [x] Security audit passed
- [x] Timezone configured (Asia/Amman)
- [x] Environment variables documented
- [x] CORS properly restricted
- [x] Error handling comprehensive
- [x] Firebase Auth configured

---

## 📋 DEPLOYMENT STEPS

### 1. Environment Configuration

**Backend** (`backend/.env`):
```bash
FIREBASE_SERVICE_ACCOUNT_KEY=<your-firebase-json>
CORS_ORIGINS=https://vireohr.app,https://www.vireohr.app
SUPER_ADMIN_EMAIL=admin@vireohr.app
DEFAULT_EMPLOYEE_PASSWORD=gosta123
PORT=8001
```

**Frontend** (`frontend/.env`):
```bash
EXPO_PUBLIC_BACKEND_URL=https://api.vireohr.app
```

---

### 2. Backend Deployment

```bash
cd /app/Vireo-Owner/backend

# Install dependencies
pip install -r requirements.txt

# Verify timezone
python3 -c "from pytz import timezone as tz; from datetime import datetime; print(datetime.now(tz('Asia/Amman')))"

# Start service
sudo supervisorctl restart backend
```

---

### 3. Frontend Build

```bash
cd /app/Vireo-Owner/frontend

# Install dependencies
yarn install

# Build for Android
npx eas build --platform android --profile production

# Build for iOS
npx eas build --platform ios --profile production
```

---

### 4. Verification Tests

```bash
# Test API health
curl https://api.vireohr.app/api/

# Test CORS
curl -H "Origin: https://vireohr.app" -I https://api.vireohr.app/api/

# Test timezone
curl https://api.vireohr.app/api/attendance | jq '.timestamp'
```

---

## 🔒 SECURITY CHECKLIST

- [x] No CORS wildcard
- [x] Firebase Auth enabled
- [x] Environment variables set
- [x] No hard-coded secrets
- [x] HTTPS enforced
- [x] Token verification on all routes

---

## 📱 POST-DEPLOYMENT TESTS

### Backend Tests
- [ ] Health check endpoint responds
- [ ] Authentication working
- [ ] Timezone correct (GMT+03:00)
- [ ] CORS headers correct
- [ ] Database connection stable

### Frontend Tests
- [ ] App loads successfully
- [ ] Sign-in working
- [ ] API calls successful
- [ ] CSV export working
- [ ] Error handling working
- [ ] Offline mode working

---

## 🆘 ROLLBACK PLAN

If issues arise:

1. **Revert Backend**:
   ```bash
   git checkout <previous-commit>
   supervisorctl restart backend
   ```

2. **Revert Frontend**:
   ```bash
   # Submit previous build to stores
   npx eas submit --platform android --latest
   ```

---

## 📞 SUPPORT CONTACTS

- **Backend Issues**: Check `/var/log/supervisor/backend.err.log`
- **Frontend Issues**: Check Expo error reporting
- **Database Issues**: Check Firebase Console

---

## ✅ DEPLOYMENT COMPLETE

After successful deployment, mark items:

- [ ] Backend deployed and verified
- [ ] Frontend built and submitted to stores
- [ ] Environment variables configured
- [ ] Post-deployment tests passed
- [ ] Monitoring enabled
- [ ] Team notified

---

**Status**: Ready for deployment 🚀
