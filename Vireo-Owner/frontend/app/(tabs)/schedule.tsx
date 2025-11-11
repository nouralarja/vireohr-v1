import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import HeaderBar from '../../components/HeaderBar';
import Card from '../../components/Card';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useApi } from '../../hooks/useApi';
import { COLORS, FONT_SIZE, SPACING, BORDER_RADIUS } from '../../constants/theme';

export default function Schedule() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { execute, loading } = useApi();
  const [shifts, setShifts] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedShift, setSelectedShift] = useState<any>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    fetchShifts();
  }, [selectedDate, stores]);

  const fetchStores = async () => {
    const result = await execute(
      () => api.get('/stores'),
      {
        errorMessage: 'Failed to fetch stores',
        showError: false, // Silent fetch
        onSuccess: (data) => setStores(data),
      }
    );
  };

  const fetchShifts = async () => {
    const storeId = user?.assignedStoreId;
    if (!storeId) return;

    // Get this week's date range
    const weekDays = getWeekDays();
    const startDate = weekDays[0].toISOString().split('T')[0];
    const endDate = weekDays[weekDays.length - 1].toISOString().split('T')[0];

    // Use useApi hook
    const result = await execute(
      () => api.get(`/shifts?storeId=${storeId}&startDate=${startDate}&endDate=${endDate}`),
      {
        errorMessage: 'Failed to fetch schedule',
        onSuccess: (data) => setShifts(data),
      }
    );
  };

  const getStoreName = (storeId: string) => {
    const store = stores.find(s => s.id === storeId);
    return store?.name || 'Unknown Store';
  };

  const getWeekDays = () => {
    const days = [];
    const startOfWeek = new Date(selectedDate);
    startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay());

    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const getShiftsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return shifts.filter((shift) => shift.date === dateStr);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <HeaderBar />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.teal} />
        </View>
      </View>
    );
  }

  const weekDays = getWeekDays();

  return (
    <View style={styles.container}>
      <HeaderBar />
      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('navigation.schedule')}</Text>
          <Text style={styles.subtitle}>Read-Only View</Text>
        </View>

        {!user?.assignedStoreId ? (
          <Card>
            <Text style={styles.emptyText}>No store assigned</Text>
          </Card>
        ) : (
          <View style={styles.weekContainer}>
            {weekDays.map((day, index) => {
              const dayShifts = getShiftsForDate(day);
              const dayName = day.toLocaleDateString('en-US', { weekday: 'short' });
              const dayDate = day.getDate();

              return (
                <Card key={index} style={styles.dayCard}>
                  <View style={styles.dayHeader}>
                    <Text style={styles.dayName}>{dayName}</Text>
                    <Text style={styles.dayDate}>{dayDate}</Text>
                  </View>

                  {dayShifts.length === 0 ? (
                    <Text style={styles.noShifts}>No shifts</Text>
                  ) : (
                    dayShifts.map((shift) => (
                      <View key={shift.id} style={styles.shiftCard}>
                        <View style={styles.shiftHeader}>
                          <Ionicons name="person" size={16} color={COLORS.gold} />
                          <Text style={styles.employeeName}>{shift.employeeName}</Text>
                        </View>
                        <View style={styles.shiftDetails}>
                          <View style={styles.shiftTimeRow}>
                            <Ionicons name="time-outline" size={14} color={COLORS.teal} />
                            <Text style={styles.shiftTime}>
                              {shift.startTime} - {shift.endTime}
                            </Text>
                          </View>
                          <View style={styles.storeRow}>
                            <Ionicons name="storefront-outline" size={14} color={COLORS.gold} />
                            <Text style={styles.storeName}>
                              {shift.storeName || getStoreName(shift.storeId)}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.roleLabel}>{shift.employeeRole}</Text>
                      </View>
                    ))
                  )}
                </Card>
              );
            })}
          </View>
        )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: 'bold',
    color: COLORS.teal,
  },
  subtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gold,
    marginTop: SPACING.xs,
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray500,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  weekContainer: {
    gap: SPACING.md,
  },
  dayCard: {
    backgroundColor: COLORS.white,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
    marginBottom: SPACING.sm,
  },
  dayName: {
    fontSize: FONT_SIZE.lg,
    fontWeight: 'bold',
    color: COLORS.teal,
  },
  dayDate: {
    fontSize: FONT_SIZE.lg,
    color: COLORS.gold,
    fontWeight: '600',
  },
  noShifts: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray400,
    fontStyle: 'italic',
  },
  shiftCard: {
    backgroundColor: COLORS.gray50,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: SPACING.sm,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.gold,
  },
  shiftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  employeeName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.teal,
    marginLeft: SPACING.xs,
  },
  shiftDetails: {
    marginLeft: SPACING.md,
    gap: SPACING.xs,
  },
  shiftTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  shiftTime: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.teal,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  storeName: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gold,
    fontWeight: '600',
  },
  roleLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.gray600,
    marginTop: SPACING.xs,
    marginLeft: SPACING.md,
  },
});
