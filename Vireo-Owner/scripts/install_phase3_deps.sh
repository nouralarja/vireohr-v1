#!/bin/bash

# VireoHR Phase 3 - Install Dependencies
# Run this script from the project root: ./scripts/install_phase3_deps.sh

echo "Installing Phase 3 dependencies..."
cd /app/Vireo-Owner/frontend

# Install push notification packages
echo "📦 Installing expo-notifications..."
npx expo install expo-notifications

echo "📦 Installing expo-device..."
npx expo install expo-device

echo "📦 Installing expo-task-manager..."
npx expo install expo-task-manager

echo "📦 Installing expo-constants..."
npx expo install expo-constants

# Install error boundary (if not already installed)
echo "📦 Installing react-native-error-boundary..."
yarn add react-native-error-boundary

echo "✅ All Phase 3 dependencies installed successfully!"
echo ""
echo "Next steps:"
echo "1. Run 'expo prebuild' to configure native projects"
echo "2. Test push notifications on a physical device"
echo "3. Update firebase-service-account.json with FCM credentials"
