import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import HeaderBar from '../../components/HeaderBar';
import Card from '../../components/Card';
import PrimaryButton from '../../components/PrimaryButton';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useApi } from '../../hooks/useApi';
import { COLORS, FONT_SIZE, SPACING } from '../../constants/theme';

// Helper to get today's date string
const getTodayString = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

export default function Reports() {
  const { t } = useTranslation();
  const { execute } = useApi();
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null); // Track which store is exporting

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    const data = await execute(
      () => api.get('/stores'),
      { errorMessage: 'Failed to load stores' }
    );
    
    if (data) {
      setStores(data);
    }
    
    setLoading(false);
  };

  const exportCSV = async (storeId: string, type: 'ingredients' | 'hours', storeName: string) => {
    setExporting(storeId);
    
    const data = await execute(
      () => api.get(`/exports/${type}/${storeId}`, {
        responseType: 'blob', // Get as blob to handle properly
      }),
      { 
        errorMessage: 'Failed to export CSV',
        showError: false, // We'll show custom error below
      }
    );
    
    if (!data) {
      Alert.alert('Error', 'Failed to export CSV');
      setExporting(null);
      return;
    }

    try {
      const csvBlob = data;
      const filename = `${type}_${storeName.replace(/\s+/g, '_')}_${getTodayString()}.csv`;
      
      // Convert blob to base64 using FileReader
      const reader = new FileReader();
      
      reader.onloadend = async () => {
        const base64data = (reader.result as string).split(',')[1]; // Remove data:text/csv;base64, prefix
        const fileUri = FileSystem.documentDirectory + filename;
        
        // Write as base64
        await FileSystem.writeAsStringAsync(fileUri, base64data, {
          encoding: 'base64',
        });

        // Use share sheet
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'text/csv',
            dialogTitle: 'Save CSV File',
            UTI: 'public.comma-separated-values-text'
          });
          
          Alert.alert(
            'CSV Ready!',
            `File: ${filename}\n\nYou can save it to Downloads, share via email, or save to your Files app.`,
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert('Success', `CSV saved: ${filename}`);
        }
        
        setExporting(null);
      };
      
      reader.onerror = () => {
        Alert.alert('Error', 'Failed to process CSV file');
        setExporting(null);
      };
      
      reader.readAsDataURL(csvBlob);
    } catch (error) {
      Alert.alert('Error', 'Failed to process CSV file');
      setExporting(null);
    }
  };

  const exportAllStores = async (type: 'ingredients' | 'hours') => {
    setExporting('all'); // Set exporting all
    try {
      for (const store of stores) {
        await exportCSV(store.id, type, store.name);
      }
      Alert.alert('Success', `All ${type} exported successfully!`);
    } catch (error) {
      Alert.alert('Error', `Failed to export all ${type}`);
    } finally {
      setExporting(null); // Reset exporting state
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
        <Text style={styles.title}>{t('navigation.reports')}</Text>

        <Card title="Export All Data">
          <PrimaryButton
            title="Export All Ingredients"
            onPress={() => exportAllStores('ingredients')}
            loading={exporting !== null}
            style={{ marginBottom: SPACING.md, backgroundColor: COLORS.gold }}
            textStyle={{ color: COLORS.teal }}
          />
          <PrimaryButton
            title="Export All Hours"
            onPress={() => exportAllStores('hours')}
            loading={exporting !== null}
            style={{ backgroundColor: COLORS.gold }}
            textStyle={{ color: COLORS.teal }}
          />
        </Card>

        <Text style={styles.sectionTitle}>Per-Store Exports</Text>

        {stores.map((store) => (
          <Card key={store.id} title={store.name}>
            <PrimaryButton
              title="Export Ingredients"
              onPress={() => exportCSV(store.id, 'ingredients', store.name)}
              loading={exporting !== null}
              style={{ marginBottom: SPACING.md, backgroundColor: COLORS.gold }}
              textStyle={{ color: COLORS.teal }}
            />
            <PrimaryButton
              title="Export Hours"
              onPress={() => exportCSV(store.id, 'hours', store.name)}
              loading={exporting !== null}
              style={{ backgroundColor: COLORS.gold }}
              textStyle={{ color: COLORS.teal }}
            />
          </Card>
        ))}
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
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: 'bold',
    color: COLORS.teal,
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray700,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  earningsHeader: {
    flexDirection: 'row',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    backgroundColor: COLORS.teal,
    borderRadius: 4,
    marginBottom: SPACING.xs,
  },
  headerText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: 'bold',
    color: COLORS.white,
    flex: 1,
    textAlign: 'center',
  },
  earningsRow: {
    flexDirection: 'row',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
    alignItems: 'center',
  },
  earningsRowAlt: {
    backgroundColor: '#F9FAFB',
  },
  nameColumn: {
    flex: 1,
  },
  employeeName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.teal,
  },
  employeeRole: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.gray600,
    marginTop: 2,
  },
  hoursText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray700,
    flex: 1,
    textAlign: 'center',
  },
  earningsText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.gold,
    flex: 1,
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xs,
    marginTop: SPACING.sm,
    backgroundColor: COLORS.gold,
    borderRadius: 4,
  },
  totalLabel: {
    fontSize: FONT_SIZE.lg,
    fontWeight: 'bold',
    color: COLORS.teal,
  },
  totalAmount: {
    fontSize: FONT_SIZE.lg,
    fontWeight: 'bold',
    color: COLORS.teal,
  },
});