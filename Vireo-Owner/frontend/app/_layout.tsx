import React, { useState, useEffect } from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import NetInfo from '@react-native-community/netinfo';
import { AuthProvider } from '../contexts/AuthContext';
import { AttendanceProvider } from '../contexts/AttendanceContext';
import { TenantProvider } from '../contexts/TenantContext';
import ErrorBoundary from '../components/ErrorBoundary';
import OfflinePill from '../components/OfflinePill';
import OfflineBanner from '../components/OfflineBanner';
import { usePushNotifications } from '../hooks/usePushNotifications';
import '../config/i18n';

function AppContent() {
  const [isOffline, setIsOffline] = useState(false);
  const { expoPushToken } = usePushNotifications();

  useEffect(() => {
    // Monitor network connectivity
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!state.isConnected);
      if (__DEV__) {
        console.log('Network status:', state.isConnected ? 'Online' : 'Offline');
        if (expoPushToken) {
          console.log('Push token:', expoPushToken);
        }
      }
    });

    return () => unsubscribe();
  }, [expoPushToken]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)/sign-in" />
        <Stack.Screen name="(auth)/signup" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(admin)" />
      </Stack>
      <OfflineBanner visible={isOffline} />
      <OfflinePill visible={isOffline} />
      <Toast />
    </>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <TenantProvider>
            <AttendanceProvider>
              <AppContent />
            </AttendanceProvider>
          </TenantProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
