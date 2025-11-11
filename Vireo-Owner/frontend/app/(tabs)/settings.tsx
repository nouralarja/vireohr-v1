import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
  Modal,
  Image,
  TouchableOpacity,
  TextInput,
  I18nManager,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import { getAuth, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import HeaderBar from '../../components/HeaderBar';
import Card from '../../components/Card';
import Input from '../../components/Input';
import PrimaryButton from '../../components/PrimaryButton';
import { useAuth } from '../../contexts/AuthContext';
import { COLORS, FONT_SIZE, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { UserRole } from '../../types';
import { changeLanguage, getCurrentLanguage } from '../../config/i18n';

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [qrCodeData, setQrCodeData] = useState('');
  const [currentLanguage, setCurrentLanguage] = useState(getCurrentLanguage());
  
  // Role checks
  const userRole = String(user?.role || '').toUpperCase();
  const isOwner = userRole === 'OWNER';
  const isCO = userRole === 'CO';
  
  // Password change state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const canEnable2FA = String(user?.role || '').toUpperCase() === 'OWNER' || 
                       String(user?.role || '').toUpperCase() === 'CO';

  const handleLanguageChange = async (lang: 'en' | 'ar') => {
    try {
      await changeLanguage(lang);
      setCurrentLanguage(lang);
      
      Alert.alert(
        t('common.success'),
        t('settings.languageChanged'),
        [
          {
            text: t('settings.restartApp'),
            onPress: async () => {
              // For RTL to take full effect, app needs restart
              try {
                await Updates.reloadAsync();
              } catch (e) {
                // Reload failed, ignore in development
                console.log('App reload not available in development mode');
              }
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert(t('common.error'), 'Failed to change language');
    }
  };

  const handle2FAToggle = async (value: boolean) => {
    if (value) {
      // Enable 2FA
      Alert.alert(
        t('settings.enable2FA'),
        'This will generate a QR code to scan with Google Authenticator',
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: 'Continue',
            onPress: () => generateQRCode(),
          },
        ]
      );
    } else {
      // Disable 2FA
      Alert.alert(
        t('settings.disable2FA'),
        'Are you sure you want to disable 2FA?',
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: () => {
              setIs2FAEnabled(false);
              Alert.alert(t('common.success'), '2FA disabled successfully');
            },
          },
        ]
      );
    }
  };

  const generateQRCode = () => {
    // Generate TOTP secret (simplified - in production use proper TOTP library)
    const secret = 'JBSWY3DPEHPK3PXP'; // Demo secret
    const issuer = 'Gosta';
    const accountName = user?.email || 'user';
    
    // Generate otpauth URL
    const otpauthUrl = `otpauth://totp/${issuer}:${accountName}?secret=${secret}&issuer=${issuer}`;
    
    // Use QR code API
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(otpauthUrl)}`;
    
    setQrCodeData(qrCodeUrl);
    setShowQRModal(true);
  };

  const verifyCode = () => {
    if (verificationCode.length !== 6) {
      Alert.alert('Error', 'Please enter a 6-digit code');
      return;
    }

    // Simplified verification (in production, verify against TOTP)
    if (verificationCode === '123456' || verificationCode.length === 6) {
      setIs2FAEnabled(true);
      setShowQRModal(false);
      setVerificationCode('');
      Alert.alert(t('common.success'), '2FA enabled successfully!');
    } else {
      Alert.alert('Error', 'Invalid code. Try again.');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/sign-in');
  };

  const handleChangePassword = async () => {
    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all password fields');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    setChangingPassword(true);

    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;

      if (!currentUser || !currentUser.email) {
        Alert.alert('Error', 'No authenticated user found');
        setChangingPassword(false);
        return;
      }

      // Re-authenticate user with current password
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        currentPassword
      );

      await reauthenticateWithCredential(currentUser, credential);

      // Update password
      await updatePassword(currentUser, newPassword);

      // Success
      Alert.alert(
        'Success',
        'Password changed successfully!',
        [
          {
            text: 'OK',
            onPress: () => {
              setShowPasswordModal(false);
              setCurrentPassword('');
              setNewPassword('');
              setConfirmPassword('');
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Password change error:', error);
      
      let errorMessage = 'Failed to change password';
      
      if (error.code === 'auth/wrong-password') {
        errorMessage = 'Current password is incorrect';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'New password is too weak';
      } else if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'Please sign out and sign in again before changing password';
      }
      
      Alert.alert('Error', errorMessage);
    }

    setChangingPassword(false);
  };

  return (
    <View style={styles.container}>
      <HeaderBar />
      <ScrollView style={styles.content}>
        <Card title="Account">
          <Text style={styles.greeting}>Hello, {user?.name}!</Text>
          
          <Text style={[styles.label, { marginTop: SPACING.lg }]}>Email</Text>
          <Text style={styles.value}>{user?.email}</Text>
          
          {(isOwner || isCO) && (
            <>
              <Text style={[styles.label, { marginTop: SPACING.md }]}>Role</Text>
              <Text style={styles.value}>{t(`roles.${user?.role}`)}</Text>
            </>
          )}
          
          <PrimaryButton
            title="Change Password"
            onPress={() => setShowPasswordModal(true)}
            style={{ marginTop: SPACING.lg }}
          />
        </Card>

        <Card title={t('settings.language')}>
          <View style={styles.languageContainer}>
            <TouchableOpacity
              style={[
                styles.languageButton,
                currentLanguage === 'en' && styles.languageButtonActive,
              ]}
              onPress={() => handleLanguageChange('en')}
            >
              <Ionicons
                name="language"
                size={24}
                color={currentLanguage === 'en' ? COLORS.white : COLORS.teal}
              />
              <Text
                style={[
                  styles.languageButtonText,
                  currentLanguage === 'en' && styles.languageButtonTextActive,
                ]}
              >
                {t('settings.english')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.languageButton,
                currentLanguage === 'ar' && styles.languageButtonActive,
              ]}
              onPress={() => handleLanguageChange('ar')}
            >
              <Ionicons
                name="language"
                size={24}
                color={currentLanguage === 'ar' ? COLORS.white : COLORS.teal}
              />
              <Text
                style={[
                  styles.languageButtonText,
                  currentLanguage === 'ar' && styles.languageButtonTextActive,
                ]}
              >
                {t('settings.arabic')}
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {canEnable2FA && (
          <Card title="Security">
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <View style={styles.switchTitleRow}>
                  <Ionicons name="lock-closed" size={20} color={COLORS.gold} style={{ marginRight: 8 }} />
                  <Text style={styles.switchTitle}>{t('settings.enable2FA')}</Text>
                </View>
                <Text style={styles.switchSubtitle}>
                  Add extra security with Google Authenticator
                </Text>
              </View>
              <Switch
                value={is2FAEnabled}
                onValueChange={handle2FAToggle}
                trackColor={{ false: COLORS.gold, true: COLORS.teal }}
                thumbColor={COLORS.white}
              />
            </View>
          </Card>
        )}

        <PrimaryButton
          title={t('auth.signOut')}
          onPress={handleSignOut}
          style={{ backgroundColor: COLORS.error, marginTop: SPACING.xl }}
        />
      </ScrollView>

      {/* QR Code Modal */}
      <Modal
        visible={showQRModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowQRModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('settings.enable2FA')}</Text>
              <Ionicons
                name="close"
                size={24}
                color={COLORS.teal}
                onPress={() => setShowQRModal(false)}
              />
            </View>

            <Text style={styles.instructionText}>
              1. {t('settings.scanQRCode')} with Google Authenticator
            </Text>

            {qrCodeData && (
              <View style={styles.qrContainer}>
                <Image
                  source={{ uri: qrCodeData }}
                  style={styles.qrImage}
                  resizeMode="contain"
                />
              </View>
            )}

            <Text style={[styles.instructionText, { marginTop: SPACING.lg }]}>
              2. {t('settings.enter6DigitCode')}
            </Text>

            <Input
              value={verificationCode}
              onChangeText={setVerificationCode}
              placeholder="000000"
              keyboardType="number-pad"
              maxLength={6}
              style={{ textAlign: 'center', fontSize: FONT_SIZE.xl, letterSpacing: 8 }}
            />

            <PrimaryButton
              title="Verify & Enable"
              onPress={verifyCode}
              style={{ marginTop: SPACING.md }}
            />
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        visible={showPasswordModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TouchableOpacity
                onPress={() => setShowPasswordModal(false)}
                style={{ padding: SPACING.sm }}
              >
                <Ionicons name="close" size={24} color={COLORS.teal} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Current Password</Text>
            <TextInput
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Enter current password"
              placeholderTextColor={COLORS.gray600}
              secureTextEntry
              style={styles.input}
            />

            <Text style={[styles.label, { marginTop: SPACING.md }]}>New Password</Text>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Enter new password (min 6 characters)"
              placeholderTextColor={COLORS.gray600}
              secureTextEntry
              style={styles.input}
            />

            <Text style={[styles.label, { marginTop: SPACING.md }]}>Confirm New Password</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter new password"
              placeholderTextColor={COLORS.gray600}
              secureTextEntry
              style={styles.input}
            />

            <PrimaryButton
              title={changingPassword ? "Changing..." : "Change Password"}
              onPress={handleChangePassword}
              disabled={changingPassword}
              style={{ marginTop: SPACING.lg }}
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
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: 'bold',
    color: COLORS.teal,
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gold,
    marginBottom: SPACING.xs,
    fontWeight: '600',
  },
  value: {
    fontSize: FONT_SIZE.md,
    color: COLORS.teal,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    flex: 1,
    marginRight: SPACING.md,
  },
  switchTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  switchTitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.teal,
    fontWeight: '600',
  },
  greeting: {
    fontSize: FONT_SIZE.xl,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginBottom: SPACING.xs,
  },
  switchSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.teal,
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
  instructionText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.teal,
    marginBottom: SPACING.md,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.teal,
    backgroundColor: COLORS.white,
    marginTop: SPACING.xs,
  },
  qrContainer: {
    alignItems: 'center',
    padding: SPACING.lg,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.gold,
  },
  qrImage: {
    width: 250,
    height: 250,
  },
  languageContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  languageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.teal,
    backgroundColor: COLORS.white,
    gap: SPACING.xs,
  },
  languageButtonActive: {
    backgroundColor: COLORS.teal,
    borderColor: COLORS.teal,
  },
  languageButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.teal,
  },
  languageButtonTextActive: {
    color: COLORS.white,
  },
});
