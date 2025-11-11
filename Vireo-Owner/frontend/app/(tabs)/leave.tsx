import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import HeaderBar from '../../components/HeaderBar';
import Card from '../../components/Card';
import Input from '../../components/Input';
import PrimaryButton from '../../components/PrimaryButton';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useAttendanceData } from '../../contexts/AttendanceContext';
import { getTodayString } from '../../utils/dateUtils';
import { COLORS, FONT_SIZE, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { UserRole } from '../../types';

export default function Leave() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { attendance: allAttendance, shifts: allShifts } = useAttendanceData();
  const [loading, setLoading] = useState(true);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [requestType, setRequestType] = useState<'leave' | 'day_off'>('leave');
  const [formData, setFormData] = useState({
    date: getTodayString(),
    reason: '',
  });
  const [currentShift, setCurrentShift] = useState<any>(null);
  const [isCurrentlyWorking, setIsCurrentlyWorking] = useState(false);

  const isCO = user?.role === UserRole.CO || user?.role === UserRole.OWNER;

  useEffect(() => {
    fetchLeaveRequests();
  }, []);

  // Check current shift status using context data
  useEffect(() => {
    if (!isCO) {
      const myAttendance = allAttendance.find(
        (att: any) => att.employeeId === user?.uid && att.status === 'CLOCKED_IN'
      );
      
      if (myAttendance) {
        setIsCurrentlyWorking(true);
        const myShift = allShifts.find((s: any) => s.id === myAttendance.shiftId);
        setCurrentShift(myShift);
      } else {
        setIsCurrentlyWorking(false);
        setCurrentShift(null);
      }
    }
  }, [allAttendance, allShifts, isCO, user?.uid]);

  const fetchLeaveRequests = async () => {
    try {
      if (isCO) {
        // CO sees all pending requests
        const response = await api.get('/leave-requests?status=PENDING');
        setLeaveRequests(response.data);
      } else {
        // Employee sees their own requests
        const response = await api.get(`/leave-requests?employeeId=${user?.uid}`);
        setMyRequests(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch leave requests');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.reason.trim()) {
      Alert.alert('Error', 'Please enter a reason');
      return;
    }

    try {
      if (requestType === 'leave') {
        // Original leave logic: needs shift
        const shiftsResponse = await api.get(`/shifts?date=${formData.date}`);
        const myShift = shiftsResponse.data.find((s: any) => s.employeeId === user?.uid);

        if (!myShift) {
          Alert.alert('Error', 'No shift found for selected date');
          return;
        }

        await api.post('/leave-requests', {
          shiftId: myShift.id,
          storeId: myShift.storeId,
          date: formData.date,
          reason: formData.reason,
          type: 'leave',
        });

        Alert.alert('Success', 'Leave request submitted successfully!');
      } else {
        // Day-off logic: no shift needed
        await api.post('/leave-requests', {
          date: formData.date,
          reason: formData.reason,
          type: 'day_off',
        });

        Alert.alert('Success', 'Day-off request submitted successfully!');
      }

      setShowForm(false);
      setFormData({ date: getTodayString(), reason: '' });
      fetchLeaveRequests();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to submit request');
    }
  };

  const handleApprove = async (requestId: string) => {
    try {
      await api.put(`/leave-requests/${requestId}`, { status: 'APPROVED' });
      Alert.alert('Success', 'Leave request approved');
      fetchLeaveRequests();
    } catch (error) {
      Alert.alert('Error', 'Failed to approve request');
    }
  };

  const handleDeny = async (requestId: string) => {
    try {
      await api.put(`/leave-requests/${requestId}`, { status: 'DECLINED' });
      Alert.alert('Success', 'Leave request declined');
      fetchLeaveRequests();
    } catch (error) {
      Alert.alert('Error', 'Failed to decline request');
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
        <Text style={styles.title}>Leave Requests</Text>

        {!isCO && isCurrentlyWorking && (
          <Card style={styles.warningCard}>
            <Ionicons name="alert-circle" size={24} color={COLORS.error} />
            <View style={{ marginLeft: SPACING.md, flex: 1 }}>
              <Text style={styles.warningTitle}>Currently Working</Text>
              <Text style={styles.warningText}>
                You cannot request leave while clocked in. Please wait until your shift ends{currentShift ? ` at ${currentShift.endTime}` : ''}.
              </Text>
            </View>
          </Card>
        )}

        {!isCO && !showForm && !isCurrentlyWorking && (
          <>
            <View style={styles.toggleContainer}>
              <TouchableOpacity
                style={[styles.toggleButton, requestType === 'leave' && styles.toggleButtonActive]}
                onPress={() => setRequestType('leave')}
              >
                <Text style={[styles.toggleText, requestType === 'leave' && styles.toggleTextActive]}>
                  Leave Request
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, requestType === 'day_off' && styles.toggleButtonActive]}
                onPress={() => setRequestType('day_off')}
              >
                <Text style={[styles.toggleText, requestType === 'day_off' && styles.toggleTextActive]}>
                  Day-Off Request
                </Text>
              </TouchableOpacity>
            </View>
            <PrimaryButton
              title={requestType === 'leave' ? "Request Leave" : "Request Day Off"}
              onPress={() => setShowForm(true)}
              style={{ marginBottom: SPACING.lg }}
            />
          </>
        )}

        {!isCO && showForm && (
          <Card title={requestType === 'leave' ? "Request Leave" : "Request Day Off"}>
            <Text style={styles.helpText}>
              {requestType === 'leave' 
                ? 'Request leave for a scheduled shift' 
                : 'Request a day off (no shift required)'}
            </Text>
            <Input
              label="Date"
              value={formData.date}
              onChangeText={(text) => setFormData({ ...formData, date: text })}
              placeholder="YYYY-MM-DD"
            />
            <Input
              label="Reason"
              value={formData.reason}
              onChangeText={(text) => setFormData({ ...formData, reason: text })}
              placeholder="Enter reason for leave"
              multiline
              numberOfLines={4}
            />
            <View style={styles.buttonRow}>
              <PrimaryButton
                title="Submit"
                onPress={handleSubmit}
                style={{ flex: 1, marginRight: SPACING.sm }}
              />
              <PrimaryButton
                title="Cancel"
                onPress={() => setShowForm(false)}
                style={{ flex: 1, backgroundColor: COLORS.gold }}
                textStyle={{ color: COLORS.teal }}
              />
            </View>
          </Card>
        )}

        {!isCO && (
          <>
            <Text style={styles.sectionTitle}>My Requests</Text>
            {myRequests.length === 0 ? (
              <Card>
                <Text style={styles.emptyText}>No leave requests yet</Text>
              </Card>
            ) : (
              myRequests.map((request) => (
                <Card key={request.id}>
                  <View style={styles.requestHeader}>
                    <Text style={styles.requestDate}>{request.date}</Text>
                    <View style={[
                      styles.statusBadge,
                      request.status === 'APPROVED' && styles.statusApproved,
                      request.status === 'DECLINED' && styles.statusDeclined,
                    ]}>
                      <Text style={styles.statusText}>{request.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.requestReason}>{request.reason}</Text>
                </Card>
              ))
            )}
          </>
        )}

        {isCO && (
          <>
            <Text style={styles.sectionTitle}>Pending Requests</Text>
            {leaveRequests.length === 0 ? (
              <Card>
                <Text style={styles.emptyText}>No pending requests</Text>
              </Card>
            ) : (
              leaveRequests.map((request) => (
                <Card key={request.id}>
                  <View style={styles.requestHeader}>
                    <Text style={styles.employeeName}>{request.employeeName}</Text>
                    <Text style={styles.requestDate}>{request.date}</Text>
                  </View>
                  <Text style={styles.requestReason}>{request.reason}</Text>
                  <View style={styles.buttonRow}>
                    <PrimaryButton
                      title="Approve"
                      onPress={() => handleApprove(request.id)}
                      style={{ flex: 1, marginRight: SPACING.sm, backgroundColor: COLORS.success }}
                    />
                    <PrimaryButton
                      title="Deny"
                      onPress={() => handleDeny(request.id)}
                      style={{ flex: 1, backgroundColor: COLORS.error }}
                    />
                  </View>
                </Card>
              ))
            )}
          </>
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
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: 'bold',
    color: COLORS.teal,
    marginBottom: SPACING.md,
  },
  warningCard: {
    backgroundColor: '#FFF5E6',
    borderWidth: 2,
    borderColor: COLORS.error,
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  warningTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: 'bold',
    color: COLORS.error,
    marginBottom: SPACING.xs,
  },
  warningText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.teal,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: 'bold',
    color: COLORS.teal,
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
  },
  toggleContainer: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.teal,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  toggleButtonActive: {
    backgroundColor: COLORS.teal,
  },
  toggleText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.teal,
  },
  toggleTextActive: {
    color: COLORS.white,
  },
  helpText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray600,
    marginBottom: SPACING.md,
    fontStyle: 'italic',
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: SPACING.md,
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.teal,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  employeeName: {
    fontSize: FONT_SIZE.lg,
    fontWeight: 'bold',
    color: COLORS.gold,
  },
  requestDate: {
    fontSize: FONT_SIZE.md,
    color: COLORS.teal,
    fontWeight: '600',
  },
  requestReason: {
    fontSize: FONT_SIZE.md,
    color: COLORS.teal,
    marginBottom: SPACING.md,
  },
  statusBadge: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  statusApproved: {
    backgroundColor: COLORS.success,
  },
  statusDeclined: {
    backgroundColor: COLORS.error,
  },
  statusText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.white,
    fontWeight: 'bold',
  },
});
