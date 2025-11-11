import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import HeaderBar from '../../components/HeaderBar';
import Card from '../../components/Card';
import api from '../../services/api';
import { useApi } from '../../hooks/useApi';
import { COLORS, FONT_SIZE, SPACING, BORDER_RADIUS } from '../../constants/theme';

export default function Attendance() {
  const { t } = useTranslation();
  const { execute, loading } = useApi();
  const [storesWithWorkers, setStoresWithWorkers] = useState<any[]>([]);
  const [selectedStore, setSelectedStore] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    fetchStoresWithWorkers();
  }, []);

  const fetchStoresWithWorkers = async () => {
    const data = await execute(
      () => api.get('/attendance/currently-working-by-store'),
      { errorMessage: t('common.fetchError') }
    );
    if (data) {
      setStoresWithWorkers(data);
    }
  };

  const handleStorePress = (store: any) => {
    setSelectedStore(store);
    setModalVisible(true);
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
        <Text style={styles.subtitle}>Currently Working by Store</Text>

        {storesWithWorkers.length === 0 ? (
          <Card>
            <Text style={styles.emptyText}>No employees currently working</Text>
          </Card>
        ) : (
          storesWithWorkers.map((store) => (
            <TouchableOpacity
              key={store.storeId}
              style={styles.storeItem}
              onPress={() => handleStorePress(store)}
            >
              <View style={styles.storeIcon}>
                <Ionicons name="storefront" size={24} color={COLORS.gold} />
              </View>
              <View style={styles.storeInfo}>
                <Text style={styles.storeName}>{store.storeName}</Text>
                <Text style={styles.employeeCount}>
                  {store.employeeCount} {store.employeeCount === 1 ? 'employee' : 'employees'} working
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.teal} />
            </TouchableOpacity>
          ))
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
                      <Text style={styles.supervisorText}>Supervisor</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: SPACING.lg,
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray700,
    textAlign: 'center',
    fontStyle: 'italic',
    padding: SPACING.lg,
  },
  storeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.teal,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  storeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF8E1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.teal,
    marginBottom: SPACING.xs,
  },
  employeeCount: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray600,
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
  },
  supervisorText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.white,
    fontWeight: 'bold',
    marginLeft: SPACING.xs,
  },
});
