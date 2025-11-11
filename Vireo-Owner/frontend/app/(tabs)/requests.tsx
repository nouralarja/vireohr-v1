import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import HeaderBar from '../../components/HeaderBar';
import Card from '../../components/Card';
import PrimaryButton from '../../components/PrimaryButton';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useApi } from '../../hooks/useApi';
import { COLORS, FONT_SIZE, SPACING, BORDER_RADIUS } from '../../constants/theme';

type RequestStatus = 'PENDING' | 'APPROVED' | 'DECLINED';

export default function Requests() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { execute } = useApi();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<RequestStatus>('PENDING');
  const [requests, setRequests] = useState<any[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, [activeTab]);

  const fetchRequests = async () => {
    setLoading(true);
    const data = await execute(
      () => api.get(`/leave-requests?status=${activeTab}`),
      { errorMessage: 'Failed to fetch requests' }
    );
    
    if (data) {
      setRequests(data);
    }
    
    setLoading(false);
  };

  const handleApprove = async (requestId: string) => {
    setProcessing(requestId);
    
    const result = await execute(
      () => api.patch(`/leave-requests/${requestId}/approve`),
      {
        errorMessage: 'Failed to approve request',
        onSuccess: () => {
          Alert.alert('Success', 'Request approved');
          fetchRequests();
        }
      }
    );
    
    setProcessing(null);
  };

  const handleDeny = async (requestId: string) => {
    setProcessing(requestId);
    
    const result = await execute(
      () => api.patch(`/leave-requests/${requestId}/deny`),
      {
        errorMessage: 'Failed to deny request',
        onSuccess: () => {
          Alert.alert('Success', 'Request denied');
          fetchRequests();
        }
      }
    );
    
    setProcessing(null);
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'day_off':
        return COLORS.gold;
      case 'leave':
        return COLORS.teal;
      default:
        return COLORS.gray600;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'day_off':
        return 'Day Off';
      case 'leave':
        return 'Leave';
      default:
        return type;
    }
  };

  return (
    <View style={styles.container}>
      <HeaderBar />
      <View style={styles.content}>
        <Text style={styles.title}>Requests</Text>

        {/* Segmented Control */}
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[styles.segment, activeTab === 'PENDING' && styles.segmentActive]}
            onPress={() => setActiveTab('PENDING')}
          >
            <Text style={[styles.segmentText, activeTab === 'PENDING' && styles.segmentTextActive]}>
              Pending
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, activeTab === 'APPROVED' && styles.segmentActive]}
            onPress={() => setActiveTab('APPROVED')}
          >
            <Text style={[styles.segmentText, activeTab === 'APPROVED' && styles.segmentTextActive]}>
              Approved
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, activeTab === 'DECLINED' && styles.segmentActive]}
            onPress={() => setActiveTab('DECLINED')}
          >
            <Text style={[styles.segmentText, activeTab === 'DECLINED' && styles.segmentTextActive]}>
              Denied
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.teal} />
          </View>
        ) : (
          <ScrollView style={styles.scrollView}>
            {requests.length === 0 ? (
              <Card>
                <Text style={styles.emptyText}>
                  No {activeTab.toLowerCase()} requests
                </Text>
              </Card>
            ) : (
              requests.map((request) => (
                <Card key={request.id} style={styles.requestCard}>
                  <View style={styles.requestHeader}>
                    <View style={styles.employeeInfo}>
                      <Text style={styles.employeeName}>{request.employeeName}</Text>
                      <View style={styles.badgeContainer}>
                        <View style={[styles.typeBadge, { backgroundColor: getTypeBadgeColor(request.type || 'leave') }]}>
                          <Text style={styles.typeBadgeText}>{getTypeLabel(request.type || 'leave')}</Text>
                        </View>
                      </View>
                    </View>
                    <Text style={styles.requestDate}>{request.date}</Text>
                  </View>

                  <Text style={styles.reasonLabel}>Reason:</Text>
                  <Text style={styles.requestReason}>{request.reason}</Text>

                  {activeTab === 'PENDING' && (
                    <View style={styles.buttonRow}>
                      <PrimaryButton
                        title={processing === request.id ? "Processing..." : "Approve"}
                        onPress={() => handleApprove(request.id)}
                        disabled={processing === request.id}
                        style={[styles.button, { backgroundColor: COLORS.success }]}
                      />
                      <PrimaryButton
                        title={processing === request.id ? "Processing..." : "Deny"}
                        onPress={() => handleDeny(request.id)}
                        disabled={processing === request.id}
                        style={[styles.button, { backgroundColor: COLORS.error }]}
                      />
                    </View>
                  )}

                  {activeTab !== 'PENDING' && request.reviewedAt && (
                    <Text style={styles.reviewedText}>
                      Reviewed: {new Date(request.reviewedAt).toLocaleDateString()}
                    </Text>
                  )}
                </Card>
              ))
            )}
          </ScrollView>
        )}
      </View>
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
  segmentedControl: {
    flexDirection: 'row',
    marginBottom: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.teal,
  },
  segment: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  segmentActive: {
    backgroundColor: COLORS.teal,
  },
  segmentText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.teal,
  },
  segmentTextActive: {
    color: COLORS.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  requestCard: {
    marginBottom: SPACING.md,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: FONT_SIZE.lg,
    fontWeight: 'bold',
    color: COLORS.teal,
    marginBottom: SPACING.xs,
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  typeBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  typeBadgeText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  requestDate: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gold,
    fontWeight: '600',
  },
  reasonLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray600,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  requestReason: {
    fontSize: FONT_SIZE.md,
    color: COLORS.teal,
    marginBottom: SPACING.md,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  button: {
    flex: 1,
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray600,
    textAlign: 'center',
    fontStyle: 'italic',
    padding: SPACING.lg,
  },
  reviewedText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray600,
    fontStyle: 'italic',
    marginTop: SPACING.sm,
  },
});
