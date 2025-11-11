import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import HeaderBar from '../../components/HeaderBar';
import Card from '../../components/Card';
import PrimaryButton from '../../components/PrimaryButton';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useApi } from '../../hooks/useApi';
import { COLORS, FONT_SIZE, SPACING, BORDER_RADIUS } from '../../constants/theme';
import Toast from 'react-native-toast-message';

export default function Payroll() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { execute } = useApi();
  const [loading, setLoading] = useState(true);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [paying, setPaying] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchAllEmployees();
  }, []);

  const fetchAllEmployees = async () => {
    const data = await execute(
      () => api.get('/payroll/all-earnings'),
      { errorMessage: 'Failed to load payroll data' }
    );
    
    if (data) {
      setAllEmployees(data);
    }
    
    setLoading(false);
  };

  const handleMarkAsPaid = async (employee: any) => {
    Alert.alert(
      'Confirm Payment',
      `Mark ${employee.employeeName}'s earnings as paid?\n\nNet Amount: ${employee.netUnpaid.toFixed(2)} JD`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark as Paid',
          onPress: async () => {
            setPaying(employee.employeeId);
            
            await execute(
              () => api.post('/payroll/mark-as-paid', {
                employeeId: employee.employeeId,
                month: employee.month,
                year: employee.year,
              }),
              {
                errorMessage: 'Failed to record payment',
                onSuccess: () => {
                  Alert.alert('Success', 'Payment recorded successfully');
                  fetchAllEmployees(); // Refresh list
                },
              }
            );
            
            setPaying(null);
          },
        },
      ]
    );
  };

  const handleViewHistory = async (employee: any) => {
    setSelectedEmployee(employee);
    setLoadingHistory(true);
    setHistoryModalVisible(true);
    
    const data = await execute(
      () => api.get(`/payroll/payment-history/${employee.employeeId}`),
      { errorMessage: 'Failed to load payment history' }
    );
    
    if (data) {
      setPaymentHistory(data);
    }
    
    setLoadingHistory(false);
  };

  const handleExportCSV = async () => {
    setExporting(true);
    
    try {
      // Get current month dates
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      
      const fromDate = firstDay.toISOString().split('T')[0];
      const toDate = lastDay.toISOString().split('T')[0];
      
      // Get token for authorization
      const token = await api.defaults.headers.Authorization;
      
      // Download CSV
      const response = await api.get('/export/payroll', {
        params: { from_date: fromDate, to_date: toDate },
        responseType: 'blob',
      });
      
      // Save to file system
      const filename = `payroll_${today.getFullYear()}_${String(today.getMonth() + 1).padStart(2, '0')}.csv`;
      const fileUri = FileSystem.documentDirectory + filename;
      
      // Convert blob to base64 and write file
      const reader = new FileReader();
      reader.readAsDataURL(response.data);
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        const base64 = base64data.split(',')[1];
        
        await FileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        // Share the file
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri);
          Toast.show({
            type: 'success',
            text1: 'Export Complete',
            text2: 'Payroll CSV exported successfully',
          });
        } else {
          Alert.alert('Success', `File saved to: ${fileUri}`);
        }
      };
    } catch (error: any) {
      console.error('Export error:', error);
      Alert.alert('Export Failed', error.message || 'Failed to export payroll data');
    } finally {
      setExporting(false);
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
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Payroll</Text>
          <Text style={styles.subtitle}>Unpaid Earnings - Current Month</Text>
        </View>
        <TouchableOpacity
          style={styles.exportButton}
          onPress={handleExportCSV}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <>
              <Ionicons name="download-outline" size={20} color={COLORS.white} />
              <Text style={styles.exportText}>Export</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.content}>

        {allEmployees.length === 0 ? (
          <Card>
            <Text style={styles.emptyText}>All employees paid for this month! ✓</Text>
          </Card>
        ) : (
          allEmployees.map((employee) => (
            <Card key={employee.employeeId} style={styles.employeeCard}>
              <View style={styles.employeeHeader}>
                <View style={styles.employeeInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.employeeName}>{employee.employeeName}</Text>
                    {employee.isPaid && (
                      <View style={styles.paidBadge}>
                        <Ionicons name="checkmark-circle" size={16} color={COLORS.white} />
                        <Text style={styles.paidText}>Paid</Text>
                      </View>
                    )}
                    {employee.hasUnpaid && (
                      <View style={styles.unpaidBadge}>
                        <Text style={styles.unpaidText}>Unpaid</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.employeeRole}>{employee.role}</Text>
                </View>
                <TouchableOpacity
                  style={styles.historyButton}
                  onPress={() => handleViewHistory(employee)}
                >
                  <Ionicons name="time-outline" size={20} color={COLORS.teal} />
                  <Text style={styles.historyText}>History</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.earningsGrid}>
                <View style={styles.earningItem}>
                  <Text style={styles.earningLabel}>Total Hours</Text>
                  <Text style={styles.earningValue}>{employee.totalHours}h</Text>
                  <Text style={styles.earningSubtext}>
                    Paid: {employee.paidHours}h | Unpaid: {employee.unpaidHours}h
                  </Text>
                </View>
                {employee.hasUnpaid && (
                  <View style={styles.earningItem}>
                    <Text style={styles.earningLabel}>Unpaid Net</Text>
                    <Text style={[styles.earningValue, styles.netAmount]}>{employee.netUnpaid.toFixed(2)} JD</Text>
                  </View>
                )}
              </View>

              {employee.hasUnpaid && (employee.lateCount > 0 || employee.noShowCount > 0) && (
                <View style={styles.penaltiesSection}>
                  <Text style={styles.penaltiesTitle}>Deductions:</Text>
                  {employee.lateCount > 0 && (
                    <Text style={styles.penaltyText}>
                      • Late ({employee.lateCount}x): -{employee.latePenalty.toFixed(2)} JD
                    </Text>
                  )}
                  {employee.noShowCount > 0 && (
                    <Text style={styles.penaltyText}>
                      • No-Show ({employee.noShowCount}x): -{employee.noShowPenalty.toFixed(2)} JD
                    </Text>
                  )}
                </View>
              )}

              {employee.hasUnpaid && (
                <PrimaryButton
                  title={paying === employee.employeeId ? "Processing..." : "Mark as Paid"}
                  onPress={() => handleMarkAsPaid(employee)}
                  disabled={paying === employee.employeeId}
                  style={{ marginTop: SPACING.md }}
                />
              )}

              {employee.isPaid && employee.lastPaymentDate && (
                <Text style={styles.lastPaidText}>
                  Last paid: {new Date(employee.lastPaymentDate).toLocaleDateString()}
                </Text>
              )}
            </Card>
          ))
        )}
      </ScrollView>

      {/* Payment History Modal */}
      <Modal
        visible={historyModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setHistoryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{selectedEmployee?.employeeName}</Text>
                <Text style={styles.modalSubtitle}>Payment History</Text>
              </View>
              <TouchableOpacity onPress={() => setHistoryModalVisible(false)}>
                <Ionicons name="close-circle" size={32} color={COLORS.teal} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {loadingHistory ? (
                <ActivityIndicator size="large" color={COLORS.teal} style={{ marginTop: SPACING.xl }} />
              ) : paymentHistory.length === 0 ? (
                <Text style={styles.emptyText}>No payment history</Text>
              ) : (
                paymentHistory.map((payment, index) => (
                  <View key={payment.id} style={styles.historyItem}>
                    <View style={styles.historyHeader}>
                      <Text style={styles.historyMonth}>
                        {new Date(payment.year, payment.month - 1).toLocaleDateString('en-US', { 
                          month: 'long', 
                          year: 'numeric' 
                        })}
                      </Text>
                      <Text style={styles.historyDate}>
                        Paid: {new Date(payment.paymentDate).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={styles.historyDetails}>
                      <Text style={styles.historyDetailText}>Hours: {payment.totalHours}h</Text>
                      <Text style={styles.historyDetailText}>Gross: {payment.grossEarnings.toFixed(2)} JD</Text>
                      <Text style={styles.historyDetailText}>Net: {payment.netEarnings.toFixed(2)} JD</Text>
                    </View>
                    {(payment.lateCount > 0 || payment.noShowCount > 0) && (
                      <View style={styles.historyPenalties}>
                        {payment.lateCount > 0 && (
                          <Text style={styles.historyPenaltyText}>
                            Late ({payment.lateCount}x): -{payment.latePenalty.toFixed(2)} JD
                          </Text>
                        )}
                        {payment.noShowCount > 0 && (
                          <Text style={styles.historyPenaltyText}>
                            No-Show ({payment.noShowCount}x): -{payment.noShowPenalty.toFixed(2)} JD
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                ))
              )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    paddingTop: SPACING.lg,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.teal,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.xs,
  },
  exportText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    marginLeft: SPACING.xs,
  },
  content: {
    flex: 1,
    padding: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: 'bold',
    color: COLORS.teal,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray700,
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray700,
    textAlign: 'center',
    fontStyle: 'italic',
    padding: SPACING.lg,
  },
  employeeCard: {
    marginBottom: SPACING.md,
  },
  employeeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: FONT_SIZE.lg,
    fontWeight: 'bold',
    color: COLORS.teal,
  },
  employeeRole: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray600,
    marginTop: SPACING.xs,
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  historyText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.teal,
    marginLeft: SPACING.xs,
    fontWeight: '600',
  },
  earningsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  earningItem: {
    flex: 1,
    alignItems: 'center',
    padding: SPACING.sm,
    backgroundColor: '#F9FAFB',
    borderRadius: BORDER_RADIUS.sm,
    marginHorizontal: SPACING.xs,
  },
  earningLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.gray600,
    marginBottom: SPACING.xs,
  },
  earningValue: {
    fontSize: FONT_SIZE.lg,
    fontWeight: 'bold',
    color: COLORS.teal,
  },
  earningSubtext: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.gray600,
    marginTop: SPACING.xs,
  },
  netAmount: {
    color: COLORS.gold,
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    marginLeft: SPACING.sm,
  },
  paidText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.white,
    fontWeight: 'bold',
    marginLeft: SPACING.xs,
  },
  unpaidBadge: {
    backgroundColor: '#FFF3CD',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    marginLeft: SPACING.sm,
  },
  unpaidText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.error,
    fontWeight: 'bold',
  },
  lastPaidText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray600,
    textAlign: 'center',
    marginTop: SPACING.md,
    fontStyle: 'italic',
  },
  penaltiesSection: {
    backgroundColor: '#FFF3CD',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: SPACING.md,
  },
  penaltiesTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: 'bold',
    color: COLORS.error,
    marginBottom: SPACING.xs,
  },
  penaltyText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.teal,
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
    maxHeight: '80%',
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
  historyItem: {
    backgroundColor: '#F9FAFB',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.gold,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  historyMonth: {
    fontSize: FONT_SIZE.md,
    fontWeight: 'bold',
    color: COLORS.teal,
  },
  historyDate: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray600,
  },
  historyDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  historyDetailText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.teal,
  },
  historyPenalties: {
    marginTop: SPACING.xs,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
  },
  historyPenaltyText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.error,
  },
});