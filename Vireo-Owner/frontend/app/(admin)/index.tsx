import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Switch,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import HeaderBar from '../../components/HeaderBar';
import Card from '../../components/Card';
import api from '../../services/api';
import { useApi } from '../../hooks/useApi';
import { COLORS, FONT_SIZE, SPACING, BORDER_RADIUS } from '../../constants/theme';
import Toast from 'react-native-toast-message';

interface Tenant {
  id: string;
  tenantId: string;
  name: string;
  ownerEmail: string;
  status: string;
  subscriptionEnd: string;
  createdAt: string;
}

export default function SuperAdminDashboard() {
  const { t } = useTranslation();
  const { execute } = useApi();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    setLoading(true);
    const data = await execute(
      () => api.get('/admin/tenants'),
      { errorMessage: 'Failed to load tenants' }
    );
    
    if (data) {
      setTenants(data);
    }
    
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTenants();
    setRefreshing(false);
  };

  const handleToggleSuspend = async (tenant: Tenant) => {
    const newStatus = tenant.status === 'active' ? 'suspended' : 'active';
    const action = newStatus === 'suspended' ? 'suspend' : 'activate';
    
    Alert.alert(
      `${action === 'suspend' ? 'Suspend' : 'Activate'} Tenant`,
      `Are you sure you want to ${action} "${tenant.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action === 'suspend' ? 'Suspend' : 'Activate',
          style: action === 'suspend' ? 'destructive' : 'default',
          onPress: async () => {
            const success = await execute(
              () => api.post(`/admin/tenants/${tenant.tenantId}/suspend`, null, {
                params: { suspend: action === 'suspend' }
              }),
              {
                errorMessage: `Failed to ${action} tenant`,
                onSuccess: () => {
                  Toast.show({
                    type: 'success',
                    text1: 'Success',
                    text2: `Tenant ${action}d successfully`,
                  });
                  fetchTenants();
                },
              }
            );
          },
        },
      ]
    );
  };

  const handleUpdateSubscription = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setTempDate(new Date(tenant.subscriptionEnd));
    setShowDatePicker(true);
  };

  const confirmDateChange = async () => {
    if (!selectedTenant) return;
    
    setShowDatePicker(false);
    
    const isoDate = tempDate.toISOString();
    
    await execute(
      () => api.put(`/admin/tenants/${selectedTenant.tenantId}/subscription`, {
        subscription_end: isoDate
      }),
      {
        errorMessage: 'Failed to update subscription',
        onSuccess: () => {
          Toast.show({
            type: 'success',
            text1: 'Success',
            text2: 'Subscription updated successfully',
          });
          fetchTenants();
        },
      }
    );
  };

  const renderTenant = ({ item }: { item: Tenant }) => {
    const isActive = item.status === 'active';
    const subscriptionDate = new Date(item.subscriptionEnd);
    const isExpired = subscriptionDate < new Date();
    
    return (
      <Card style={[styles.tenantCard, !isActive && styles.suspendedCard]}>
        <View style={styles.tenantHeader}>
          <View style={styles.tenantInfo}>
            <Text style={styles.tenantName}>{item.name}</Text>
            <Text style={styles.tenantEmail}>{item.ownerEmail}</Text>
          </View>
          
          <View style={styles.statusContainer}>
            <View style={[
              styles.statusBadge,
              isActive ? styles.activeBadge : styles.suspendedBadge
            ]}>
              <Text style={[
                styles.statusText,
                isActive ? styles.activeText : styles.suspendedText
              ]}>
                {isActive ? 'Active' : 'Suspended'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.subscriptionRow}>
          <View style={styles.dateInfo}>
            <Ionicons 
              name="calendar-outline" 
              size={16} 
              color={isExpired ? COLORS.error : COLORS.gray700} 
            />
            <Text style={[
              styles.dateText,
              isExpired && styles.expiredText
            ]}>
              Subscription: {subscriptionDate.toLocaleDateString()}
            </Text>
          </View>
          
          <TouchableOpacity
            style={styles.calendarButton}
            onPress={() => handleUpdateSubscription(item)}
          >
            <Ionicons name="calendar" size={20} color={COLORS.teal} />
          </TouchableOpacity>
        </View>

        <View style={styles.actionRow}>
          <Text style={styles.toggleLabel}>
            {isActive ? 'Suspend Account' : 'Activate Account'}
          </Text>
          <Switch
            value={isActive}
            onValueChange={() => handleToggleSuspend(item)}
            trackColor={{ false: COLORS.gray400, true: COLORS.teal }}
            thumbColor={COLORS.white}
          />
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <HeaderBar />
      
      <View style={styles.header}>
        <Text style={styles.title}>Super Admin Dashboard</Text>
        <Text style={styles.subtitle}>{tenants.length} Tenants</Text>
      </View>

      <FlatList
        data={tenants}
        keyExtractor={(item) => item.tenantId}
        renderItem={renderTenant}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.teal}
          />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Loading tenants...</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="business-outline" size={64} color={COLORS.gray400} />
              <Text style={styles.emptyText}>No tenants found</Text>
            </View>
          )
        }
      />

      {/* Date Picker Modal */}
      {showDatePicker && (
        <DateTimePicker
          value={tempDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            if (event.type === 'dismissed') {
              setShowDatePicker(false);
              return;
            }
            
            if (selectedDate) {
              setTempDate(selectedDate);
              
              if (Platform.OS === 'android') {
                confirmDateChange();
              }
            }
          }}
          minimumDate={new Date()}
        />
      )}
      
      {/* iOS Date Picker Confirm Button */}
      {showDatePicker && Platform.OS === 'ios' && (
        <View style={styles.datePickerButtons}>
          <TouchableOpacity
            style={[styles.dateButton, styles.cancelButton]}
            onPress={() => setShowDatePicker(false)}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.dateButton, styles.confirmButton]}
            onPress={confirmDateChange}
          >
            <Text style={styles.confirmButtonText}>Confirm</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    padding: SPACING.lg,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: 'bold',
    color: COLORS.teal,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray600,
  },
  listContent: {
    padding: SPACING.md,
  },
  tenantCard: {
    marginBottom: SPACING.md,
    padding: SPACING.lg,
  },
  suspendedCard: {
    opacity: 0.6,
    borderColor: COLORS.error,
    borderWidth: 1,
  },
  tenantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  tenantInfo: {
    flex: 1,
  },
  tenantName: {
    fontSize: FONT_SIZE.lg,
    fontWeight: 'bold',
    color: COLORS.teal,
    marginBottom: SPACING.xs,
  },
  tenantEmail: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray600,
  },
  statusContainer: {
    marginLeft: SPACING.md,
  },
  statusBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
  },
  activeBadge: {
    backgroundColor: '#D4EDDA',
  },
  suspendedBadge: {
    backgroundColor: '#F8D7DA',
  },
  statusText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  activeText: {
    color: '#155724',
  },
  suspendedText: {
    color: '#721C24',
  },
  subscriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
  },
  dateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray700,
    marginLeft: SPACING.xs,
  },
  expiredText: {
    color: COLORS.error,
    fontWeight: '600',
  },
  calendarButton: {
    padding: SPACING.sm,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
  },
  toggleLabel: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray700,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyText: {
    fontSize: FONT_SIZE.lg,
    color: COLORS.gray500,
    marginTop: SPACING.md,
  },
  datePickerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
  },
  dateButton: {
    flex: 1,
    padding: SPACING.md,
    marginHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.gray200,
  },
  confirmButton: {
    backgroundColor: COLORS.teal,
  },
  cancelButtonText: {
    color: COLORS.gray700,
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
  },
  confirmButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
  },
});
