/**
 * ProfileScreen — Redesigned.
 *
 * - Title: user's display name
 * - Tappable avatar: upload profile picture or show initials with edit badge
 * - Tappable email: two-step verification (enter new email → enter 4-digit code)
 * - Notifications: opens native app settings
 * - Activity grid, single settings surface, quiet logout
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Alert,
  Linking,
  Platform,
  Image,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import SafeAreaWrapper from '../../components/ui/SafeAreaWrapper';
import Surface from '../../components/ui/Surface';
import ActivityGrid from '../../components/profile/ActivityGrid';
import StreakBadge from '../../components/profile/StreakBadge';
import StreakModal from '../../components/profile/StreakModal';
import { typography, spacing, borderRadius } from '../../theme';
import { enterConfig } from '../../theme/motion';
import { haptic } from '../../theme/motion';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../hooks/useAuth';
import * as journalService from '../../services/journalService';
import type { StreakData } from '../../services/journalService';

function openAppSettings() {
  if (Platform.OS === 'ios') {
    Linking.openURL('app-settings:');
  } else {
    Linking.openSettings();
  }
}

function ProfileRow({
  icon,
  label,
  value,
  onPress,
  surfaces,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  surfaces: any;
}) {
  return (
    <Pressable
      onPress={() => {
        if (onPress) {
          haptic.selection();
          onPress();
        }
      }}
      style={rowStyles.row}
      disabled={!onPress}
    >
      <View style={[rowStyles.rowIcon, { backgroundColor: surfaces.overlay.primaryTint }]}>
        <Ionicons name={icon} size={20} color="#6C63FF" />
      </View>
      <View style={rowStyles.rowContent}>
        <Text style={[rowStyles.rowLabel, { color: surfaces.text.primary }]}>{label}</Text>
        {value && (
          <Text style={[rowStyles.rowValue, { color: surfaces.text.secondary }]}>{value}</Text>
        )}
      </View>
      {onPress && (
        <Ionicons name="chevron-forward" size={18} color={surfaces.text.tertiary} />
      )}
    </Pressable>
  );
}

// ── Email change step type ──────────────────────────────────────────────
type EmailStep = 'enter-email' | 'enter-code';

export default function ProfileScreen() {
  const { user, logout, uploadProfileImage, requestEmailChange, verifyEmailChange } = useAuth();
  const { surfaces } = useTheme();
  const styles = makeStyles(surfaces);

  const [reflectionCount, setReflectionCount] = useState(0);
  const [conversationCount, setConversationCount] = useState(0);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [streakModalVisible, setStreakModalVisible] = useState(false);

  // Email change modal state
  const [emailModalVisible, setEmailModalVisible] = useState(false);
  const [emailStep, setEmailStep] = useState<EmailStep>('enter-email');
  const [newEmail, setNewEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isEmailLoading, setIsEmailLoading] = useState(false);

  // 4-digit code input
  const [codeDigits, setCodeDigits] = useState(['', '', '', '']);
  const codeRefs = useRef<(TextInput | null)[]>([]);

  React.useEffect(() => {
    journalService
      .getActivityStats()
      .then((stats) => {
        setReflectionCount(stats.reflections);
        setConversationCount(stats.conversations);
      })
      .catch(() => {});
    journalService
      .getStreak()
      .then(setStreakData)
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    haptic.light();
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  // ── Avatar tap → image picker ─────────────────────────────────────────
  const handleAvatarPress = useCallback(async () => {
    haptic.selection();

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Needed',
        'Please allow access to your photo library to set a profile picture.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: openAppSettings },
        ]
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;

    setIsUploadingImage(true);
    try {
      await uploadProfileImage(result.assets[0].uri);
      haptic.medium();
    } catch {
      Alert.alert('Upload Failed', 'Could not upload your photo. Please try again.');
    } finally {
      setIsUploadingImage(false);
    }
  }, [uploadProfileImage]);

  // ── Email change flow ─────────────────────────────────────────────────
  const openEmailModal = () => {
    haptic.selection();
    setNewEmail('');
    setEmailError('');
    setEmailStep('enter-email');
    setCodeDigits(['', '', '', '']);
    setEmailModalVisible(true);
  };

  const closeEmailModal = () => {
    setEmailModalVisible(false);
    setEmailError('');
  };

  // Step 1: Send code
  const handleSendCode = async () => {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    if (trimmed === user?.email) {
      setEmailError('This is already your current email.');
      return;
    }

    setIsEmailLoading(true);
    setEmailError('');
    try {
      const result = await requestEmailChange(trimmed);
      haptic.medium();
      setNewEmail(trimmed);
      setEmailStep('enter-code');

      // In dev mode, auto-fill the code if SES isn't configured
      if (result.dev_code) {
        const digits = result.dev_code.split('');
        setCodeDigits(digits);
      } else {
        setCodeDigits(['', '', '', '']);
        setTimeout(() => codeRefs.current[0]?.focus(), 200);
      }
    } catch (err: any) {
      setEmailError(err?.response?.data?.detail || 'Could not send code. Please try again.');
    } finally {
      setIsEmailLoading(false);
    }
  };

  // Handle code digit input
  const handleCodeChange = (index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/[^0-9]/g, '');
    if (digit.length > 1) {
      // Handle paste — fill all boxes
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
    setEmailError('');

    // Auto-advance to next box
    if (digit && index < 3) {
      codeRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyPress = (index: number, key: string) => {
    // Backspace on empty box → go back
    if (key === 'Backspace' && !codeDigits[index] && index > 0) {
      const newDigits = [...codeDigits];
      newDigits[index - 1] = '';
      setCodeDigits(newDigits);
      codeRefs.current[index - 1]?.focus();
    }
  };

  // Step 2: Verify code
  const handleVerifyCode = async () => {
    const code = codeDigits.join('');
    if (code.length !== 4) {
      setEmailError('Please enter the full 4-digit code.');
      return;
    }

    setIsEmailLoading(true);
    setEmailError('');
    try {
      await verifyEmailChange(newEmail, code);
      haptic.medium();
      closeEmailModal();
    } catch (err: any) {
      setEmailError(err?.response?.data?.detail || 'Verification failed. Please try again.');
      setCodeDigits(['', '', '', '']);
      setTimeout(() => codeRefs.current[0]?.focus(), 100);
    } finally {
      setIsEmailLoading(false);
    }
  };

  const displayName = user?.display_name || 'User';
  const hasProfileImage = !!user?.profile_image_url;

  return (
    <SafeAreaWrapper>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Title — user's name + streak badge */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>{displayName}</Text>
          {streakData && (
            <StreakBadge
              streak={streakData.current_streak}
              onPress={() => setStreakModalVisible(true)}
            />
          )}
        </View>

        {/* Avatar + Email + Stats */}
        <Animated.View entering={FadeInUp.duration(enterConfig.content.duration)}>
          <View style={styles.avatarSection}>
            {/* Tappable Avatar */}
            <Pressable onPress={handleAvatarPress} style={styles.avatarWrapper}>
              <View style={styles.avatar}>
                {isUploadingImage ? (
                  <ActivityIndicator size="small" color="#6C63FF" />
                ) : hasProfileImage ? (
                  <Image
                    source={{ uri: user!.profile_image_url }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <Text style={styles.avatarText}>
                    {displayName.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              {/* Edit badge */}
              <View style={[styles.editBadge, { backgroundColor: surfaces.colors.ground }]}>
                <Ionicons name="camera" size={14} color="#6C63FF" />
              </View>
            </Pressable>

            {/* Tappable Email */}
            <Pressable onPress={openEmailModal} style={styles.emailRow}>
              <Text style={styles.email}>{user?.email || ''}</Text>
              <Ionicons
                name="pencil"
                size={13}
                color={surfaces.text.tertiary}
                style={styles.emailEditIcon}
              />
            </Pressable>

            <Text style={styles.stats}>
              {reflectionCount} {reflectionCount === 1 ? 'reflection' : 'reflections'} · {conversationCount} {conversationCount === 1 ? 'conversation' : 'conversations'}
            </Text>
          </View>
        </Animated.View>

        {/* Activity Grid */}
        <Animated.View entering={FadeInUp.duration(enterConfig.content.duration).delay(60)}>
          <View style={styles.activitySection}>
            <ActivityGrid />
          </View>
        </Animated.View>

        {/* Settings — single surface */}
        <Animated.View entering={FadeInUp.duration(enterConfig.content.duration).delay(120)}>
          <Surface role="ground" radius="xl" style={styles.section}>
            <ProfileRow
              icon="notifications-outline"
              label="Notifications"
              value="Manage in Settings"
              onPress={openAppSettings}
              surfaces={surfaces}
            />
            <View style={styles.divider} />
            <ProfileRow
              icon="shield-checkmark-outline"
              label="Privacy"
              surfaces={surfaces}
            />
            <View style={styles.divider} />
            <ProfileRow
              icon="information-circle-outline"
              label="About ReflectXR"
              value="v1.0.0"
              surfaces={surfaces}
            />
          </Surface>
        </Animated.View>

        {/* Logout */}
        <Animated.View entering={FadeInUp.duration(enterConfig.content.duration).delay(180)}>
          <Pressable onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Sign out</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>

      {/* ── Email Change Modal (two-step) ─────────────────────────────── */}
      <Modal
        visible={emailModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeEmailModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.modalOverlay} onPress={closeEmailModal}>
            <Pressable
              style={[styles.modalCard, { backgroundColor: surfaces.colors.raised }]}
              onPress={() => {}}
            >
              {emailStep === 'enter-email' ? (
                /* ── Step 1: Enter new email ─────────────────────────── */
                <>
                  <Text style={[styles.modalTitle, { color: surfaces.text.primary }]}>
                    Change Email
                  </Text>
                  <Text style={[styles.modalSubtitle, { color: surfaces.text.secondary }]}>
                    We'll send a verification code to your new email
                  </Text>

                  <View
                    style={[
                      styles.modalInput,
                      {
                        backgroundColor: surfaces.colors.input,
                        borderColor: emailError
                          ? '#D94848'
                          : surfaces.edge('input').borderColor || 'transparent',
                      },
                    ]}
                  >
                    <TextInput
                      value={newEmail}
                      onChangeText={(t) => {
                        setNewEmail(t);
                        if (emailError) setEmailError('');
                      }}
                      placeholder="new@email.com"
                      placeholderTextColor={surfaces.text.tertiary}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoFocus
                      style={[styles.modalInputText, { color: surfaces.text.primary }]}
                    />
                  </View>

                  {emailError ? (
                    <Text style={styles.modalError}>{emailError}</Text>
                  ) : null}

                  <View style={styles.modalActions}>
                    <Pressable onPress={closeEmailModal} style={styles.modalCancelBtn}>
                      <Text style={[styles.modalCancelText, { color: surfaces.text.secondary }]}>
                        Cancel
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={handleSendCode}
                      disabled={isEmailLoading}
                      style={[styles.modalSaveBtn, isEmailLoading && { opacity: 0.6 }]}
                    >
                      {isEmailLoading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.modalSaveText}>Send Code</Text>
                      )}
                    </Pressable>
                  </View>
                </>
              ) : (
                /* ── Step 2: Enter 4-digit code ──────────────────────── */
                <>
                  <Text style={[styles.modalTitle, { color: surfaces.text.primary }]}>
                    Enter Code
                  </Text>
                  <Text style={[styles.modalSubtitle, { color: surfaces.text.secondary }]}>
                    We sent a 4-digit code to{'\n'}
                    <Text style={{ color: surfaces.text.primary, fontWeight: '500' as const }}>
                      {newEmail}
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
                            backgroundColor: surfaces.colors.input,
                            borderColor: codeDigits[i]
                              ? '#6C63FF'
                              : surfaces.edge('input').borderColor || 'transparent',
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
                          style={[styles.codeInput, { color: surfaces.text.primary }]}
                          selectTextOnFocus
                        />
                      </View>
                    ))}
                  </View>

                  {emailError ? (
                    <Text style={styles.modalError}>{emailError}</Text>
                  ) : null}

                  {/* Resend link */}
                  <Pressable
                    onPress={() => {
                      setEmailStep('enter-email');
                      setEmailError('');
                      setCodeDigits(['', '', '', '']);
                    }}
                    style={styles.resendBtn}
                  >
                    <Text style={[styles.resendText, { color: surfaces.text.tertiary }]}>
                      Didn't receive it? <Text style={{ color: '#6C63FF' }}>Resend</Text>
                    </Text>
                  </Pressable>

                  <View style={styles.modalActions}>
                    <Pressable onPress={closeEmailModal} style={styles.modalCancelBtn}>
                      <Text style={[styles.modalCancelText, { color: surfaces.text.secondary }]}>
                        Cancel
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={handleVerifyCode}
                      disabled={isEmailLoading || codeDigits.join('').length !== 4}
                      style={[
                        styles.modalSaveBtn,
                        (isEmailLoading || codeDigits.join('').length !== 4) && { opacity: 0.6 },
                      ]}
                    >
                      {isEmailLoading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.modalSaveText}>Verify</Text>
                      )}
                    </Pressable>
                  </View>
                </>
              )}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <StreakModal
        visible={streakModalVisible}
        onClose={() => setStreakModalVisible(false)}
        streakData={streakData}
      />
    </SafeAreaWrapper>
  );
}

const makeStyles = (surfaces: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: 120,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.lg,
    },
    title: {
      ...typography.h2,
      color: surfaces.text.primary,
    },
    avatarSection: {
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    avatarWrapper: {
      marginBottom: spacing.md,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: surfaces.overlay.primaryTint,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImage: {
      width: 80,
      height: 80,
      borderRadius: 40,
    },
    avatarText: {
      fontSize: 30,
      fontWeight: '600' as const,
      color: '#6C63FF',
    },
    editBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: surfaces.colors.canvas,
    },
    emailRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    email: {
      ...typography.bodySmall,
      color: surfaces.text.secondary,
    },
    emailEditIcon: {
      marginLeft: 6,
    },
    stats: {
      ...typography.caption,
      color: surfaces.text.tertiary,
      marginTop: spacing.xs,
    },
    activitySection: {
      marginBottom: spacing.xl,
    },
    section: {
      paddingVertical: spacing.sm,
      paddingHorizontal: 0,
      marginBottom: spacing.xl,
    },
    divider: {
      height: 1,
      backgroundColor: surfaces.edge('input').borderColor || 'transparent',
      marginLeft: spacing.lg + 36 + spacing.md,
    },
    logoutButton: {
      alignItems: 'center',
      paddingVertical: spacing.md,
      marginTop: spacing.md,
    },
    logoutText: {
      ...typography.bodySmall,
      fontWeight: '500' as const,
      color: surfaces.text.tertiary,
    },
    // ── Modal styles ────────────────────────────────────────────────────
    modalOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalCard: {
      width: '85%',
      borderRadius: borderRadius.xl,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg + spacing.sm,
      paddingBottom: spacing.lg,
    },
    modalTitle: {
      ...typography.h3,
      marginBottom: spacing.xs,
    },
    modalSubtitle: {
      ...typography.bodySmall,
      lineHeight: 20,
      marginBottom: spacing.lg,
    },
    modalInput: {
      borderWidth: 1,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: Platform.OS === 'ios' ? 14 : 10,
      marginBottom: spacing.xs,
    },
    modalInputText: {
      ...typography.body,
    },
    modalError: {
      ...typography.caption,
      color: '#D94848',
      marginTop: spacing.xs,
      marginBottom: spacing.sm,
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      marginTop: spacing.lg,
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
    modalSaveBtn: {
      backgroundColor: '#6C63FF',
      borderRadius: borderRadius.md,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.lg,
      minWidth: 100,
      alignItems: 'center',
    },
    modalSaveText: {
      ...typography.body,
      fontWeight: '600' as const,
      color: '#FFFFFF',
    },
    // ── Code input styles ───────────────────────────────────────────────
    codeRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 12,
      marginBottom: spacing.sm,
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
    resendBtn: {
      alignItems: 'center',
      paddingVertical: spacing.sm,
    },
    resendText: {
      ...typography.caption,
    },
  });

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  rowContent: {
    flex: 1,
  },
  rowLabel: {
    ...typography.body,
  },
  rowValue: {
    ...typography.caption,
    marginTop: 2,
  },
});
