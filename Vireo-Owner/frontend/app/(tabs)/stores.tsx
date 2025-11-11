import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import HeaderBar from '../../components/HeaderBar';
import Card from '../../components/Card';
import Input from '../../components/Input';
import PrimaryButton from '../../components/PrimaryButton';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useApi } from '../../hooks/useApi';
import { COLORS, FONT_SIZE, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { Store } from '../../types';

export default function Stores() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { execute } = useApi();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeCount, setStoreCount] = useState({ count: 0, max: 50, canAdd: true });
  const [modalVisible, setModalVisible] = useState(false);
  const [ingredientModalVisible, setIngredientModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteIngredientModalVisible, setDeleteIngredientModalVisible] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState<string | null>(null);
  const [ingredientToDelete, setIngredientToDelete] = useState<{ id: string; storeId: string } | null>(null);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [selectedStoreForIngredients, setSelectedStoreForIngredients] = useState<Store | null>(null);
  const [editingIngredient, setEditingIngredient] = useState<any | null>(null);
  const [storeIngredients, setStoreIngredients] = useState<Record<string, any[]>>({});
  const [savingIngredient, setSavingIngredient] = useState(false);
  
  // Role checks
  const userRole = String(user?.role || '').toUpperCase();
  const isOwner = userRole === 'OWNER';
  const isCO = userRole === 'CO';
  const canAddStore = isOwner; // Only Owner can add stores
  const canEditStore = isOwner; // Only Owner can edit stores
  const canDeleteStore = isOwner; // Only Owner can delete stores
  const canAddIngredient = isOwner; // Only Owner can add ingredients
  const canEditIngredient = isOwner; // Only Owner can edit ingredients
  const canDeleteIngredient = isOwner; // Only Owner can delete ingredients
  
  const [formData, setFormData] = useState({ 
    name: '', 
    address: '', 
    phone: '',
    lat: 31.9539,
    lng: 35.9106,
    radius: 10
  });
  const [ingredientFormData, setIngredientFormData] = useState({
    name: '',
    countType: 'BOX',
    unitsPerBox: 1,
    lowStockThreshold: 10,
  });

  useEffect(() => {
    fetchStores();
    fetchStoreCount();
  }, []);

  const fetchStores = async () => {
    const data = await execute(
      () => api.get('/stores'),
      { errorMessage: 'Failed to load stores' }
    );
    
    if (data) {
      setStores(data);
      // Fetch ingredients for each store
      data.forEach((store: Store) => {
        fetchStoreIngredients(store.id);
      });
    }
    
    setLoading(false);
  };

  const fetchStoreIngredients = async (storeId: string) => {
    const data = await execute(
      () => api.get(`/ingredients?storeId=${storeId}`),
      { 
        errorMessage: `Failed to load ingredients for store`,
        showError: false, // Silent fail for ingredients
      }
    );
    
    if (data) {
      setStoreIngredients(prev => ({ ...prev, [storeId]: data }));
    }
  };

  const fetchStoreCount = async () => {
    const data = await execute(
      () => api.get('/stores/count'),
      { 
        errorMessage: 'Failed to fetch store count',
        showError: false, // Silent fail for count
      }
    );
    
    if (data) {
      setStoreCount(data);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.address) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const result = await execute(
      () => editingStore 
        ? api.put(`/stores/${editingStore.id}`, formData)
        : api.post('/stores', formData),
      {
        errorMessage: `Failed to ${editingStore ? 'update' : 'create'} store`,
        onSuccess: () => {
          Alert.alert('Success', `Store ${editingStore ? 'updated' : 'created'} successfully`);
          setModalVisible(false);
          setFormData({ name: '', address: '', phone: '', lat: 31.9539, lng: 35.9106, radius: 10 });
          setEditingStore(null);
          fetchStores();
          fetchStoreCount();
        },
      }
    );
  };

  const handleEdit = (store: Store) => {
    setEditingStore(store);
    setFormData({
      name: store.name,
      address: store.address,
      phone: store.phone || '',
      lat: store.lat || 31.9539,
      lng: store.lng || 35.9106,
      radius: store.radius || 10,
    });
    setModalVisible(true);
  };

  const handleDelete = (storeId: string) => {
    setStoreToDelete(storeId);
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    if (!storeToDelete) return;
    
    await execute(
      () => api.delete(`/stores/${storeToDelete}`),
      {
        errorMessage: 'Failed to delete store',
        onSuccess: () => {
          setDeleteModalVisible(false);
          setStoreToDelete(null);
          fetchStores();
          fetchStoreCount();
          Alert.alert('Success', 'Store deleted successfully');
        },
      }
    );
  };

  const handleIngredientSubmit = async () => {
    if (!ingredientFormData.name || !selectedStoreForIngredients) {
      Alert.alert('Error', 'Please enter ingredient name');
      return;
    }

    // Validate units per box for BOX type
    if (ingredientFormData.countType === 'BOX' && ingredientFormData.unitsPerBox <= 0) {
      Alert.alert('Error', 'Units per box must be greater than 0');
      return;
    }

    setSavingIngredient(true);
    
    const dataWithStore = { ...ingredientFormData, storeId: selectedStoreForIngredients.id };
    
    const result = await execute(
      () => editingIngredient
        ? api.put(`/ingredients/${editingIngredient.id}`, dataWithStore)
        : api.post('/ingredients', dataWithStore),
      {
        errorMessage: `Failed to ${editingIngredient ? 'update' : 'create'} ingredient`,
      }
    );
    
    if (result) {
      // Close modal first
      setIngredientModalVisible(false);
      setIngredientFormData({ name: '', countType: 'BOX', unitsPerBox: 1, lowStockThreshold: 10 });
      setEditingIngredient(null);
      
      // Immediately refresh the ingredients for this store
      await fetchStoreIngredients(selectedStoreForIngredients.id);
      
      // Show success alert AFTER refresh
      Alert.alert('Success', editingIngredient ? 'Ingredient updated!' : 'Ingredient created!');
    }
    
    setSavingIngredient(false);
  };

  const handleDeleteIngredient = (ingredientId: string, storeId: string) => {
    setIngredientToDelete({ id: ingredientId, storeId });
    setDeleteIngredientModalVisible(true);
  };

  const confirmDeleteIngredient = async () => {
    if (!ingredientToDelete) return;
    
    await execute(
      () => api.delete(`/ingredients/${ingredientToDelete.id}`),
      {
        errorMessage: 'Failed to delete ingredient',
        onSuccess: async () => {
          setDeleteIngredientModalVisible(false);
          setIngredientToDelete(null);
          await fetchStoreIngredients(ingredientToDelete.storeId);
          Alert.alert('Success', 'Ingredient deleted successfully');
        },
      }
    );
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
        <View style={styles.header}>
          <Text style={styles.title}>{t('navigation.stores')}</Text>
          {isOwner && (
            <Text style={styles.count}>
              {storeCount.count} / {storeCount.max}
            </Text>
          )}
        </View>

        {!storeCount.canAdd && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning" size={20} color={COLORS.teal} />
            <Text style={styles.warningText}>{t('stores.maxReached')}</Text>
          </View>
        )}

        {canAddStore && (
          <PrimaryButton
            title={t('stores.addStore')}
            onPress={() => setModalVisible(true)}
            disabled={!storeCount.canAdd}
            style={{ marginBottom: SPACING.lg }}
          />
        )}

        {stores.map((store) => (
          <Card key={store.id} style={styles.storeCard}>
            <View style={styles.storeHeader}>
              <Text style={styles.storeName}>{store.name}</Text>
              {canEditStore && (
                <View style={styles.actions}>
                  <TouchableOpacity onPress={() => handleEdit(store)}>
                    <Ionicons name="create-outline" size={24} color={COLORS.teal} />
                  </TouchableOpacity>
                  {canDeleteStore && (
                    <TouchableOpacity onPress={() => handleDelete(store.id)} style={{ marginLeft: SPACING.md }}>
                      <Ionicons name="trash-outline" size={24} color={COLORS.error} />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
            <Text style={styles.storeInfo}>{store.address}</Text>
            {store.phone && <Text style={styles.storeInfo}>{store.phone}</Text>}
            
            <View style={styles.ingredientsSection}>
              <View style={styles.ingredientsHeader}>
                <Text style={styles.ingredientsTitle}>Ingredients ({storeIngredients[store.id]?.length || 0})</Text>
                {canEditIngredient && (
                  <TouchableOpacity onPress={() => {
                    setSelectedStoreForIngredients(store);
                    setIngredientModalVisible(true);
                  }}>
                    <Ionicons name="add-circle" size={24} color={COLORS.gold} />
                  </TouchableOpacity>
                )}
              </View>
              
              {storeIngredients[store.id]?.map((ingredient: any) => (
                <View key={ingredient.id} style={styles.ingredientItem}>
                  <View style={styles.ingredientInfo}>
                    <Text style={styles.ingredientName}>{ingredient.name}</Text>
                    <Text style={styles.ingredientDetail}>
                      {ingredient.countType}
                      {ingredient.countType === 'BOX' && ` (${ingredient.unitsPerBox || 1} units/box)`}
                    </Text>
                  </View>
                  {(canEditIngredient || canDeleteIngredient) && (
                    <View style={styles.ingredientActions}>
                      {canEditIngredient && (
                        <TouchableOpacity onPress={() => {
                          setSelectedStoreForIngredients(store);
                          setEditingIngredient(ingredient);
                          setIngredientFormData({
                            name: ingredient.name,
                            countType: ingredient.countType,
                            unitsPerBox: ingredient.unitsPerBox || 1,
                            lowStockThreshold: ingredient.lowStockThreshold || 10,
                          });
                          setIngredientModalVisible(true);
                        }}>
                          <Ionicons name="create-outline" size={20} color={COLORS.teal} />
                        </TouchableOpacity>
                      )}
                      {canDeleteIngredient && (
                        <TouchableOpacity onPress={() => handleDeleteIngredient(ingredient.id, store.id)} style={{ marginLeft: SPACING.sm }}>
                          <Ionicons name="trash-outline" size={20} color={COLORS.error} />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              ))}
            </View>
          </Card>
        ))}

      </ScrollView>

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
                {editingStore ? 'Edit Store' : t('stores.addStore')}
              </Text>
              <TouchableOpacity onPress={() => {
                setModalVisible(false);
                setEditingStore(null);
                setFormData({ name: '', address: '', phone: '', lat: 31.9539, lng: 35.9106, radius: 10 });
              }}>
                <Ionicons name="close" size={24} color={COLORS.gray700} />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <Input
                label={t('stores.storeName')}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder={t('stores.storeName')}
              />

              <Input
                label={t('stores.address')}
                value={formData.address}
                onChangeText={(text) => setFormData({ ...formData, address: text })}
                placeholder={t('stores.address')}
                multiline
                numberOfLines={3}
              />

              <Input
                label={t('stores.phone')}
                value={formData.phone}
                onChangeText={(text) => setFormData({ ...formData, phone: text })}
                placeholder={t('stores.phone')}
                keyboardType="phone-pad"
              />

              <Input
                label="Latitude"
                value={formData.lat.toString()}
                onChangeText={(text) => setFormData({ ...formData, lat: parseFloat(text) || 0 })}
                placeholder="31.9539"
                keyboardType="decimal-pad"
              />

              <Input
                label="Longitude"
                value={formData.lng.toString()}
                onChangeText={(text) => setFormData({ ...formData, lng: parseFloat(text) || 0 })}
                placeholder="35.9106"
                keyboardType="decimal-pad"
              />

              <Input
                label="Radius (meters)"
                value={formData.radius.toString()}
                onChangeText={(text) => setFormData({ ...formData, radius: parseInt(text) || 10 })}
                placeholder="10"
                keyboardType="number-pad"
              />

              <PrimaryButton
                title={t('common.save')}
                onPress={handleSubmit}
                style={{ marginTop: SPACING.md }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Ingredient Modal */}
      <Modal
        visible={ingredientModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIngredientModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingIngredient ? 'Edit Ingredient' : 'Add Ingredient'}
              </Text>
              <TouchableOpacity onPress={() => {
                setIngredientModalVisible(false);
                setEditingIngredient(null);
                setIngredientFormData({ name: '', countType: 'BOX', unitsPerBox: 1, lowStockThreshold: 10 });
              }}>
                <Ionicons name="close" size={24} color={COLORS.gray700} />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <Input
                label="Ingredient Name"
                value={ingredientFormData.name}
                onChangeText={(text) => setIngredientFormData({ ...ingredientFormData, name: text })}
                placeholder="e.g., Flour, Sugar, Salt"
              />

              <Text style={styles.inputLabel}>Count Type</Text>
              <View style={styles.radioGroup}>
                <TouchableOpacity
                  style={[styles.radioOption, ingredientFormData.countType === 'BOX' && styles.radioOptionSelected]}
                  onPress={() => setIngredientFormData({ ...ingredientFormData, countType: 'BOX' })}
                >
                  <Text style={[styles.radioText, ingredientFormData.countType === 'BOX' && styles.radioTextSelected]}>
                    Box
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.radioOption, ingredientFormData.countType === 'UNIT' && styles.radioOptionSelected]}
                  onPress={() => setIngredientFormData({ ...ingredientFormData, countType: 'UNIT' })}
                >
                  <Text style={[styles.radioText, ingredientFormData.countType === 'UNIT' && styles.radioTextSelected]}>
                    Unit
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.radioOption, ingredientFormData.countType === 'KILO' && styles.radioOptionSelected]}
                  onPress={() => setIngredientFormData({ ...ingredientFormData, countType: 'KILO' })}
                >
                  <Text style={[styles.radioText, ingredientFormData.countType === 'KILO' && styles.radioTextSelected]}>
                    Kilo
                  </Text>
                </TouchableOpacity>
              </View>

              {ingredientFormData.countType === 'BOX' && (
                <Input
                  label="Units per Box"
                  value={String(ingredientFormData.unitsPerBox)}
                  onChangeText={(text) => {
                    // Allow empty string for editing
                    if (text === '') {
                      setIngredientFormData({ ...ingredientFormData, unitsPerBox: 0 });
                      return;
                    }
                    // Only update if it's a valid number
                    const num = parseInt(text, 10);
                    if (!isNaN(num) && num >= 0) {
                      setIngredientFormData({ ...ingredientFormData, unitsPerBox: num });
                    }
                  }}
                  placeholder="24"
                  keyboardType="numeric"
                />
              )}

              <Input
                label="Low Stock Threshold (%)"
                value={String(ingredientFormData.lowStockThreshold)}
                onChangeText={(text) => {
                  const num = parseFloat(text) || 0;
                  setIngredientFormData({ ...ingredientFormData, lowStockThreshold: num });
                }}
                placeholder="10"
                keyboardType="decimal-pad"
              />

              <PrimaryButton
                title={t('common.save')}
                onPress={handleIngredientSubmit}
                loading={savingIngredient}
                disabled={savingIngredient}
                style={{ marginTop: SPACING.md }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalContent}>
            <Ionicons name="warning" size={48} color={COLORS.error} style={{ marginBottom: SPACING.md }} />
            <Text style={styles.deleteModalTitle}>Delete Store?</Text>
            <Text style={styles.deleteModalText}>
              Are you sure you want to delete this store? This action cannot be undone.
            </Text>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.cancelButton]}
                onPress={() => {
                  setDeleteModalVisible(false);
                  setStoreToDelete(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.confirmDeleteButton]}
                onPress={confirmDelete}
              >
                <Text style={styles.confirmDeleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Ingredient Confirmation Modal */}
      <Modal
        visible={deleteIngredientModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setDeleteIngredientModalVisible(false)}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalContent}>
            <Ionicons name="warning" size={48} color={COLORS.error} style={{ marginBottom: SPACING.md }} />
            <Text style={styles.deleteModalTitle}>Delete Ingredient?</Text>
            <Text style={styles.deleteModalText}>
              Are you sure you want to delete this ingredient? This action cannot be undone.
            </Text>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.cancelButton]}
                onPress={() => {
                  setDeleteIngredientModalVisible(false);
                  setIngredientToDelete(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.confirmDeleteButton]}
                onPress={confirmDeleteIngredient}
              >
                <Text style={styles.confirmDeleteButtonText}>Delete</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: 'bold',
    color: COLORS.teal,
  },
  count: {
    fontSize: FONT_SIZE.lg,
    color: COLORS.gold,
    fontWeight: '600',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gold,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
  },
  warningText: {
    marginLeft: SPACING.sm,
    color: COLORS.teal,
    fontWeight: '600',
  },
  storeCard: {
    marginBottom: SPACING.md,
  },
  storeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  storeName: {
    fontSize: FONT_SIZE.lg,
    fontWeight: 'bold',
    color: COLORS.gold,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
  },
  storeInfo: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray700,
    marginTop: SPACING.xs,
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
  },
  sectionDivider: {
    height: 2,
    backgroundColor: COLORS.gold,
    marginVertical: SPACING.xl,
  },
  inputLabel: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.teal,
    marginBottom: SPACING.sm,
  },
  radioGroup: {
    flexDirection: 'row',
    marginBottom: SPACING.lg,
  },
  radioOption: {
    flex: 1,
    padding: SPACING.md,
    borderWidth: 2,
    borderColor: COLORS.gold,
    borderRadius: BORDER_RADIUS.md,
    marginRight: SPACING.sm,
    alignItems: 'center',
  },
  radioOptionSelected: {
    backgroundColor: COLORS.teal,
    borderColor: COLORS.teal,
  },
  radioText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.teal,
    fontWeight: '600',
  },
  radioTextSelected: {
    color: COLORS.white,
  },
  ingredientsSection: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.gold,
  },
  ingredientsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  ingredientsTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.gold,
  },
  ingredientItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gold + '20',
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientName: {
    fontSize: FONT_SIZE.md,
    color: COLORS.teal,
    fontWeight: '500',
  },
  ingredientDetail: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gold,
    marginTop: 2,
  },
  ingredientActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  deleteModalContent: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.xl,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  deleteModalTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: 'bold',
    color: COLORS.teal,
    marginBottom: SPACING.sm,
  },
  deleteModalText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.teal,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: SPACING.md,
  },
  deleteModalButton: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.teal,
  },
  cancelButtonText: {
    color: COLORS.teal,
    fontWeight: '600',
    fontSize: FONT_SIZE.md,
  },
  confirmDeleteButton: {
    backgroundColor: COLORS.error,
  },
  confirmDeleteButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: FONT_SIZE.md,
  },
});