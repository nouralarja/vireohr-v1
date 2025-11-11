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
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import HeaderBar from '../../components/HeaderBar';
import Card from '../../components/Card';
import Input from '../../components/Input';
import PrimaryButton from '../../components/PrimaryButton';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { useApi, apiCall } from '../../hooks/useApi';
import { COLORS, FONT_SIZE, SPACING, BORDER_RADIUS } from '../../constants/theme';

// Helper function to get week dates
const getWeekDates = (date: Date) => {
  const curr = new Date(date);
  const first = curr.getDate() - curr.getDay(); // First day is Sunday
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(curr.setDate(first + i));
    dates.push(day.toISOString().split('T')[0]);
  }
  return dates;
};

export default function ScheduleCreator() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { execute, loading } = useApi();
  const [stores, setStores] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedStore, setSelectedStore] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [shifts, setShifts] = useState<any[]>([]);
  const [weeklyShifts, setWeeklyShifts] = useState<any[]>([]);
  const [currentWeek, setCurrentWeek] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    employeeIds: [] as string[], // Changed to array for multiple employees
    startTime: '09:00',
    endTime: '17:00',
    supervisorId: '', // Optional supervisor for this shift
  });
  
  // Time picker states
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [startTimeDate, setStartTimeDate] = useState(new Date());
  const [endTimeDate, setEndTimeDate] = useState(new Date());
  
  // New employee form fields
  const [employeeName, setEmployeeName] = useState('');
  const [employeeEmail, setEmployeeEmail] = useState('');
  const [employeeRole, setEmployeeRole] = useState('EMPLOYEE');

  // Initialize time pickers with form data
  useEffect(() => {
    const [startHour, startMinute] = formData.startTime.split(':').map(Number);
    const [endHour, endMinute] = formData.endTime.split(':').map(Number);
    
    const start = new Date();
    start.setHours(startHour, startMinute, 0);
    setStartTimeDate(start);
    
    const end = new Date();
    end.setHours(endHour, endMinute, 0);
    setEndTimeDate(end);
  }, []);

  useEffect(() => {
    fetchData();
    // Initialize with current week
    const today = new Date();
    const week = getWeekDates(today);
    setCurrentWeek(week);
  }, []);

  useEffect(() => {
    if (currentWeek.length > 0 && selectedStore) {
      fetchWeeklyShifts();
    }
  }, [currentWeek, selectedStore]);

  useEffect(() => {
    if (selectedDate && selectedStore) {
      fetchShiftsForDate();
    }
  }, [selectedDate, selectedStore]);

  const fetchData = async () => {
    const [storesData, employeesData] = await Promise.all([
      execute(() => api.get('/stores'), { errorMessage: t('common.fetchError') }),
      execute(() => api.get('/employees'), { errorMessage: t('common.fetchError') }),
    ]);
    
    if (storesData) setStores(storesData);
    if (employeesData) setEmployees(employeesData);
    if (storesData && storesData.length > 0) {
      setSelectedStore(storesData[0]);
    }
  };

  const fetchWeeklyShifts = async () => {
    if (currentWeek.length === 0 || !selectedStore) return;
    const startDate = currentWeek[0];
    const endDate = currentWeek[currentWeek.length - 1];
    const data = await execute(
      () => api.get(`/shifts?storeId=${selectedStore.id}&startDate=${startDate}&endDate=${endDate}`),
      { errorMessage: t('common.fetchError') }
    );
    if (data) setWeeklyShifts(data);
  };

  const fetchShiftsForDate = async () => {
    const data = await execute(
      () => api.get(`/shifts?storeId=${selectedStore.id}&date=${selectedDate}`),
      { errorMessage: t('common.fetchError') }
    );
    if (data) setShifts(data);
  };

  const handleDayPress = (day: any) => {
    setSelectedDate(day.dateString);
    setModalVisible(true);
  };

  const handleAddShift = async () => {
    if (formData.employeeIds.length === 0) {
      Alert.alert('Error', 'Please select at least one employee');
      return;
    }

    // Create shifts for all selected employees
    const results = [];
    for (const employeeId of formData.employeeIds) {
      const selectedEmployee = employees.find(e => e.id === employeeId);
      if (selectedEmployee) {
        const result = await saveShift(selectedEmployee);
        results.push(result);
      }
    }

    // Show success message with count
    if (results.every(r => r === true)) {
      Alert.alert('Success', `${formData.employeeIds.length} shift(s) created successfully!`, [
        {
          text: 'OK',
          onPress: () => {
            setModalVisible(false);
            setFormData({ employeeIds: [], startTime: '09:00', endTime: '17:00', supervisorId: '' });
            fetchShiftsForDate();
            fetchWeeklyShifts();
          },
        },
      ]);
    }
  };

  const saveShift = async (employee: any): Promise<boolean> => {
    const shiftData: any = {
      storeId: selectedStore.id,
      employeeId: employee.id,
      employeeName: employee.name,
      employeeRole: employee.role,
      storeName: selectedStore.name,
      date: selectedDate,
      startTime: formData.startTime,
      endTime: formData.endTime,
    };

    // Add supervisor if selected (optional)
    if (formData.supervisorId) {
      shiftData.supervisorId = formData.supervisorId;
    }

    const success = await apiCall(
      () => api.post('/shifts', shiftData),
      { 
        showError: false, // We'll handle errors manually for better UX
        errorMessage: 'Failed to create shift'
      }
    );

    if (!success) {
      Alert.alert('Error for ' + employee.name, 'Failed to create shift');
      return false;
    }
    return true;
  };

  const handleDeleteShift = async (shiftId: string) => {
    const success = await apiCall(
      () => api.delete(`/shifts/${shiftId}`),
      { errorMessage: 'Failed to delete shift' }
    );
    if (success) {
      Alert.alert('Success', 'Shift deleted');
      fetchShiftsForDate();
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
        <Text style={styles.title}>{t('schedule.createSchedule')}</Text>

        {/* Store Selector */}
        <Card title="Select Store">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {stores.map((store) => (
              <TouchableOpacity
                key={store.id}
                style={[
                  styles.storeChip,
                  selectedStore?.id === store.id && styles.storeChipSelected,
                ]}
                onPress={() => setSelectedStore(store)}
              >
                <Text
                  style={[
                    styles.storeChipText,
                    selectedStore?.id === store.id && styles.storeChipTextSelected,
                  ]}
                >
                  {store.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Card>

        {/* Weekly Overview */}
        {currentWeek.length > 0 && (
          <Card title="Weekly Schedule Overview">
            {currentWeek.map((date) => {
              const dayShifts = weeklyShifts.filter(s => s.date === date);
              const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
              return (
                <View key={date} style={styles.weekDayCard}>
                  <View style={styles.weekDayHeader}>
                    <Text style={styles.weekDayName}>{dayName}</Text>
                    <Text style={styles.weekDayDate}>{date}</Text>
                  </View>
                  {dayShifts.length > 0 ? (
                    <View style={styles.weekDayShifts}>
                      {dayShifts.map((shift) => (
                        <Text key={shift.id || `${shift.employeeId}-${shift.startTime}`} style={styles.weekDayShiftText}>
                          • {shift.employeeName} ({shift.startTime}-{shift.endTime})
                          {shift.supervisorId && ' 👤'}
                        </Text>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.weekDayEmpty}>No shifts</Text>
                  )}
                </View>
              );
            })}
          </Card>
        )}

        {/* Calendar */}
        <Calendar
          onDayPress={handleDayPress}
          markedDates={{
            [selectedDate]: {
              selected: true,
              selectedColor: COLORS.gold,
            },
          }}
          theme={{
            selectedDayBackgroundColor: COLORS.gold,
            selectedDayTextColor: COLORS.teal,
            todayTextColor: COLORS.teal,
            dayTextColor: COLORS.teal,
            textDisabledColor: COLORS.gold,
            monthTextColor: COLORS.teal,
            arrowColor: COLORS.teal,
          }}
          style={styles.calendar}
        />

        {/* Shifts for selected date */}
        {selectedDate && (
          <Card title={`Shifts for ${selectedDate}`}>
            {shifts.length === 0 ? (
              <Text style={styles.emptyText}>No shifts scheduled</Text>
            ) : (
              shifts.map((shift) => (
                <View key={shift.id} style={styles.shiftCard}>
                  <View style={styles.shiftInfo}>
                    <View style={styles.shiftNameRow}>
                      <Text style={styles.shiftName}>{shift.employeeName}</Text>
                      {shift.supervisorId && shift.supervisorId === shift.employeeId && (
                        <View style={styles.supervisorBadge}>
                          <Text style={styles.supervisorBadgeText}>SUPERVISOR</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.shiftTime}>
                      {shift.startTime} - {shift.endTime}
                    </Text>
                    <Text style={styles.shiftRole}>{shift.employeeRole}</Text>
                    {shift.supervisorId && shift.supervisorId !== shift.employeeId && (
                      <Text style={styles.supervisorNote}>
                        Supervised by: {shift.supervisorName || 'Unknown'}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteShift(shift.id)}>
                    <Ionicons name="trash-outline" size={24} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              ))
            )}
            <PrimaryButton
              title="Add Shift"
              onPress={() => setModalVisible(true)}
              style={{ marginTop: SPACING.md }}
            />
          </Card>
        )}
      </ScrollView>

      {/* Add Shift Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Shift - {selectedDate}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.teal} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Select Employees (Multiple):</Text>
            <ScrollView style={styles.employeeList}>
              {employees.map((employee, index) => {
                const isSelected = formData.employeeIds.includes(employee.id);
                // Ensure unique key even if employee.id is undefined
                const uniqueKey = employee.id || `employee-${index}-${employee.email}`;
                return (
                  <TouchableOpacity
                    key={uniqueKey}
                    style={[
                      styles.employeeItem,
                      isSelected && styles.employeeItemSelected,
                    ]}
                    onPress={() => {
                      // Toggle selection
                      if (isSelected) {
                        // Remove from selection
                        setFormData({
                          ...formData,
                          employeeIds: formData.employeeIds.filter(id => id !== employee.id)
                        });
                      } else {
                        // Add to selection
                        setFormData({
                          ...formData,
                          employeeIds: [...formData.employeeIds, employee.id]
                        });
                      }
                    }}
                  >
                      <Text
                        style={[
                          styles.employeeName,
                          isSelected && styles.employeeNameSelected,
                        ]}
                      >
                        {employee.name}
                      </Text>
                      <Text style={styles.employeeRole}>{employee.role}</Text>
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>

            <Text style={styles.label}>Shift Supervisor (Optional):</Text>
            <ScrollView style={styles.supervisorList}>
              <TouchableOpacity
                style={[
                  styles.employeeItem,
                  formData.supervisorId === '' && styles.employeeItemSelected,
                ]}
                onPress={() => setFormData({ ...formData, supervisorId: '' })}
              >
                <Text style={[
                  styles.employeeName,
                  formData.supervisorId === '' && styles.employeeNameSelected,
                ]}>
                  No Supervisor
                </Text>
              </TouchableOpacity>
              {employees
                .map((employee, index) => (
                  <TouchableOpacity
                    key={employee.id || `supervisor-${index}-${employee.email}`}
                    style={[
                      styles.employeeItem,
                      formData.supervisorId === employee.id && styles.employeeItemSelected,
                    ]}
                    onPress={() => setFormData({ ...formData, supervisorId: employee.id })}
                  >
                    <View style={styles.supervisorItemContent}>
                      <Text
                        style={[
                          styles.employeeName,
                          formData.supervisorId === employee.id && styles.employeeNameSelected,
                        ]}
                      >
                        {employee.name}
                      </Text>
                      {formData.supervisorId === employee.id && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>SUPERVISOR</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.employeeRole}>{employee.role}</Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>

            <View style={styles.timeRow}>
              <View style={{ flex: 1, marginRight: SPACING.sm }}>
                <Text style={styles.timeLabel}>Start Time</Text>
                <TouchableOpacity
                  style={styles.timeButton}
                  onPress={() => setShowStartTimePicker(true)}
                >
                  <Ionicons name="time-outline" size={20} color={COLORS.teal} />
                  <Text style={styles.timeButtonText}>{formData.startTime}</Text>
                </TouchableOpacity>
                {showStartTimePicker && (
                  <DateTimePicker
                    value={startTimeDate}
                    mode="time"
                    is24Hour={true}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => {
                      setShowStartTimePicker(Platform.OS === 'ios');
                      if (selectedDate) {
                        setStartTimeDate(selectedDate);
                        const hours = selectedDate.getHours().toString().padStart(2, '0');
                        const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
                        setFormData({ ...formData, startTime: `${hours}:${minutes}` });
                      }
                      if (Platform.OS === 'android') {
                        setShowStartTimePicker(false);
                      }
                    }}
                  />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.timeLabel}>End Time</Text>
                <TouchableOpacity
                  style={styles.timeButton}
                  onPress={() => setShowEndTimePicker(true)}
                >
                  <Ionicons name="time-outline" size={20} color={COLORS.teal} />
                  <Text style={styles.timeButtonText}>{formData.endTime}</Text>
                </TouchableOpacity>
                {showEndTimePicker && (
                  <DateTimePicker
                    value={endTimeDate}
                    mode="time"
                    is24Hour={true}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => {
                      setShowEndTimePicker(Platform.OS === 'ios');
                      if (selectedDate) {
                        setEndTimeDate(selectedDate);
                        const hours = selectedDate.getHours().toString().padStart(2, '0');
                        const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
                        setFormData({ ...formData, endTime: `${hours}:${minutes}` });
                      }
                      if (Platform.OS === 'android') {
                        setShowEndTimePicker(false);
                      }
                    }}
                  />
                )}
              </View>
            </View>

            <PrimaryButton
              title="Save Shift"
              onPress={handleAddShift}
              style={{ marginTop: SPACING.md }}
            />
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
  storeChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.gold,
    marginRight: SPACING.sm,
  },
  storeChipSelected: {
    backgroundColor: COLORS.gold,
  },
  storeChipText: {
    color: COLORS.teal,
    fontWeight: '600',
  },
  storeChipTextSelected: {
    color: COLORS.teal,
  },
  calendar: {
    marginVertical: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: BORDER_RADIUS.md,
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.teal,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  shiftCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
  },
  shiftInfo: {
    flex: 1,
  },
  shiftNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  shiftName: {
    fontSize: FONT_SIZE.md,
    fontWeight: 'bold',
    color: COLORS.gold,
  },
  supervisorBadge: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  supervisorBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: 'bold',
    color: COLORS.teal,
  },
  shiftTime: {
    fontSize: FONT_SIZE.md,
    color: COLORS.teal,
    marginTop: SPACING.xs,
  },
  shiftRole: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.teal,
    marginTop: SPACING.xs,
  },
  supervisorNote: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gold,
    marginTop: SPACING.xs,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: 'bold',
    color: COLORS.teal,
    flex: 1,
  },
  label: {
    fontSize: FONT_SIZE.md,
    color: COLORS.teal,
    fontWeight: '600',
    marginBottom: SPACING.sm,
  },
  employeeList: {
    maxHeight: 200,
    marginBottom: SPACING.md,
  },
  employeeItem: {
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
  },
  employeeItemSelected: {
    backgroundColor: COLORS.gold,
  },
  employeeName: {
    fontSize: FONT_SIZE.md,
    color: COLORS.teal,
    fontWeight: '600',
  },
  employeeNameSelected: {
    color: COLORS.teal,
  },
  employeeRole: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.teal,
    marginTop: SPACING.xs,
  },
  timeRow: {
    flexDirection: 'row',
  },
  timeLabel: {
    fontSize: FONT_SIZE.md,
    color: COLORS.teal,
    fontWeight: '600',
    marginBottom: SPACING.sm,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.white,
    gap: SPACING.sm,
  },
  timeButtonText: {
    fontSize: FONT_SIZE.lg,
    color: COLORS.teal,
    fontWeight: '600',
  },
  weekDayCard: {
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.white,
  },
  weekDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  weekDayName: {
    fontSize: FONT_SIZE.md,
    fontWeight: 'bold',
    color: COLORS.teal,
  },
  weekDayDate: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gold,
  },
  weekDayShifts: {
    marginTop: SPACING.xs,
  },
  weekDayShiftText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.teal,
    marginBottom: 2,
  },
  weekDayEmpty: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gold,
    fontStyle: 'italic',
  },
  supervisorList: {
    maxHeight: 150,
    marginBottom: SPACING.md,
  },
  supervisorItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  badge: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  badgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: 'bold',
    color: COLORS.teal,
  },
});
