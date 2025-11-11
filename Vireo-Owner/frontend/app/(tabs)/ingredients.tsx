import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useAttendanceData } from '../../contexts/AttendanceContext';
import api from '../../services/api';
import { COLORS, SPACING } from '../../constants/theme';
import HeaderBar from '../../components/HeaderBar';
import PrimaryButton from '../../components/PrimaryButton';
import Card from '../../components/Card';
import Input from '../../components/Input';

type CountType = 'FIRST' | 'ADD' | 'FINAL';

interface Ingredient {
  id: string;
  name: string;
  type: string;
  countType?: CountType;
  boxesPerUnit?: number;
}

export default function Ingredients() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { attendance, shifts, loading: contextLoading } = useAttendanceData();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [shift, setShift] = useState<any>(null);
  const [counts, setCounts] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<any>(null);
  const [countData, setCountData] = useState({ boxes: '0', units: '0', kilos: '0' });
  const [hasFirstCount, setHasFirstCount] = useState(false);
  const [hasFinalCount, setHasFinalCount] = useState(false);
  const [savingCount, setSavingCount] = useState(false);
  const [canDoFinalCount, setCanDoFinalCount] = useState(false);

  useEffect(() => {
    fetchData();
  }, [attendance, shifts]);

  const fetchData = async () => {
    try {
      // Use attendance and shifts from context
      const myAttendance = attendance.find(
        (att: any) => att.employeeId === user?.uid && att.status === 'CLOCKED_IN'
      );
      setTodayAttendance(myAttendance);

      // If not clocked in, stop here
      if (!myAttendance) {
        setLoading(false);
        return;
      }

      // Get shift data to check timing for final count
      if (myAttendance.shiftId) {
        const userShift = shifts.find((s: any) => s.id === myAttendance.shiftId);
        setShift(userShift);
        
        // Check if we're within 30 minutes of shift end
        if (userShift) {
          const now = new Date();
          const shiftEndTime = new Date(`${userShift.date}T${userShift.endTime}`);
          const thirtyMinBeforeEnd = new Date(shiftEndTime.getTime() - 30 * 60 * 1000);
          
          setCanDoFinalCount(now >= thirtyMinBeforeEnd);
        }
      }

      // Get ingredients for the store they're clocked into
      const storeId = myAttendance.storeId || user?.assignedStoreId;
      if (!storeId) {
        setLoading(false);
        return;
      }

      const ingredientsRes = await api.get(`/ingredients?storeId=${storeId}`);
      setIngredients(ingredientsRes.data);

      // Get counts for this attendance
      const countsRes = await api.get(`/ingredient-counts?attendanceId=${myAttendance.id}`);
      setCounts(countsRes.data);
      
      const firstCount = countsRes.data.some((c: any) => c.countType === 'FIRST');
      const finalCount = countsRes.data.some((c: any) => c.countType === 'FINAL');
      setHasFirstCount(firstCount);
      setHasFinalCount(finalCount);
    } catch (error) {
      console.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleCount = (ingredient: any, countType: CountType) => {
    setSelectedIngredient({ ...ingredient, countType });
    setCountData({ boxes: '0', units: '0', kilos: '0' });
    setModalVisible(true);
  };

  const submitCount = async () => {
    console.log('=== SUBMIT COUNT CLICKED ===');
    console.log('Selected Ingredient:', selectedIngredient);
    console.log('Today Attendance:', todayAttendance);
    console.log('Count Data:', countData);

    if (!todayAttendance || !selectedIngredient) {
      Alert.alert('Error', 'Missing required data');
      return;
    }

    setSavingCount(true); // Disable button
    console.log('Saving count...');

    try {
      const payload: any = {
        attendanceId: todayAttendance.id,
        ingredientId: selectedIngredient.id,
        storeId: todayAttendance.storeId,
        countType: selectedIngredient.countType,
      };

      if (selectedIngredient.type === 'KILO') {
        payload.kilos = parseFloat(countData.kilos) || 0;
      } else {
        payload.boxes = parseInt(countData.boxes) || 0;
        payload.units = parseInt(countData.units) || 0;
      }

      console.log('Payload:', payload);
      const response = await api.post('/ingredient-counts', payload);
      console.log('✅ SAVE SUCCESS:', response.data);

      setModalVisible(false);
      console.log('Modal closed, refreshing data...');
      await fetchData();
      console.log('Data refreshed');
    } catch (error: any) {
      console.error('❌ SAVE FAILED:', error.response?.data || error.message);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to save count');
    } finally {
      setSavingCount(false); // Re-enable button
      console.log('Save complete, button re-enabled');
    }
  };

  const getIngredientCount = (ingredientId: string): string => {
    const ingredientCounts = counts.filter((c: any) => c.ingredientId === ingredientId);
    if (ingredientCounts.length === 0) return 'No counts yet';

    const first = ingredientCounts.find((c: any) => c.countType === 'FIRST');
    const adds = ingredientCounts.filter((c: any) => c.countType === 'ADD');
    const final = ingredientCounts.find((c: any) => c.countType === 'FINAL');

    let result = '';
    if (first) result += `First: ${formatCount(first)} | `;
    if (adds.length > 0) result += `Added: ${adds.map(formatCount).join(', ')} | `;
    if (final) result += `Final: ${formatCount(final)}`;
    return result || 'Counting...';
  };

  const formatCount = (count: any): string => {
    if (count.kilos !== null && count.kilos !== undefined) {
      return `${count.kilos} kg`;
    }
    return `${count.boxes || 0} boxes, ${count.units || 0} units`;
  };

  const isLowStock = (ingredient: any): boolean => {
    return false; // Placeholder for low stock logic
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <HeaderBar />
        <View style={styles.content}>
          <ActivityIndicator size="large" color={COLORS.teal} />
        </View>
      </View>
    );
  }

  if (!todayAttendance) {
    return (
      <View style={styles.container}>
        <HeaderBar />
        <View style={styles.content}>
          <Card>
            <Text style={styles.infoText}>You must clock in first to access ingredient counting</Text>
            <PrimaryButton
              title="Go to Clock"
              onPress={() => router.push('/(tabs)/clock')}
              style={{ marginTop: SPACING.md }}
            />
          </Card>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HeaderBar />
      <ScrollView style={styles.content}>
        <Text style={styles.title}>Ingredient Counting</Text>

        {/* Flow Indicator */}
        <Card style={styles.flowCard}>
          <View style={styles.flowSteps}>
            <View style={[styles.flowStep, hasFirstCount && styles.flowStepComplete]}>
              <Ionicons 
                name={hasFirstCount ? "checkmark-circle" : "radio-button-off"} 
                size={20} 
                color={hasFirstCount ? COLORS.success : COLORS.teal} 
              />
              <Text style={[styles.flowStepText, hasFirstCount && styles.flowStepTextComplete]}>
                First Count
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={COLORS.teal} style={{ marginHorizontal: SPACING.xs }} />
            <View style={[styles.flowStep, hasFirstCount && !hasFinalCount && styles.flowStepActive]}>
              <Ionicons 
                name="add-circle" 
                size={20} 
                color={hasFirstCount && !hasFinalCount ? COLORS.gold : COLORS.teal} 
              />
              <Text style={[styles.flowStepText, hasFirstCount && !hasFinalCount && styles.flowStepTextActive]}>
                Add Items
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={COLORS.teal} style={{ marginHorizontal: SPACING.xs }} />
            <View style={[styles.flowStep, hasFinalCount && styles.flowStepComplete]}>
              <Ionicons 
                name={hasFinalCount ? "checkmark-circle" : "radio-button-off"} 
                size={20} 
                color={hasFinalCount ? COLORS.success : COLORS.teal} 
              />
              <Text style={[styles.flowStepText, hasFinalCount && styles.flowStepTextComplete]}>
                Final Count
              </Text>
            </View>
          </View>
        </Card>

        {!hasFirstCount && (
          <Card style={styles.warningCard}>
            <Ionicons name="alert-circle" size={24} color={COLORS.teal} />
            <Text style={styles.warningText}>
              Complete FIRST COUNT for all ingredients before continuing
            </Text>
          </Card>
        )}

        {hasFinalCount && (
          <Card style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
            <Text style={styles.successText}>Final count completed! You can now clock out.</Text>
          </Card>
        )}

        {ingredients.map((ingredient) => (
          <Card key={ingredient.id}>
            <View style={styles.ingredientHeader}>
              <View style={styles.ingredientInfo}>
                <Text style={styles.ingredientName}>{ingredient.name}</Text>
                <Text style={styles.ingredientType}>
                  Count by: {ingredient.countType} {ingredient.boxesPerUnit && `(${ingredient.boxesPerUnit} per unit)`}
                </Text>
                <Text style={styles.ingredientCount}>{getIngredientCount(ingredient.id)}</Text>
              </View>
              {isLowStock(ingredient) && (
                <View style={styles.lowStockBadge}>
                  <Text style={styles.lowStockText}>LOW STOCK</Text>
                </View>
              )}
            </View>

            <View style={styles.buttonRow}>
              {!hasFirstCount && (
                <PrimaryButton
                  title="First Count"
                  onPress={() => handleCount(ingredient, 'FIRST')}
                  style={styles.countButton}
                />
              )}
              {hasFirstCount && !hasFinalCount && (
                <>
                  <PrimaryButton
                    title="Add"
                    onPress={() => handleCount(ingredient, 'ADD')}
                    style={[styles.countButton, { backgroundColor: COLORS.gold }]}
                    textStyle={{ color: COLORS.teal }}
                  />
                  {canDoFinalCount && (
                    <PrimaryButton
                      title="Final Count"
                      onPress={() => handleCount(ingredient, 'FINAL')}
                      style={[styles.countButton, { marginLeft: SPACING.sm }]}
                    />
                  )}
                </>
              )}
            </View>
          </Card>
        ))}
      </ScrollView>

      {/* Floating ADD button */}
      {hasFirstCount && !hasFinalCount && (
        <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={32} color={COLORS.teal} />
        </TouchableOpacity>
      )}

      {/* Count Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedIngredient?.countType} Count - {selectedIngredient?.name}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.teal} />
              </TouchableOpacity>
            </View>

            {selectedIngredient?.countType === 'KILO' ? (
              <Input
                label="Kilograms (kg)"
                value={countData.kilos}
                onChangeText={(text) => setCountData({ ...countData, kilos: text })}
                keyboardType="decimal-pad"
                placeholder="0.0"
              />
            ) : (
              <>
                <Input
                  label="Boxes"
                  value={countData.boxes}
                  onChangeText={(text) => setCountData({ ...countData, boxes: text })}
                  keyboardType="number-pad"
                  placeholder="0"
                />
                <Input
                  label="Units"
                  value={countData.units}
                  onChangeText={(text) => setCountData({ ...countData, units: text })}
                  keyboardType="number-pad"
                  placeholder="0"
                />
              </>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.submitButton,
                  savingCount && styles.submitButtonDisabled,
                ]}
                onPress={submitCount}
                disabled={savingCount}
              >
                {savingCount ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.submitButtonText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.teal,
    marginBottom: SPACING.md,
  },
  flowCard: {
    marginBottom: SPACING.md,
  },
  flowSteps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  flowStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  flowStepComplete: {
    opacity: 0.5,
  },
  flowStepActive: {
    // Active step styling
  },
  flowStepText: {
    fontSize: 12,
    color: COLORS.teal,
  },
  flowStepTextComplete: {
    textDecorationLine: 'line-through',
  },
  flowStepTextActive: {
    fontWeight: 'bold',
    color: COLORS.gold,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#FFF9E6',
    marginBottom: SPACING.md,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.teal,
  },
  successCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#E6F7F0',
    marginBottom: SPACING.md,
  },
  successText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.success,
  },
  ingredientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.teal,
    marginBottom: SPACING.xs,
  },
  ingredientType: {
    fontSize: 14,
    color: COLORS.teal,
    opacity: 0.7,
    marginBottom: SPACING.xs,
  },
  ingredientCount: {
    fontSize: 12,
    color: COLORS.teal,
    opacity: 0.6,
  },
  lowStockBadge: {
    backgroundColor: '#FFE6E6',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 4,
  },
  lowStockText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#D32F2F',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  countButton: {
    flex: 1,
  },
  fab: {
    position: 'absolute',
    right: SPACING.lg,
    bottom: SPACING.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.gold,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.lg,
    width: '90%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.teal,
    flex: 1,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  modalButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.lightGray,
  },
  cancelButtonText: {
    color: COLORS.teal,
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: COLORS.teal,
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.teal,
    opacity: 0.6,
  },
  submitButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 16,
    color: COLORS.teal,
    textAlign: 'center',
  },
});