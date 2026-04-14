/**
 * RegisterScreen — Two-step registration with email verification.
 *
 * Step 1: Display name, email, password → "Create Account" → sends 4-digit code
 * Step 2: Enter the 4-digit code → "Verify" → account created, user logged in
 *
 * Security:
 * - Password is sent once in step 1, hashed and stored server-side
 * - Step 2 only sends email + code (no password retransmission)
 * - Client enforces 8-char password minimum before submitting
 */

import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { typography, spacing, borderRadius, shadow } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../hooks/useAuth';

const MIN_PASSWORD_LENGTH = 8;

type Step = 'form' | 'verify';

export default function RegisterScreen() {
  const navigation = useNavigation() as any;
  const { colors } = useTheme();
  const { requestRegistration, verifyRegistration } = useAuth();
  const styles = makeStyles(colors);

  // ── Form state ────────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Verification state ────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('form');
  const [codeDigits, setCodeDigits] = useState(['', '', '', '']);
  const [verifyError, setVerifyError] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const codeRefs = useRef<(TextInput | null)[]>([]);

  // ── Step 1: Request registration ──────────────────────────────────────
  const handleCreateAccount = async () => {
    const trimmedName = displayName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password;

    // Client-side validation
    if (!trimmedName || !trimmedEmail || !trimmedPassword) {
      setError('Please fill in all fields.');
      return;
    }

    if (trimmedPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setError('');
    setLoading(true);

    try {
      const result = await requestRegistration(trimmedEmail, trimmedPassword, trimmedName);

      // Dev mode: auto-fill code if SES isn't configured
      if (result.dev_code) {
        setCodeDigits(result.dev_code.split(''));
      } else {
        setCodeDigits(['', '', '', '']);
      }

      setVerifyError('');
      setStep('verify');

      // Focus first code input if no dev code
      if (!result.dev_code) {
        setTimeout(() => codeRefs.current[0]?.focus(), 300);
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (err?.response?.status === 409) {
        setError(detail || 'An account with this email already exists. Try signing in.');
      } else if (err?.response?.status === 429) {
        setError(detail || 'Too many attempts. Please wait before trying again.');
      } else {
        setError(detail || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Code input handlers ───────────────────────────────────────────────
  const handleCodeChange = (index: number, value: string) => {
    const digit = value.replace(/[^0-9]/g, '');

    // Handle paste — fill all boxes
    if (digit.length > 1) {
      const digits = digit.slice(0, 4).split('');
      const newDigits = [...codeDigits];
      digits.forEach((d, i) => {
        if (i + index < 4) newDigits[i + index] = d;
      });
      setCodeDigits(newDigits);
      const nextIndex = Math.min(index + digits.length, 3);
      codeRefs.current[nextIndex]?.focus();
      return;
    }

    const newDigits = [...codeDigits];
    newDigits[index] = digit;
    setCodeDigits(newDigits);
    setVerifyError('');

    if (digit && index < 3) {
      codeRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !codeDigits[index] && index > 0) {
      const newDigits = [...codeDigits];
      newDigits[index - 1] = '';
      setCodeDigits(newDigits);
      codeRefs.current[index - 1]?.focus();
    }
  };

  // ── Step 2: Verify code ───────────────────────────────────────────────
  const handleVerify = async () => {
    const code = codeDigits.join('');
    if (code.length !== 4) {
      setVerifyError('Please enter the full 4-digit code.');
      return;
    }

    setVerifyLoading(true);
    setVerifyError('');

    try {
      await verifyRegistration(email.trim().toLowerCase(), code);
      // On success, AuthContext sets isAuthenticated = true
      // and AppNavigator switches to MainTabs automatically
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setVerifyError(detail || 'Verification failed. Please try again.');
      setCodeDigits(['', '', '', '']);
      setTimeout(() => codeRefs.current[0]?.focus(), 100);
    } finally {
      setVerifyLoading(false);
    }
  };

  // ── Resend code ───────────────────────────────────────────────────────
  const handleResend = async () => {
    setVerifyError('');
    setVerifyLoading(true);

    try {
      const result = await requestRegistration(
        email.trim().toLowerCase(),
        password,
        displayName.trim()
      );
      if (result.dev_code) {
        setCodeDigits(result.dev_code.split(''));
      } else {
        setCodeDigits(['', '', '', '']);
        setTimeout(() => codeRefs.current[0]?.focus(), 200);
      }
      setVerifyError('');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setVerifyError(detail || 'Could not resend code. Please try again.');
    } finally {
      setVerifyLoading(false);
    }
  };

  return (
    <LinearGradient colors={[...colors.gradient.hero]} style={styles.gradient}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>
          <Animated.View entering={FadeInDown.duration(600)} style={styles.brand}>
            <Text style={styles.logo}>✨</Text>
            <Text style={styles.appName}>ReflectXR</Text>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(600).delay(200)}
            style={styles.card}
          >
            <Text style={styles.cardTitle}>Create Account</Text>

            <Input
              label="Display Name"
              value={displayName}
              onChangeText={(t) => { setDisplayName(t); setError(''); }}
              placeholder="What should we call you?"
              autoCapitalize="words"
              containerStyle={styles.inputSpacing}
            />

            <Input
              label="Email"
              value={email}
              onChangeText={(t) => { setEmail(t); setError(''); }}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              containerStyle={styles.inputSpacing}
            />

            <Input
              label="Password"
              value={password}
              onChangeText={(t) => { setPassword(t); setError(''); }}
              placeholder="At least 8 characters"
              secureTextEntry
              containerStyle={styles.inputSpacing}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Button
              title="Create Account"
              onPress={handleCreateAccount}
              loading={loading}
              fullWidth
              style={styles.button}
            />

            <View style={styles.loginRow}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <Pressable onPress={() => navigation.goBack()}>
                <Text style={styles.loginLink}>Sign In</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>

      {/* ── Verification Code Modal ──────────────────────────────────── */}
      <Modal
        visible={step === 'verify'}
        transparent
        animationType="fade"
        onRequestClose={() => setStep('form')}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Verify your email
              </Text>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                We sent a 4-digit code to{'\n'}
                <Text style={{ color: colors.text, fontWeight: '500' as const }}>
                  {email.trim().toLowerCase()}
                </Text>
              </Text>

              {/* 4-digit code boxes */}
              <View style={styles.codeRow}>
                {[0, 1, 2, 3].map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.codeBox,
                      {
                        backgroundColor: colors.surface,
                        borderColor: codeDigits[i]
                          ? colors.primary
                          : colors.border,
                      },
                    ]}
                  >
                    <TextInput
                      ref={(ref) => { codeRefs.current[i] = ref; }}
                      value={codeDigits[i]}
                      onChangeText={(v) => handleCodeChange(i, v)}
                      onKeyPress={({ nativeEvent }) => handleCodeKeyPress(i, nativeEvent.key)}
                      keyboardType="number-pad"
                      maxLength={1}
                      style={[styles.codeInput, { color: colors.text }]}
                      selectTextOnFocus
                    />
                  </View>
                ))}
              </View>

              {verifyError ? (
                <Text style={styles.verifyError}>{verifyError}</Text>
              ) : null}

              {/* Resend link */}
              <Pressable onPress={handleResend} disabled={verifyLoading} style={styles.resendBtn}>
                <Text style={[styles.resendText, { color: colors.textSecondary }]}>
                  Didn't receive it?{' '}
                  <Text style={{ color: colors.primary }}>Resend</Text>
                </Text>
              </Pressable>

              {/* Actions */}
              <View style={styles.modalActions}>
                <Pressable
                  onPress={() => {
                    setStep('form');
                    setCodeDigits(['', '', '', '']);
                    setVerifyError('');
                  }}
                  style={styles.modalCancelBtn}
                >
                  <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>
                    Back
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleVerify}
                  disabled={verifyLoading || codeDigits.join('').length !== 4}
                  style={[
                    styles.modalVerifyBtn,
                    (verifyLoading || codeDigits.join('').length !== 4) && { opacity: 0.6 },
                  ]}
                >
                  {verifyLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.modalVerifyText}>Verify</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </LinearGradient>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  flex: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  brand: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logo: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  appName: {
    ...typography.display,
    color: colors.text,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xxl,
    padding: spacing.lg,
    ...shadow.lg,
  },
  cardTitle: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  inputSpacing: {
    marginBottom: spacing.md,
  },
  error: {
    ...typography.bodySmall,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  button: {
    marginTop: spacing.sm,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  loginText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  loginLink: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.primary,
  },
  // ── Modal styles ──────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalCard: {
    width: '85%',
    borderRadius: borderRadius.xxl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg + spacing.sm,
    paddingBottom: spacing.lg,
    ...shadow.lg,
  },
  modalTitle: {
    ...typography.h3,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  modalSubtitle: {
    ...typography.bodySmall,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: spacing.md,
  },
  codeBox: {
    width: 56,
    height: 60,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeInput: {
    fontSize: 24,
    fontWeight: '700' as const,
    textAlign: 'center',
    width: '100%',
    height: '100%',
  },
  verifyError: {
    ...typography.caption,
    color: '#D94848',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  resendBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  resendText: {
    ...typography.caption,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.md,
  },
  modalCancelBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  modalCancelText: {
    ...typography.body,
    fontWeight: '500' as const,
  },
  modalVerifyBtn: {
    backgroundColor: '#6C63FF',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    minWidth: 100,
    alignItems: 'center',
  },
  modalVerifyText: {
    ...typography.body,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
});
