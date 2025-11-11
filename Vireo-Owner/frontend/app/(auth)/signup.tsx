import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StatusBar } from 'expo-status-bar';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '../../config/firebase';
import axios from 'axios';
import PrimaryButton from '../../components/PrimaryButton';
import Input from '../../components/Input';
import { COLORS, FONT_SIZE, SPACING } from '../../constants/theme';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function SignUp() {
  const { t } = useTranslation();
  const router = useRouter();
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    // Validation
    if (!businessName || !ownerName || !email || !password || !confirmPassword) {
      Alert.alert(t('common.error'), 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(t('common.error'), 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert(t('common.error'), 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      // Call custom token endpoint to create tenant and owner
      const response = await axios.post(
        `${API_URL}/api/auth/custom-token`,
        null,
        {
          params: {
            business_name: businessName,
            owner_name: ownerName,
            owner_email: email,
            password: password,
          },
        }
      );

      const { customToken } = response.data;

      // Sign in with custom token
      await signInWithCustomToken(auth, customToken);

      // Navigate to home
      router.replace('/(tabs)/home');
      
      Alert.alert(
        'Welcome to VireoHR!',
        `Your business "${businessName}" has been created successfully.`
      );
    } catch (error: any) {
      console.error('Sign up error:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to create account';
      Alert.alert(t('common.error'), errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>VireoHR</Text>
            <Text style={styles.subtitle}>Create Your Business Account</Text>
            <Text style={styles.description}>
              Start managing your team today
            </Text>
          </View>

          <View style={styles.form}>
            <Input
              label="Business Name"
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="Enter your business name"
              autoCapitalize="words"
            />

            <Input
              label="Your Name"
              value={ownerName}
              onChangeText={setOwnerName}
              placeholder="Enter your name"
              autoCapitalize="words"
            />

            <Input
              label={t('auth.email')}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 6 characters"
              secureTextEntry
            />

            <Input
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter password"
              secureTextEntry
            />

            <PrimaryButton
              title="Create Account"
              onPress={handleSignUp}
              loading={loading}
              style={{ marginTop: SPACING.lg }}
            />

            <TouchableOpacity
              style={styles.signInLink}
              onPress={() => router.replace('/(auth)/sign-in')}
            >
              <Text style={styles.signInText}>
                Already have an account? <Text style={styles.signInTextBold}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: COLORS.teal,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONT_SIZE.xl,
    color: COLORS.gold,
    fontWeight: '600',
  },
  description: {
    fontSize: FONT_SIZE.md,
    color: COLORS.teal,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
  form: {
    width: '100%',
  },
  signInLink: {
    marginTop: SPACING.xl,
    alignItems: 'center',
  },
  signInText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray700,
  },
  signInTextBold: {
    fontWeight: 'bold',
    color: COLORS.teal,
  },
});
