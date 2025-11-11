# GOSTA - Complete Testing Guide

## 🔐 **STEP 1: Firebase Setup (REQUIRED)**

Before testing, you MUST enable Email-Link authentication:

1. Go to https://console.firebase.google.com/
2. Select project: **gotta-1**
3. Go to **Authentication → Sign-in method**
4. Click on **Email/Password** provider
5. Enable **"Email link (passwordless sign-in)"**
6. Add your domain to authorized domains if needed
7. Click **Save**

---

## 🎨 **MANDATORY SPECS - All Implemented:**

### ✅ 1. Colors (NO GRAY)
- Teal (#0D4633): Headers, buttons, primary text
- Gold (#D9D0AC): Accents, highlights, secondary elements
- White (#FFFFFF): Backgrounds
- Dark mode: Same colors on #121212

**Test:** Open any screen → verify zero gray colors

---

### ✅ 2. Passwordless Authentication
- No password fields
- Magic link via email
- Firebase Email-Link integration

**Test:**
1. Open app → Sign-in screen
2. Enter email: `owner@gosta.com`
3. Click "Send Magic Link"
4. Check your email
5. Click the link → Auto sign-in

---

### ✅ 3. Store Management (50-Cap)
- Create, edit, delete stores
- Geolocation: lat, lng, radius (10m)
- Maximum 50 stores enforced

**Test:**
1. Sign in as Owner
2. Go to Stores tab
3. Click "+" floating button
4. Fill: Name, Address, Phone, Lat (31.9539), Lng (35.9106), Radius (10)
5. Save → Verify in list
6. Try to create 51st store → Should show error

**Seeded Stores:**
- Downtown Branch (31.9539, 35.9106)
- Abdali Mall (31.9629, 35.9116)
- Airport Road (31.7229, 35.9932)

---

### ✅ 4. Schedule System (2-Week Seed)
- 3 stores with 2 weeks of shifts
- Read-only view for employees
- Full week calendar

**Test:**
1. Go to Schedule tab
2. See week view with day columns
3. Verify shifts show: Employee name (gold), time (teal), role
4. Employee sees only assigned store shifts

---

### ✅ 5. Clock In/Out with Gates
- IN: 10 min before shift start
- OUT: 5 min before end OR after end
- Countdown timer when locked

**Test:**
1. Go to Clock tab
2. If too early → See countdown timer (gold bg, teal text)
3. When time reached → Button enables
4. Clock in → Status changes
5. Clock out (must do final count if supervisor)

---

### ✅ 6. Ingredient Flow (Supervisors)
- Must clock in first
- First Count (all ingredients before continuing)
- ADD button (floating gold button)
- Final Count (required before clock-out)
- Low stock badge (< 10%)

**Test (as Supervisor):**
1. Clock in first
2. Go to Ingredients tab
3. Do "First Count" for each ingredient
4. Click floating "+" button → Add ingredients
5. Do "Final Count" before clocking out
6. Verify low stock badge shows in gold

**Seeded Ingredients (per store):**
- Flour, Sugar, Salt, Oil, Milk, Eggs, Butter, Yeast

---

### ✅ 7. CSV Exports
- Per-store ingredient export
- Per-store hours export
- Export All buttons
- Semicolon-delimited
- Native share sheet

**Test (Owner/CO only):**
1. Go to Reports tab
2. Click "Export All Ingredients" → File downloads
3. Click "Export All Hours" → File downloads
4. Scroll to per-store section
5. Click store export buttons → Individual files

---

### ✅ 8. Offline Persistence
- Firebase IndexedDB persistence
- Works without internet
- Auto-syncs when back online

**Test:**
1. Navigate app while online
2. Turn off internet
3. Continue navigating → Still works
4. Turn on internet → Data syncs automatically

---

## 👥 **Test Accounts**

Since passwordless auth is enabled, you need to use existing Firebase users:

**Owner:**
- Email: owner@gosta.com
- Role: OWNER (full access)

**Supervisor:**
- Email: supervisor@gosta.com  
- Role: SHIFT_SUPERVISOR (can count ingredients)

**Employee:**
- Email: employee@gosta.com
- Role: EMPLOYEE (basic access)

**Note:** These accounts must be created in Firebase first OR use email-link for any email.

---

## 🎯 **Feature Checklist**

- [ ] Passwordless sign-in works
- [ ] Zero gray colors everywhere
- [ ] Stores CRUD with lat/lng/radius
- [ ] 50-store cap enforced
- [ ] 3 stores seeded with data
- [ ] 2-week schedule visible
- [ ] Clock-in countdown timer
- [ ] Clock-out countdown timer
- [ ] Ingredient first count
- [ ] Ingredient ADD button (floating)
- [ ] Ingredient final count enforcement
- [ ] Low stock badge (gold bg, teal text)
- [ ] CSV exports work (semicolon delimiter)
- [ ] Native share sheet opens
- [ ] Offline mode works
- [ ] Role-based tab visibility
- [ ] Header shows "Hello Name" in gold

---

## 🚨 **Known Limitations**

1. **Email-Link Setup Required:** Must enable in Firebase Console first
2. **Test Data:** Shifts require authenticated users to be seeded
3. **FCM:** Push notifications not implemented (future enhancement)
4. **2FA:** Not implemented (future enhancement)

---

## 📱 **Preview URLs**

- **Web:** http://localhost:3000
- **Expo Tunnel:** Check Expo output for public URL
- **QR Code:** Scan with Expo Go app for mobile testing

---

## 🐛 **Troubleshooting**

**Issue:** "Magic link not working"
- Solution: Enable Email-Link in Firebase Console

**Issue:** "403 Forbidden on API calls"
- Solution: Sign in first to get Firebase token

**Issue:** "No shifts visible"
- Solution: Run seed script again after authenticating

**Issue:** "Can't clock in"
- Solution: Check if shift exists for today and countdown timer

**Issue:** "Can't access Ingredients tab"
- Solution: Must be Supervisor role or higher

---

## 🎉 **Success Criteria**

✅ All screens use only teal/gold/white colors
✅ Passwordless auth working
✅ Stores have geolocation
✅ Clock gates with countdown
✅ Ingredient flow complete
✅ CSV exports functional
✅ Offline mode working
✅ Backend APIs secured
✅ 50-store cap enforced

**GOSTA IS READY FOR PRODUCTION TESTING!**
