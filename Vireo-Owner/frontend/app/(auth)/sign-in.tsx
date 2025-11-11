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
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../config/firebase';
import PrimaryButton from '../../components/PrimaryButton';
import Input from '../../components/Input';
import { COLORS, FONT_SIZE, SPACING } from '../../constants/theme';

export default function SignIn() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert(t('common.error'), 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace('/(tabs)/home');
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message);
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
            <Text style={styles.title}>Gosta</Text>
            <Text style={styles.subtitle}>{t('auth.signIn')}</Text>
            <Text style={styles.description}>
              Enter your credentials to sign in
            </Text>
          </View>

          <View style={styles.form}>
            <Input
              label={t('auth.email')}
              value={email}
              onChangeText={setEmail}
              placeholder={t('auth.email')}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter password"
              secureTextEntry
            />

            <PrimaryButton
              title={t('auth.signIn')}
              onPress={handleSignIn}
              loading={loading}
              style={{ marginTop: SPACING.lg }}
            />

            <TouchableOpacity
              style={styles.signUpLink}
              onPress={() => router.push('/(auth)/signup')}
            >
              <Text style={styles.signUpText}>
                Don't have an account? <Text style={styles.signUpTextBold}>Sign Up</Text>
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
  signUpLink: {
    marginTop: SPACING.xl,
    alignItems: 'center',
  },
  signUpText: {
    fontSize: FONT_SIZE.md,
    color: '#666',
  },
  signUpTextBold: {
    fontWeight: 'bold',
    color: COLORS.teal,
  },
});
