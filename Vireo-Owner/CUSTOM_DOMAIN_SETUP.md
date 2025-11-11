# 🔗 CUSTOM DOMAIN SETUP GUIDE
## gostacoffee.com - Gosta Employee Management System

---

## ✅ WHAT'S BEEN CONFIGURED

### 1. App Configuration Updated
- **Custom URL Scheme**: `gostacoffee://`
- **iOS Bundle ID**: `com.gostacoffee.employee`
- **Android Package**: `com.gostacoffee.employee`
- **Deep Links**: `https://gostacoffee.com/app`

### 2. Universal/App Links Setup
- **iOS**: Associated domains configured
- **Android**: Intent filters configured
- **Both platforms** can open: `https://gostacoffee.com/app`

---

## 🌐 DNS CONFIGURATION REQUIRED

You need to add these DNS records in your domain registrar (e.g., GoDaddy, Namecheap, Cloudflare):

### Option A: Backend API on Subdomain (Recommended)

```
Type: A Record
Name: api
Value: <YOUR_SERVER_IP>
TTL: 3600

Type: A Record  
Name: @
Value: <YOUR_SERVER_IP>
TTL: 3600

Type: CNAME
Name: www
Value: gostacoffee.com
TTL: 3600
```

**Result:**
- API: `https://api.gostacoffee.com/api/`
- App Links: `https://gostacoffee.com/app`
- Website: `https://www.gostacoffee.com`

### Option B: Everything on Root Domain

```
Type: A Record
Name: @
Value: <YOUR_SERVER_IP>
TTL: 3600

Type: CNAME
Name: www
Value: gostacoffee.com
TTL: 3600
```

**Result:**
- API: `https://gostacoffee.com/api/`
- App Links: `https://gostacoffee.com/app`

---

## 📱 DEEP LINKING CONFIGURATION

### iOS Universal Links

1. **Create apple-app-site-association file** on your server:
```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAM_ID.com.gostacoffee.employee",
        "paths": ["/app", "/app/*"]
      }
    ]
  }
}
```

2. **Host it at**:
   - `https://gostacoffee.com/.well-known/apple-app-site-association`
   - `https://gostacoffee.com/apple-app-site-association`

3. **Content-Type**: `application/json` (no file extension)

### Android App Links

1. **Create assetlinks.json file**:
```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.gostacoffee.employee",
    "sha256_cert_fingerprints": ["YOUR_APP_SHA256_FINGERPRINT"]
  }
}]
```

2. **Host it at**:
   - `https://gostacoffee.com/.well-known/assetlinks.json`

3. **Get SHA256 fingerprint**:
```bash
keytool -list -v -keystore YOUR_KEYSTORE.keystore
```

---

## 🔐 SSL CERTIFICATE SETUP

You MUST have HTTPS for deep linking to work.

### Option A: Let's Encrypt (Free)

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d gostacoffee.com -d www.gostacoffee.com -d api.gostacoffee.com

# Auto-renewal (runs every 12 hours)
sudo certbot renew --dry-run
```

### Option B: Cloudflare (Free + CDN)

1. Sign up at cloudflare.com
2. Add your domain
3. Update nameservers at your registrar
4. Enable "Full (strict)" SSL mode
5. Turn on "Always Use HTTPS"

---

## 🚀 DEPLOYMENT STEPS

### Step 1: Point Domain to Your Server

**Find your server IP:**
```bash
# If deployed on cloud (AWS, GCP, etc.)
# Check your cloud provider dashboard

# If using current preview URL
# You need to deploy to production server first
```

**Add DNS records** (see DNS Configuration above)

### Step 2: Update Backend Environment

Create production `.env` file:
```bash
# Backend Production URLs
API_URL=https://api.gostacoffee.com
FRONTEND_URL=https://gostacoffee.com

# Or if using root domain for API
API_URL=https://gostacoffee.com/api
```

### Step 3: Update Frontend Environment

Update `/app/frontend/.env`:
```bash
EXPO_PUBLIC_BACKEND_URL=https://api.gostacoffee.com
# Or: EXPO_PUBLIC_BACKEND_URL=https://gostacoffee.com
```

### Step 4: Configure Web Server (Nginx)

```nginx
# /etc/nginx/sites-available/gostacoffee

# Backend API
server {
    listen 443 ssl http2;
    server_name api.gostacoffee.com;
    
    ssl_certificate /etc/letsencrypt/live/api.gostacoffee.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.gostacoffee.com/privkey.pem;
    
    location /api {
        proxy_pass http://localhost:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# App Deep Links & Website
server {
    listen 443 ssl http2;
    server_name gostacoffee.com www.gostacoffee.com;
    
    ssl_certificate /etc/letsencrypt/live/gostacoffee.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gostacoffee.com/privkey.pem;
    
    # Serve universal links files
    location /.well-known/ {
        root /var/www/gostacoffee;
    }
    
    location /apple-app-site-association {
        root /var/www/gostacoffee;
        default_type application/json;
    }
    
    # Optional: Serve a landing page
    location / {
        root /var/www/gostacoffee/html;
        index index.html;
    }
}
```

### Step 5: Build & Deploy App

```bash
# Build for iOS
eas build --platform ios --profile production

# Build for Android
eas build --platform android --profile production

# Both
eas build --platform all --profile production
```

---

## 🧪 TESTING YOUR SETUP

### Test DNS
```bash
# Check if DNS is propagated
nslookup gostacoffee.com
nslookup api.gostacoffee.com

# Check SSL
curl -I https://gostacoffee.com
curl -I https://api.gostacoffee.com
```

### Test Deep Links

**iOS:**
```bash
# Send deep link to device
xcrun simctl openurl booted "https://gostacoffee.com/app"

# Or manually:
# Open Safari on iPhone
# Type: gostacoffee.com/app
# Should open your app
```

**Android:**
```bash
# Send deep link to device
adb shell am start -W -a android.intent.action.VIEW -d "https://gostacoffee.com/app"

# Or manually:
# Open Chrome on Android
# Type: gostacoffee.com/app
# Should open your app
```

### Test API
```bash
# Test backend API
curl https://api.gostacoffee.com/api/
# Should return: {"message": "Gosta API is running"}

# Or if root domain:
curl https://gostacoffee.com/api/
```

---

## 📋 CHECKLIST

### DNS Setup
- [ ] Add A record for `@` (root)
- [ ] Add A record for `api` subdomain
- [ ] Add CNAME for `www`
- [ ] Wait for propagation (15 min - 48 hours)

### SSL Certificate
- [ ] Install certbot or use Cloudflare
- [ ] Obtain SSL certificate
- [ ] Configure auto-renewal
- [ ] Test HTTPS works

### Web Server
- [ ] Install/configure Nginx or Apache
- [ ] Add site configuration
- [ ] Enable site
- [ ] Restart web server

### Deep Links
- [ ] Create apple-app-site-association
- [ ] Create assetlinks.json
- [ ] Upload to /.well-known/ folder
- [ ] Test files accessible

### App Configuration
- [ ] Update backend .env
- [ ] Update frontend .env
- [ ] Rebuild app
- [ ] Test deep links

---

## 🆘 TROUBLESHOOTING

### DNS not working
- Wait longer (up to 48 hours)
- Clear DNS cache: `ipconfig /flushdns` (Windows) or `sudo dscacheutil -flushcache` (Mac)
- Check with online tools: https://dnschecker.org

### SSL not working
- Check certificate validity
- Ensure certificate includes all domains (root, www, api)
- Check Nginx configuration
- Restart Nginx: `sudo systemctl restart nginx`

### Deep links not working (iOS)
- Verify apple-app-site-association is accessible
- Check content-type is `application/json`
- Rebuild app after domain changes
- Reset iOS Universal Links: Settings > General > Reset > Reset Network Settings

### Deep links not working (Android)
- Verify assetlinks.json is accessible
- Check SHA256 fingerprint matches
- Clear app data and reinstall
- Check: `adb shell dumpsys package d`

---

## 📞 SUPPORT

If you need help with:
- **DNS Configuration**: Contact your domain registrar
- **SSL Issues**: Check Let's Encrypt documentation
- **Deep Links**: Refer to Expo documentation
- **Server Setup**: Consider hiring DevOps help

---

## ✅ CURRENT STATUS

- [x] App configuration updated with custom domain
- [x] Deep linking configured (iOS & Android)
- [ ] DNS records added (YOU NEED TO DO THIS)
- [ ] SSL certificate obtained
- [ ] Web server configured
- [ ] Production backend deployed
- [ ] App rebuilt with new configuration

**Next Step:** Add DNS records at your domain registrar!
