# 🚀 VireoHR - GitHub Repository Setup Guide

## Step 1: Create GitHub Repository

### Option A: Using GitHub Web Interface

1. Go to https://github.com/new
2. Fill in the details:
   - **Repository name**: `VireoHR` or `Vireo`
   - **Description**: Multi-tenant employee management system with React Native + Firebase + FastAPI
   - **Visibility**: Choose Private or Public
   - **DO NOT initialize** with README, .gitignore, or license (we already have these)
3. Click **Create repository**

### Option B: Using GitHub CLI

```bash
# Install GitHub CLI if not already installed
# macOS: brew install gh
# Windows: winget install GitHub.cli
# Linux: See https://cli.github.com/

# Login to GitHub
gh auth login

# Create repository
gh repo create VireoHR --private --source=. --remote=origin --push
```

---

## Step 2: Push to GitHub

After creating the repository on GitHub, you'll see instructions. Follow these:

```bash
# Navigate to project directory
cd /app/Vireo-Owner

# Add all files to git
git add .

# Commit with message
git commit -m "Initial commit: VireoHR multi-tenant MVP

- Phase 1: Multi-tenant backend with FastAPI
- Phase 2: UI features (admin dashboard, overtime toggle, CSV export)
- Phase 3: Push notifications, Arabic i18n, offline support
- Complete documentation and migration scripts"

# Add remote origin (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/VireoHR.git

# Push to GitHub
git branch -M main
git push -u origin main
```

---

## Step 3: Verify

After pushing, visit your repository:
```
https://github.com/YOUR_USERNAME/VireoHR
```

You should see all your files uploaded!

---

## 🔒 Security Checklist (IMPORTANT!)

Before pushing, ensure these files are NOT committed:

### ✅ Files to Keep Private (Already in .gitignore):
- `backend/.env` - Contains database URLs, API keys
- `frontend/.env` - Contains backend URL configuration
- `**/firebase-service-account.json` - Firebase credentials
- `**/google-services.json` - Android FCM credentials
- `**/GoogleService-Info.plist` - iOS FCM credentials

### ⚠️ Verify Before Push:

```bash
# Check what will be committed
git status

# If you see any .env or credential files, STOP!
# Make sure .gitignore is working:
git check-ignore backend/.env
# Should output: backend/.env

# View what would be pushed
git diff --cached
```

---

## 📋 Repository Settings (After Creation)

### Add Topics (for discoverability):
```
react-native, expo, firebase, fastapi, python, typescript, 
multi-tenant, employee-management, mobile-app, mongodb
```

### Add Description:
```
VireoHR - Multi-tenant employee management system. React Native (Expo) + 
FastAPI + Firebase. Features: shift scheduling, attendance tracking, 
geofencing, payroll, push notifications, Arabic i18n.
```

### Set Branch Protection:
1. Go to Settings → Branches
2. Add rule for `main` branch
3. Enable: "Require pull request before merging"

---

## 🔄 Regular Git Workflow

### Daily commits:
```bash
git add .
git commit -m "feat: add new feature"
git push
```

### Feature branches:
```bash
git checkout -b feature/new-feature
# Make changes
git add .
git commit -m "feat: implement new feature"
git push -u origin feature/new-feature
# Create pull request on GitHub
```

---

## 🌳 Recommended Branch Structure

```
main          (production-ready code)
├── develop   (integration branch)
├── feature/* (new features)
├── bugfix/*  (bug fixes)
└── hotfix/*  (urgent production fixes)
```

---

## 📝 Commit Message Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add push notification support
fix: resolve overtime toggle issue
docs: update README with setup instructions
style: format code with prettier
refactor: reorganize tenant utilities
test: add unit tests for API endpoints
chore: update dependencies
```

---

## 🤝 Collaboration

### Add collaborators:
1. Go to Settings → Collaborators
2. Click "Add people"
3. Enter GitHub username or email

### Set up CI/CD (optional):
- GitHub Actions workflows in `.github/workflows/`
- Automated testing, linting, and deployment

---

## 📦 GitHub Releases

### Create a release:
```bash
git tag -a v1.0.0 -m "VireoHR v1.0.0 - Initial release"
git push origin v1.0.0
```

Then create a release on GitHub with:
- Release notes from CHANGELOG.md
- Compiled APK/IPA (if applicable)
- Documentation links

---

## 🆘 Troubleshooting

### Problem: Permission denied
**Solution**: Set up SSH key or use personal access token
```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "your_email@example.com"

# Add to GitHub: Settings → SSH Keys
cat ~/.ssh/id_ed25519.pub
```

### Problem: Large files rejected
**Solution**: Use Git LFS for files >100MB
```bash
git lfs install
git lfs track "*.zip"
git add .gitattributes
```

### Problem: Accidentally committed secrets
**Solution**: 
1. Remove from history: `git filter-branch` or `BFG Repo-Cleaner`
2. Rotate all exposed credentials immediately
3. Update .gitignore to prevent future commits

---

## ✅ Post-Setup Checklist

- [ ] Repository created on GitHub
- [ ] All code pushed to `main` branch
- [ ] .gitignore working correctly
- [ ] No secrets or credentials committed
- [ ] README.md visible on repository homepage
- [ ] Topics and description added
- [ ] Branch protection enabled (optional)
- [ ] Collaborators invited (if applicable)
- [ ] First release tagged (optional)

---

**Congratulations! Your VireoHR repository is now on GitHub!** 🎉

For questions or issues, refer to:
- [GitHub Documentation](https://docs.github.com/)
- [Git Cheat Sheet](https://education.github.com/git-cheat-sheet-education.pdf)
