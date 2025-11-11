import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Switch } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import HeaderBar from '../../components/HeaderBar';
import Card from '../../components/Card';
import api from '../../services/api';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../contexts/AuthContext';
import { COLORS, FONT_SIZE, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { UserRole } from '../../types';
import Toast from 'react-native-toast-message';

export default function Home() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { execute, loading: loadingEarnings } = useApi();
  const [earnings, setEarnings] = useState<any>(null);
  const [overtimeEnabled, setOvertimeEnabled] = useState(false);
  const [loadingOvertime, setLoadingOvertime] = useState(false);
  
  // Role check for displaying role
  const userRole = String(user?.role || '').toUpperCase();
  const isOwnerOrCO = userRole === 'OWNER' || userRole === 'CO';

  useEffect(() => {
    fetchMyEarnings();
    if (isOwnerOrCO) {
      fetchOvertimeStatus();
    }
  }, []);

  const getTodayString = () => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // YYYY-MM-DD
  };

  const fetchMyEarnings = async () => {
    const data = await execute(
      () => api.get('/earnings/my-earnings'),
      { errorMessage: t('common.fetchError') }
    );
    if (data) {
      setEarnings(data);
    }
  };

  const fetchOvertimeStatus = async () => {
    const today = getTodayString();
    const data = await execute(
      () => api.get('/tenant/overtime-toggle', { params: { date: today } }),
      { silent: true }
    );
    if (data) {
      setOvertimeEnabled(data.enabled || false);
    }
  };

  const handleToggleOvertime = async (value: boolean) => {
    // Optimistic update
    setOvertimeEnabled(value);
    setLoadingOvertime(true);
    
    const today = getTodayString();
    
    const success = await execute(
      () => api.post('/tenant/overtime-toggle', null, {
        params: { date: today, enabled: value }
      }),
      {
        errorMessage: 'Failed to update overtime setting',
        onSuccess: () => {
          Toast.show({
            type: 'success',
            text1: value ? 'Overtime Enabled' : 'Overtime Disabled',
            text2: value ? 'Auto clock-out disabled for today' : 'Auto clock-out enabled for today',
          });
        },
        onError: () => {
          // Revert on error
          setOvertimeEnabled(!value);
        },
      }
    );
    
    setLoadingOvertime(false);
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/sign-in');
  };

  return (
    <View style={styles.container}>
      <HeaderBar />
      <ScrollView style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.greeting}>Hello, {user?.name}!</Text>
          {(userRole === 'OWNER' || userRole === 'CO') && (
            <Text style={styles.roleText}>{user?.role}</Text>
          )}
        </View>

        {/* Overtime Toggle for Owner/CO */}
        {isOwnerOrCO && (
          <Card style={styles.overtimeCard}>
            <View style={styles.overtimeRow}>
              <View style={styles.overtimeInfo}>
                <Text style={styles.overtimeTitle}>Daily Overtime Mode</Text>
                <Text style={styles.overtimeDescription}>
                  {overtimeEnabled 
                    ? 'Auto clock-out disabled today' 
                    : 'Auto clock-out active at shift end'}
                </Text>
              </View>
              <Switch
                value={overtimeEnabled}
                onValueChange={handleToggleOvertime}
                disabled={loadingOvertime}
                trackColor={{ false: COLORS.gray400, true: COLORS.teal }}
                thumbColor={COLORS.white}
              />
            </View>
          </Card>
        )}

        {/* Earnings Section */}
        <View style={styles.earningsSection}>
          <Text style={styles.sectionTitle}>💰 My Earnings</Text>
          
          {loadingEarnings ? (
            <ActivityIndicator size="large" color={COLORS.teal} style={{ marginVertical: SPACING.lg }} />
          ) : earnings ? (
            <>
              <View style={styles.earningsGrid}>
                {/* Today's Earnings */}
                <Card style={styles.earningCard}>
                  <Ionicons name="today-outline" size={32} color={COLORS.gold} />
                  <Text style={styles.earningLabel}>Today</Text>
                  <Text style={styles.earningAmount}>{earnings.todayEarnings.toFixed(2)} JD</Text>
                  <Text style={styles.earningHours}>{earnings.todayHours.toFixed(1)} hours</Text>
                </Card>

                {/* This Month's Earnings */}
                <Card style={styles.earningCard}>
                  <Ionicons name="calendar-outline" size={32} color={COLORS.teal} />
                  <Text style={styles.earningLabel}>This Month</Text>
                  <Text style={styles.earningAmount}>{earnings.monthEarnings.toFixed(2)} JD</Text>
                  <Text style={styles.earningHours}>{earnings.monthHours.toFixed(1)} hours</Text>
                </Card>
              </View>

              <Card style={styles.rateCard}>
                <Text style={styles.rateLabel}>Your Hourly Rate</Text>
                <Text style={styles.rateAmount}>{earnings.hourlyRate.toFixed(2)} JD/hour</Text>
              </Card>

              {/* Penalties Section */}
              {(earnings.lateCount > 0 || earnings.noShowCount > 0) && (
                <Card style={styles.penaltyCard}>
                  <Text style={styles.penaltyTitle}>⚠️ This Month&apos;s Deductions</Text>
                  
                  {earnings.lateCount > 0 && (
                    <View style={styles.penaltyRow}>
                      <Text style={styles.penaltyLabel}>
                        Late Arrivals ({earnings.lateCount} times{earnings.lateCount > 2 ? `, ${earnings.lateCount - 2} with penalty` : ''})
                      </Text>
                      <Text style={styles.penaltyAmount}>-{earnings.latePenalty.toFixed(2)} JD</Text>
                    </View>
                  )}
                  
                  {earnings.noShowCount > 0 && (
                    <View style={styles.penaltyRow}>
                      <Text style={styles.penaltyLabel}>No-Shows ({earnings.noShowCount} times)</Text>
                      <Text style={styles.penaltyAmount}>-{earnings.noShowPenalty.toFixed(2)} JD</Text>
                    </View>
                  )}
                  
                  <View style={[styles.penaltyRow, styles.totalPenaltyRow]}>
                    <Text style={styles.totalPenaltyLabel}>Total Deductions:</Text>
                    <Text style={styles.totalPenaltyAmount}>-{earnings.totalPenalties.toFixed(2)} JD</Text>
                  </View>

                  {earnings.lateCount === 1 && (
                    <Text style={styles.warningText}>⚠️ First warning: You have 1 more chance before penalties apply</Text>
                  )}
                  {earnings.lateCount === 2 && (
                    <Text style={styles.criticalWarningText}>🚨 Final warning: Next late arrival will result in half-day penalty</Text>
                  )}
                </Card>
              )}
            </>
          ) : (
            <Card>
              <Text style={styles.noEarningsText}>No salary configured. Please contact your manager.</Text>
            </Card>
          )}
        </View>

        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/clock')}
          >
            <Ionicons name="time-outline" size={32} color={COLORS.teal} />
            <Text style={styles.actionText}>{t('clock.clockIn')}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/schedule')}
          >
            <Ionicons name="calendar-outline" size={32} color={COLORS.teal} />
            <Text style={styles.actionText}>View Schedule</Text>
          </TouchableOpacity>

          {(user?.role === UserRole.SHIFT_SUPERVISOR) && (
            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => router.push('/(tabs)/ingredients')}
            >
              <Ionicons name="cube-outline" size={32} color={COLORS.teal} />
              <Text style={styles.actionText}>Ingredient Count</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>{t('auth.signOut')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  content: {
    flex: 1,
    padding: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: 'bold',
    color: COLORS.teal,
    marginBottom: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 2,
    borderColor: COLORS.gold,
    marginBottom: SPACING.lg,
  },
  greeting: {
    fontSize: FONT_SIZE.xl,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginBottom: SPACING.xs,
  },
  roleText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.teal,
    marginTop: SPACING.xs,
  },
  overtimeCard: {
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.teal,
  },
  overtimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  overtimeInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },
  overtimeTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.teal,
    marginBottom: SPACING.xs,
  },
  overtimeDescription: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray600,
  },
  cardTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginBottom: SPACING.sm,
  },
  cardText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray700,
    marginBottom: SPACING.xs,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: 'bold',
    color: COLORS.teal,
    marginBottom: SPACING.md,
  },
  earningsSection: {
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  earningsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  earningCard: {
    flex: 1,
    marginHorizontal: SPACING.xs,
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.gold,
  },
  earningLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray700,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  earningAmount: {
    fontSize: FONT_SIZE.xl,
    fontWeight: 'bold',
    color: COLORS.teal,
    marginBottom: SPACING.xs,
  },
  earningHours: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.gray600,
  },
  rateCard: {
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.gold,
    borderWidth: 2,
    borderColor: COLORS.teal,
  },
  rateLabel: {
    fontSize: FONT_SIZE.md,
    color: COLORS.teal,
    marginBottom: SPACING.xs,
    fontWeight: '600',
  },
  rateAmount: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: 'bold',
    color: COLORS.teal,
  },
  noEarningsText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray700,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  penaltyCard: {
    backgroundColor: '#FFF3CD',
    borderWidth: 2,
    borderColor: COLORS.error,
    padding: SPACING.md,
    marginTop: SPACING.md,
  },
  penaltyTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: 'bold',
    color: COLORS.error,
    marginBottom: SPACING.md,
  },
  penaltyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  penaltyLabel: {
    fontSize: FONT_SIZE.md,
    color: COLORS.teal,
    flex: 1,
  },
  penaltyAmount: {
    fontSize: FONT_SIZE.md,
    fontWeight: 'bold',
    color: COLORS.error,
  },
  totalPenaltyRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.error,
    paddingTop: SPACING.sm,
    marginTop: SPACING.xs,
  },
  totalPenaltyLabel: {
    fontSize: FONT_SIZE.lg,
    fontWeight: 'bold',
    color: COLORS.teal,
  },
  totalPenaltyAmount: {
    fontSize: FONT_SIZE.lg,
    fontWeight: 'bold',
    color: COLORS.error,
  },
  warningText: {
    fontSize: FONT_SIZE.sm,
    color: '#856404',
    marginTop: SPACING.md,
    fontStyle: 'italic',
  },
  criticalWarningText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.error,
    marginTop: SPACING.md,
    fontWeight: 'bold',
  },
  quickActions: {
    marginTop: SPACING.md,
  },
  actionCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.teal,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray900,
    marginLeft: SPACING.md,
    fontWeight: '500',
  },
  signOutButton: {
    backgroundColor: COLORS.error,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginTop: SPACING.xl,
    marginBottom: SPACING.xl,
  },
  signOutText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
  },
});
