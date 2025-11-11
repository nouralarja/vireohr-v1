import React from 'react';
import { View, Text, StyleSheet, Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT_SIZE, SPACING } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';

export default function HeaderBar() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { tenant, loading: tenantLoading } = useTenant();
  const insets = useSafeAreaInsets();

  // Use tenant name or fallback to Gosta
  const businessName = tenant?.name || 'Gosta';
  const avatarLetter = businessName.charAt(0).toUpperCase();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.teal} />
      <View style={styles.content}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{avatarLetter}</Text>
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.greeting}>{businessName}</Text>
          {tenant && (
            <Text style={styles.subtitle}>VireoHR</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.teal,
  },
  content: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.gold,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  avatarText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: 'bold',
    color: COLORS.teal,
  },
  textContainer: {
    flex: 1,
  },
  greeting: {
    fontSize: FONT_SIZE.xl,
    fontWeight: 'bold',
    color: COLORS.gold,
  },
  subtitle: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.white,
    opacity: 0.8,
    marginTop: 2,
  },
});
