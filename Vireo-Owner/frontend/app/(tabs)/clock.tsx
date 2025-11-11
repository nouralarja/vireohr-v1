import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import HeaderBar from '../../components/HeaderBar';
import Card from '../../components/Card';
import PrimaryButton from '../../components/PrimaryButton';
import CountdownTimer from '../../components/CountdownTimer';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useAttendanceData } from '../../contexts/AttendanceContext';
import { useApi } from '../../hooks/useApi';
import { UserRole } from '../../types';
import { COLORS, FONT_SIZE, SPACING, BORDER_RADIUS } from '../../constants/theme';

export default function Clock() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { attendance: allAttendance, shifts: allShifts } = useAttendanceData();
  const [loading, setLoading] = useState(true);
  const [todayShift, setTodayShift] = useState<any>(null);
  const [attendance, setAttendance] = useState<any>(null);
  const [storesWithWorkers, setStoresWithWorkers] = useState<any[]>([]);
  const [selectedStore, setSelectedStore] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [canClockIn, setCanClockIn] = useState(false);
  const [canClockOut, setCanClockOut] = useState(false);
  const [clockInTime, setClockInTime] = useState<Date | null>(null);
  const [clockOutTime, setClockOutTime] = useState<Date | null>(null);
  const [isClocking, setIsClocking] = useState(false); // De-bounce flag

  useEffect(() => {
    checkAutoClockOut(); // Check on app open
    // Only fetch currently working data for managers and above
    if (user?.role && [UserRole.MANAGER, UserRole.CO, UserRole.OWNER].includes(user.role)) {
      fetchStoresWithWorkers();
    }
  }, [user?.role]);

  // Update shift and attendance when context data changes
  useEffect(() => {
    const myShift = allShifts.find((shift: any) => shift.employeeId === user?.uid);
    setTodayShift(myShift);

    if (myShift) {
      const myAttendance = allAttendance.find(
        (att: any) => att.shiftId === myShift.id && att.employeeId === user?.uid
      );
      setAttendance(myAttendance);
    }
    setLoading(false);
  }, [allShifts, allAttendance, user?.uid]);

  useEffect(() => {
    if (todayShift) {
      const calculateGates = () => {
        if (!todayShift) return;

        const now = new Date();
        const shiftDate = todayShift.date;
        const startTime = todayShift.startTime;
        const endTime = todayShift.endTime;

        // Calculate clock-in time (10 min before start)
        const shiftStart = new Date(`${shiftDate}T${startTime}`);
        const clockInAllowed = new Date(shiftStart.getTime() - 10 * 60000);
        setClockInTime(clockInAllowed);
        setCanClockIn(now >= clockInAllowed);

        // Calculate clock-out time (5 min before end OR after end)
        const shiftEnd = new Date(`${shiftDate}T${endTime}`);
        const clockOutEarly = new Date(shiftEnd.getTime() - 5 * 60000);
        setClockOutTime(clockOutEarly);
        setCanClockOut(now >= clockOutEarly || now >= shiftEnd);
      };
      
      calculateGates();
    }
  }, [todayShift, attendance]);

  const fetchStoresWithWorkers = async () => {
    try {
      const response = await api.get('/attendance/currently-working-by-store');
      setStoresWithWorkers(response.data);
    } catch (error) {
      console.error('Failed to fetch stores with workers');
    }
  };

  const checkAutoClockOut = async () => {
    try {
      const response = await api.post('/attendance/check-auto-clock-out');
      if (response.data.needsAutoClockOut) {
        Alert.alert(
          'Auto Clocked Out',
          `Your shift ended at ${response.data.shiftEndTime}. You have been automatically clocked out.`,
          [{ text: 'OK', onPress: () => fetchTodayShift() }]
        );
      }
    } catch (error) {
      console.error('Failed to check auto clock-out');
    }
  };

  const handleStorePress = (store: any) => {
    setSelectedStore(store);
    setModalVisible(true);
  };

  const handleClockIn = async () => {
    if (!todayShift) {
      Alert.alert('Error', t('clock.notScheduled'));
      return;
    }

    if (!canClockIn) {
      Alert.alert('Error', t('clock.tooEarly'));
      return;
    }

    // De-bounce: prevent rapid taps
    if (isClocking) return;

    setIsClocking(true);
    try {
      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to clock in. Please enable it in settings.');
        setIsClocking(false);
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      await api.post('/attendance/clock-in', {
        shiftId: todayShift.id,
        storeId: todayShift.storeId,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      Alert.alert('Success', t('clock.clockInSuccess'));
      fetchTodayShift();
      // Only refresh currently working data for managers and above
      if (user?.role && [UserRole.MANAGER, UserRole.CO, UserRole.OWNER].includes(user.role)) {
        fetchCurrentlyWorking();
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || t('clock.clockInError');
      Alert.alert('Error', errorMsg);
    } finally {
      // Reset after 2 seconds to prevent accidental double-taps
      setTimeout(() => setIsClocking(false), 2000);
    }
  };

  const handleClockOut = async () => {
    if (!attendance) return;

    if (!canClockOut) {
      Alert.alert('Error', 'Too early to clock out');
      return;
    }

    // De-bounce: prevent rapid taps
    if (isClocking) return;

    setIsClocking(true);
    try {
      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to clock out. Please enable it in settings.');
        setIsClocking(false);
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      await api.post('/attendance/clock-out', {
        attendanceId: attendance.id,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      Alert.alert('Success', t('clock.clockOutSuccess'));
      fetchTodayShift();
      // Only refresh currently working data for managers and above
      if (user?.role && [UserRole.MANAGER, UserRole.CO, UserRole.OWNER].includes(user.role)) {
        fetchCurrentlyWorking();
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || t('clock.clockOutError');
      Alert.alert('Error', errorMsg);
    } finally {
      // Reset after 2 seconds to prevent accidental double-taps
      setTimeout(() => setIsClocking(false), 2000);
    }
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

  return (
    <View style={styles.container}>
      <HeaderBar />
      <ScrollView style={styles.content}>
        <Text style={styles.title}>Attendance</Text>

        {todayShift ? (
          <Card title="Today's Shift">
            <View style={styles.shiftInfo}>
              <Text style={styles.label}>Store: {todayShift.storeId}</Text>
              <Text style={styles.label}>
                Time: {todayShift.startTime} - {todayShift.endTime}
              </Text>
            </View>

            {!attendance && (
              <>
                {!canClockIn && clockInTime && (
                  <CountdownTimer
                    targetTime={clockInTime}
                    prefix="Clock In available in"
                    onComplete={() => setCanClockIn(true)}
                  />
                )}
                <PrimaryButton
                  title={t('clock.clockIn')}
                  onPress={handleClockIn}
                  disabled={!canClockIn || isClocking}
                  loading={isClocking}
                  style={{ marginTop: SPACING.md }}
                />
                {todayShift.storeName && (
                  <Text style={styles.storeLabel}>Store: {todayShift.storeName}</Text>
                )}
              </>
            )}

            {attendance && attendance.status === 'CLOCKED_IN' && (
              <>
                <View style={styles.statusBadge}>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                  <Text style={styles.statusText}>Clocked In</Text>
                </View>
                {!canClockOut && clockOutTime && (
                  <View style={{ marginTop: SPACING.md }}>
                    <CountdownTimer
                      targetTime={clockOutTime}
                      prefix="Clock Out available in"
                      onComplete={() => setCanClockOut(true)}
                    />
                  </View>
                )}
                <PrimaryButton
                  title={t('clock.clockOut')}
                  onPress={handleClockOut}
                  disabled={!canClockOut || isClocking}
                  loading={isClocking}
                  style={{ marginTop: SPACING.md, backgroundColor: COLORS.error }}
                />
                {todayShift.storeName && (
                  <Text style={styles.storeLabel}>Store: {todayShift.storeName}</Text>
                )}
              </>
            )}

            {attendance && attendance.status === 'CLOCKED_OUT' && (
              <View style={styles.statusBadge}>
                <Ionicons name="checkmark-done" size={20} color={COLORS.teal} />
                <Text style={styles.statusText}>Shift Complete</Text>
              </View>
            )}
          </Card>
        ) : (
          <Card>
            <Text style={styles.noShiftText}>{t('clock.notScheduled')}</Text>
          </Card>
        )}

        {user?.role && [UserRole.MANAGER, UserRole.CO, UserRole.OWNER].includes(user.role) && (
          <Card title={t('clock.currentlyWorking')}>
            {storesWithWorkers.length === 0 ? (
              <Text style={styles.emptyText}>No stores with active employees</Text>
            ) : (
              storesWithWorkers.map((store) => (
                <TouchableOpacity
                  key={store.storeId}
                  style={styles.storeCard}
                  onPress={() => handleStorePress(store)}
                >
                  <View style={styles.storeCardContent}>
                    <Ionicons name="storefront" size={32} color={COLORS.gold} />
                    <View style={styles.storeInfo}>
                      <Text style={styles.storeName}>{store.storeName}</Text>
                      <Text style={styles.employeeCount}>
                        {store.employeeCount} {store.employeeCount === 1 ? 'employee' : 'employees'} working
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={24} color={COLORS.teal} />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </Card>
        )}
      </ScrollView>

      {/* Employee List Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{selectedStore?.storeName}</Text>
                <Text style={styles.modalSubtitle}>Currently Working</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close-circle" size={32} color={COLORS.teal} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {selectedStore?.employees.map((employee: any) => (
                <View key={employee.id} style={styles.employeeItem}>
                  <Ionicons name="person-circle" size={24} color={COLORS.teal} />
                  <Text style={styles.employeeName}>{employee.employeeName}</Text>
                  {employee.isSupervisor && (
                    <View style={styles.supervisorBadge}>
                      <Ionicons name="shield-checkmark" size={14} color={COLORS.white} />
                      <Text style={styles.supervisorText}>SUP</Text>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: 'bold',
    color: COLORS.teal,
    marginBottom: SPACING.md,
  },
  shiftInfo: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: FONT_SIZE.md,
    color: COLORS.teal,
    marginBottom: SPACING.xs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.gold,
    borderRadius: 8,
    marginTop: SPACING.md,
  },
  statusText: {
    marginLeft: SPACING.sm,
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.teal,
  },
  storeLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray600,
    textAlign: 'center',
    marginTop: SPACING.md,
    fontStyle: 'italic',
  },
  noShiftText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.teal,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.teal,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  storeCard: {
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.teal,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  storeCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  storeInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  storeName: {
    fontSize: FONT_SIZE.lg,
    fontWeight: 'bold',
    color: COLORS.teal,
    marginBottom: SPACING.xs,
  },
  employeeCount: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray700,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: BORDER_RADIUS.lg,
    borderTopRightRadius: BORDER_RADIUS.lg,
    maxHeight: '70%',
    paddingTop: SPACING.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gold,
  },
  modalTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: 'bold',
    color: COLORS.teal,
  },
  modalSubtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray700,
    marginTop: SPACING.xs,
  },
  modalBody: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  employeeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  employeeName: {
    fontSize: FONT_SIZE.md,
    color: COLORS.teal,
    marginLeft: SPACING.md,
    fontWeight: '500',
    flex: 1,
  },
  supervisorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gold,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    marginLeft: SPACING.sm,
  },
  supervisorText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.white,
    fontWeight: 'bold',
    marginLeft: SPACING.xs,
  },
  workerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: 8,
    marginBottom: SPACING.sm,
  },
  workerInfo: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  workerName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.teal,
    marginBottom: SPACING.xs,
  },
  workerDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
    gap: 6,
  },
  workerDetail: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.teal,
    flex: 1,
  },
  workerTime: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.teal,
    marginTop: SPACING.xs,
  },
});
