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
  TextInput,
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

export default function Employees() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { execute } = useApi();
  const [loading, setLoading] = useState(true);
  const [loadingStores, setLoadingStores] = useState(false);
  const [savingEmployee, setSavingEmployee] = useState(false);
  const [deletingEmployee, setDeletingEmployee] = useState(false);
  const [creatingEmployee, setCreatingEmployee] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<any>(null);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [salary, setSalary] = useState('');
  
  // Edit fields
  const [employeeName, setEmployeeName] = useState('');
  const [employeeEmail, setEmployeeEmail] = useState('');
  const [employeeRole, setEmployeeRole] = useState('EMPLOYEE');
  
  // New employee form fields
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeeEmail, setNewEmployeeEmail] = useState('');
  const [newEmployeeRole, setNewEmployeeRole] = useState('EMPLOYEE');
  const [newEmployeeStoreId, setNewEmployeeStoreId] = useState('');
  const [newEmployeeSalary, setNewEmployeeSalary] = useState('');
  
  // Role checks
  const userRole = String(user?.role || '').toUpperCase();
  const isOwner = userRole === 'OWNER';
  const isCO = userRole === 'CO';
  const isAccountant = userRole === 'ACCOUNTANT';
  const isOwnerOrCO = isOwner || isCO;
  const canDeleteEmployee = isOwner; // Only Owner can delete employees
  const canAddEmployee = isOwner; // Only Owner can add employees
  const canEditSalary = isOwner || isCO; // Owner and CO can edit salary
  const canAssignStore = isOwner; // Only Owner can assign stores
  const canEditEmployee = isOwner || isCO; // Accountant cannot edit

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoadingStores(true);
    
    const [employeesData, storesData] = await Promise.all([
      execute(() => api.get('/employees'), {
        errorMessage: 'Failed to load employees',
      }),
      execute(() => api.get('/stores'), {
        errorMessage: 'Failed to load stores',
      }),
    ]);

    if (employeesData) {
      setEmployees(employeesData);
    }
    if (storesData) {
      setStores(storesData);
    }
    
    setLoading(false);
    setLoadingStores(false);
  };

  const handleAssign = (employee: any) => {
    setSelectedEmployee(employee);
    setSelectedStoreId(employee.assignedStoreId || '');
    setSalary(employee.salary ? String(employee.salary) : '');
    setEmployeeName(employee.name || '');
    setEmployeeEmail(employee.email || '');
    setEmployeeRole(employee.role || 'EMPLOYEE');
    setModalVisible(true);
  };

  const handleSave = async () => {
    setSavingEmployee(true);
    
    const updateData: any = {};
    
    // Owner can edit name, email, role
    if (isOwner) {
      if (employeeName && employeeName.trim()) {
        updateData.name = employeeName.trim();
      }
      if (employeeEmail && employeeEmail.trim()) {
        updateData.email = employeeEmail.trim();
      }
      if (employeeRole) {
        updateData.role = employeeRole;
      }
    }
    
    // Only include store if user has permission to assign AND a store is selected
    if (canAssignStore) {
      // Allow setting or clearing the store assignment
      updateData.assignedStoreId = selectedStoreId || null;
    }
    
    // Only include salary if it's been entered and user has permission
    if (salary && canEditSalary) {
      const salaryNum = parseFloat(salary);
      if (isNaN(salaryNum) || salaryNum < 0) {
        Alert.alert('Error', 'Please enter a valid salary amount');
        setSavingEmployee(false);
        return;
      }
      updateData.salary = salaryNum;
    }

    // Only update if there's something to update
    if (Object.keys(updateData).length === 0) {
      Alert.alert('Error', 'No changes to save');
      setSavingEmployee(false);
      return;
    }

    const result = await execute(
      () => api.put(`/employees/${selectedEmployee.id}`, updateData),
      {
        errorMessage: 'Failed to update employee',
        onSuccess: () => {
          Alert.alert('Success', 'Employee updated successfully');
          setModalVisible(false);
          fetchData();
        },
      }
    );
    
    setSavingEmployee(false);
  };

  const handleDeletePress = (employee: any) => {
    setEmployeeToDelete(employee);
    setDeleteModalVisible(true);
  };

  const handleDeleteConfirm = async () => {
    if (!employeeToDelete) return;

    setDeletingEmployee(true);
    
    await execute(
      () => api.delete(`/employees/${employeeToDelete.id}`),
      {
        errorMessage: 'Failed to delete employee',
        onSuccess: () => {
          Alert.alert('Success', 'Employee deleted successfully');
          setDeleteModalVisible(false);
          setEmployeeToDelete(null);
          fetchData();
        },
      }
    );
    
    setDeletingEmployee(false);
  };

  const handleAddEmployee = async () => {
    if (!newEmployeeName || !newEmployeeEmail || !newEmployeeRole) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmployeeEmail)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setCreatingEmployee(true);
    
    const createData: any = {
      name: newEmployeeName,
      email: newEmployeeEmail,
      role: newEmployeeRole,
      assignedStoreId: newEmployeeStoreId || null,
    };

    const response = await execute(
      () => api.post('/employees', createData),
      {
        errorMessage: 'Failed to create employee',
      }
    );
    
    if (response) {
      // If salary was entered and user has permission, update it
      if (newEmployeeSalary && isOwnerOrCO) {
        const salaryNum = parseFloat(newEmployeeSalary);
        if (!isNaN(salaryNum) && salaryNum > 0) {
          await execute(
            () => api.put(`/employees/${response.id}`, { salary: salaryNum }),
            {
              errorMessage: 'Employee created but failed to set salary',
              showError: false, // Don't show error toast for optional salary update
            }
          );
        }
      }

      Alert.alert('Success', 'Employee created successfully!\n\nDefault password: gosta123\n\nThe employee should change this on first login.');
      setAddModalVisible(false);
      // Reset form
      setNewEmployeeName('');
      setNewEmployeeEmail('');
      setNewEmployeeRole('EMPLOYEE');
      setNewEmployeeStoreId('');
      setNewEmployeeSalary('');
      fetchData();
    }
    
    setCreatingEmployee(false);
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
          <Text style={styles.title}>Employees</Text>
          {canAddEmployee && (
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setAddModalVisible(true)}
            >
              <Ionicons name="add-circle" size={32} color={COLORS.gold} />
            </TouchableOpacity>
          )}
        </View>

        {employees.map((employee) => (
          <Card key={employee.id}>
            <View style={styles.employeeHeader}>
              <View style={styles.employeeInfo}>
                <Text style={styles.employeeName}>{employee.name}</Text>
                {isOwner && employee.role && (
                  <Text style={styles.employeeRole}>{employee.role}</Text>
                )}
                {isOwner && employee.email && (
                  <Text style={styles.employeeEmail}>{employee.email}</Text>
                )}
                {employee.assignedStoreId && (
                  <Text style={styles.assignedStore}>
                    Store: {stores.find(s => s.id === employee.assignedStoreId)?.name || employee.assignedStoreId}
                  </Text>
                )}
                {(isOwner || isCO) && employee.salary && employee.role !== 'OWNER' && (
                  <Text style={styles.employeeSalary}>
                    Salary: ${parseFloat(employee.salary).toFixed(2)}
                  </Text>
                )}
              </View>
              <View style={styles.actionButtons}>
                {canEditEmployee && (
                  <TouchableOpacity
                    style={styles.assignButton}
                    onPress={() => handleAssign(employee)}
                  >
                    <Ionicons name="create" size={24} color={COLORS.teal} />
                    <Text style={styles.assignText}>Edit</Text>
                  </TouchableOpacity>
                )}
                {canDeleteEmployee && (
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeletePress(employee)}
                  >
                    <Ionicons name="trash" size={24} color={COLORS.gold} />
                    <Text style={styles.deleteText}>Delete</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>

      {/* Assignment Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Employee</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.teal} />
              </TouchableOpacity>
            </View>

            <Text style={styles.employeeLabel}>
              Employee: {selectedEmployee?.name}
            </Text>

            {isOwner && (
              <>
                <Text style={styles.inputLabel}>Name:</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter name"
                  placeholderTextColor={COLORS.teal + '80'}
                  value={employeeName}
                  onChangeText={setEmployeeName}
                />

                <Text style={styles.inputLabel}>Email:</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter email"
                  placeholderTextColor={COLORS.teal + '80'}
                  value={employeeEmail}
                  onChangeText={setEmployeeEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <Text style={styles.inputLabel}>Role:</Text>
                <View style={styles.roleSelector}>
                  {['EMPLOYEE', 'MANAGER', 'ACCOUNTANT', 'CO', 'OWNER'].map((role) => (
                    <TouchableOpacity
                      key={role}
                      style={[
                        styles.roleChip,
                        employeeRole === role && styles.roleChipSelected,
                      ]}
                      onPress={() => setEmployeeRole(role)}
                    >
                      <Text style={[
                        styles.roleChipText,
                        employeeRole === role && styles.roleChipTextSelected,
                      ]}>
                        {role}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {canAssignStore && (
              <>
                <Text style={styles.storeLabel}>Select Store:</Text>
                {loadingStores ? (
                  <View style={styles.loadingStores}>
                    <ActivityIndicator size="small" color={COLORS.teal} />
                    <Text style={styles.loadingText}>Loading stores...</Text>
                  </View>
                ) : (
                  <ScrollView style={styles.storeList}>
                    {stores.length === 0 ? (
                      <Text style={styles.emptyText}>No stores available</Text>
                    ) : (
                      stores.map((store) => (
                        <TouchableOpacity
                          key={store.id}
                          style={[
                            styles.storeItem,
                            selectedStoreId === store.id && styles.storeItemSelected,
                          ]}
                          onPress={() => setSelectedStoreId(store.id)}
                        >
                          <View style={styles.storeItemContent}>
                            <Text style={[
                              styles.storeName,
                              selectedStoreId === store.id && styles.storeNameSelected,
                            ]}>
                              {store.name}
                            </Text>
                            <Text style={styles.storeAddress}>{store.address}</Text>
                          </View>
                          {selectedStoreId === store.id && (
                            <Ionicons name="checkmark-circle" size={24} color={COLORS.teal} />
                          )}
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>
                )}
              </>
            )}

            {canEditSalary && (
              <>
                <Text style={styles.salaryLabel}>Salary:</Text>
                <TextInput
                  style={styles.salaryInput}
                  placeholder="Enter salary amount"
                  placeholderTextColor={COLORS.teal + '80'}
                  value={salary}
                  onChangeText={setSalary}
                  keyboardType="decimal-pad"
                />
              </>
            )}

            <PrimaryButton
              title={savingEmployee ? "Saving..." : "Save Changes"}
              onPress={handleSave}
              disabled={savingEmployee}
              style={{ marginTop: SPACING.md }}
            />
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
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModalContent}>
            <View style={styles.warningIconContainer}>
              <Ionicons name="warning" size={48} color={COLORS.gold} />
            </View>
            <Text style={styles.deleteModalTitle}>Delete Employee</Text>
            <Text style={styles.deleteModalMessage}>
              Are you sure you want to delete {employeeToDelete?.name}? This action cannot be undone.
            </Text>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setDeleteModalVisible(false);
                  setEmployeeToDelete(null);
                }}
                disabled={deletingEmployee}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmDeleteButton, deletingEmployee && styles.disabledButton]}
                onPress={handleDeleteConfirm}
                disabled={deletingEmployee}
              >
                {deletingEmployee ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.confirmDeleteButtonText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Employee Modal */}
      <Modal
        visible={addModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Employee</Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.teal} />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <Text style={styles.inputLabel}>Name *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter full name"
                placeholderTextColor={COLORS.teal + '80'}
                value={newEmployeeName}
                onChangeText={setNewEmployeeName}
              />

              <Text style={styles.inputLabel}>Email *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter email address"
                placeholderTextColor={COLORS.teal + '80'}
                value={newEmployeeEmail}
                onChangeText={setNewEmployeeEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>Role *</Text>
              <View style={styles.roleSelector}>
                {['EMPLOYEE', 'MANAGER', 'ACCOUNTANT', 'CO', 'OWNER'].map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.roleChip,
                      newEmployeeRole === role && styles.roleChipSelected,
                    ]}
                    onPress={() => setNewEmployeeRole(role)}
                  >
                    <Text style={[
                      styles.roleChipText,
                      newEmployeeRole === role && styles.roleChipTextSelected,
                    ]}>
                      {role.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Assign to Store (Optional)</Text>
              {loadingStores ? (
                <ActivityIndicator size="small" color={COLORS.teal} />
              ) : (
                <ScrollView style={styles.storeListSmall}>
                  <TouchableOpacity
                    style={[
                      styles.storeItem,
                      newEmployeeStoreId === '' && styles.storeItemSelected,
                    ]}
                    onPress={() => setNewEmployeeStoreId('')}
                  >
                    <Text style={styles.storeName}>No Store</Text>
                  </TouchableOpacity>
                  {stores.map((store) => (
                    <TouchableOpacity
                      key={store.id}
                      style={[
                        styles.storeItem,
                        newEmployeeStoreId === store.id && styles.storeItemSelected,
                      ]}
                      onPress={() => setNewEmployeeStoreId(store.id)}
                    >
                      <Text style={styles.storeName}>{store.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {isOwnerOrCO && (
                <>
                  <Text style={styles.inputLabel}>Salary (Optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter salary amount"
                    placeholderTextColor={COLORS.teal + '80'}
                    value={newEmployeeSalary}
                    onChangeText={setNewEmployeeSalary}
                    keyboardType="decimal-pad"
                  />
                </>
              )}
            </ScrollView>

            <PrimaryButton
              title={creatingEmployee ? "Creating..." : "Create Employee"}
              onPress={handleAddEmployee}
              disabled={creatingEmployee}
              style={{ marginTop: SPACING.md }}
            />
            <Text style={styles.defaultPasswordNote}>
              Default password will be: gosta123
            </Text>
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
  addButton: {
    padding: SPACING.xs,
  },
  employeeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: FONT_SIZE.lg,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginBottom: SPACING.xs,
  },
  employeeRole: {
    fontSize: FONT_SIZE.md,
    color: COLORS.teal,
    marginBottom: SPACING.xs,
  },
  employeeEmail: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.teal,
    marginBottom: SPACING.xs,
  },
  assignedStore: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gold,
    fontWeight: '600',
  },
  employeeSalary: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.teal,
    fontWeight: '600',
    marginTop: SPACING.xs,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  assignButton: {
    alignItems: 'center',
    padding: SPACING.sm,
  },
  assignText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.teal,
    marginTop: SPACING.xs,
    fontWeight: '600',
  },
  deleteButton: {
    alignItems: 'center',
    padding: SPACING.sm,
  },
  deleteText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.gold,
    marginTop: SPACING.xs,
    fontWeight: '600',
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
  employeeLabel: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gold,
    fontWeight: '600',
    marginBottom: SPACING.md,
  },
  storeLabel: {
    fontSize: FONT_SIZE.md,
    color: COLORS.teal,
    fontWeight: '600',
    marginBottom: SPACING.sm,
  },
  storeList: {
    maxHeight: 300,
  },
  storeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
  },
  storeItemSelected: {
    backgroundColor: COLORS.gold,
  },
  storeItemContent: {
    flex: 1,
  },
  storeName: {
    fontSize: FONT_SIZE.md,
    color: COLORS.teal,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  storeNameSelected: {
    color: COLORS.teal,
  },
  storeAddress: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.teal,
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.teal,
    textAlign: 'center',
    fontStyle: 'italic',
    padding: SPACING.md,
  },
  loadingStores: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  loadingText: {
    marginLeft: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.teal,
  },
  salaryLabel: {
    fontSize: FONT_SIZE.md,
    color: COLORS.teal,
    fontWeight: '600',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  salaryInput: {
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.teal,
    backgroundColor: COLORS.white,
  },
  deleteModalContent: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.xl,
    width: '85%',
    maxWidth: 400,
  },
  warningIconContainer: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  deleteModalTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: 'bold',
    color: COLORS.teal,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  deleteModalMessage: {
    fontSize: FONT_SIZE.md,
    color: COLORS.teal,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    lineHeight: 22,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.teal,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.teal,
  },
  confirmDeleteButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDeleteButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.teal,
  },
  disabledButton: {
    opacity: 0.5,
  },
  inputLabel: {
    fontSize: FONT_SIZE.md,
    color: COLORS.teal,
    fontWeight: '600',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  textInput: {
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.teal,
    backgroundColor: COLORS.white,
  },
  roleSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  roleChip: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.gold,
    backgroundColor: COLORS.white,
  },
  roleChipSelected: {
    backgroundColor: COLORS.gold,
  },
  roleChipText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.teal,
    fontWeight: '600',
  },
  roleChipTextSelected: {
    color: COLORS.teal,
  },
  storeListSmall: {
    maxHeight: 150,
  },
  defaultPasswordNote: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.teal,
    textAlign: 'center',
    marginTop: SPACING.sm,
    fontStyle: 'italic',
  },
});