/**
 * ProfileScreen — Redesigned.
 *
 * - Title: user's display name
 * - Avatar: read-only portrait. Upload / remove both live behind the pencil
 *   next to the name (Edit Profile modal) — there is no longer a tap target
 *   on the avatar itself.
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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
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

// ── Edit modal step type ────────────────────────────────────────────────
// 'profile'    = unified name + email + remove-photo surface with single Save
// 'enter-code' = 4-digit email verification, launched after Save if email changed
type ModalStep = 'profile' | 'enter-code';

export default function ProfileScreen() {
  const navigation = useNavigation() as any;
  const {
    user,
    logout,
    uploadProfileImage,
    deleteProfileImage,
    updateUser,
    requestEmailChange,
    verifyEmailChange,
  } = useAuth();
  const { surfaces } = useTheme();
  const styles = makeStyles(surfaces);

  const [reflectionCount, setReflectionCount] = useState(0);
  const [conversationCount, setConversationCount] = useState(0);
  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [streakModalVisible, setStreakModalVisible] = useState(false);

  // Edit Profile modal state (unified: name + email + remove photo)
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [modalStep, setModalStep] = useState<ModalStep>('profile');
  const [editedName, setEditedName] = useState('');
  const [editedEmail, setEditedEmail] = useState('');
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isRemovingPhoto, setIsRemovingPhoto] = useState(false);
  // Pending email stays in state so the enter-code step can re-submit verification
  const [pendingEmail, setPendingEmail] = useState('');
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  // Staged photo URI picked inside the sheet — committed on Save, not immediately
  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | null>(null);

  // 4-digit code input
  const [codeDigits, setCodeDigits] = useState(['', '', '', '']);
  const codeRefs = useRef<(TextInput | null)[]>([]);

  useFocusEffect(
    useCallback(() => {
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
    }, [])
  );

  const handleLogout = () => {
    haptic.light();
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  // ── Unified Edit Profile flow ─────────────────────────────────────────
  const openEditModal = () => {
    haptic.selection();
    setModalStep('profile');
    setEditedName(user?.display_name || '');
    setEditedEmail(user?.email || '');
    setNameError('');
    setEmailError('');
    setPendingEmail('');
    setPendingPhotoUri(null);
    setCodeDigits(['', '', '', '']);
    setEditModalVisible(true);
  };

  const closeEditModal = () => {
    setEditModalVisible(false);
    setNameError('');
    setEmailError('');
    setPendingPhotoUri(null);
  };

  // Pick a photo from within the sheet — STAGE the URI; commit happens on Save.
  // This mirrors name/email edits: nothing leaves the device until Save is tapped.
  const handlePickPhotoInModal = useCallback(async () => {
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
    setPendingPhotoUri(result.assets[0].uri);
  }, []);

  // Single Save — commits name if changed, then launches code popup if email changed
  const handleSaveProfile = async () => {
    const trimmedName = editedName.trim();
    const trimmedEmail = editedEmail.trim().toLowerCase();

    const nameChanged = !!trimmedName && trimmedName !== user?.display_name;
    const emailChanged = !!trimmedEmail && trimmedEmail !== user?.email;
    const photoChanged = !!pendingPhotoUri;

    if (!nameChanged && !emailChanged && !photoChanged) {
      closeEditModal();
      return;
    }
    if (!trimmedName) {
      setNameError('Name cannot be empty.');
      return;
    }
    if (emailChanged && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError('Please enter a valid email address.');
      return;
    }

    setIsSavingProfile(true);
    setNameError('');
    setEmailError('');

    try {
      if (photoChanged && pendingPhotoUri) {
        await uploadProfileImage(pendingPhotoUri);
        setPendingPhotoUri(null);
      }

      if (nameChanged) {
        await updateUser({ display_name: trimmedName });
      }

      if (emailChanged) {
        const result = await requestEmailChange(trimmedEmail);
        setPendingEmail(trimmedEmail);
        setModalStep('enter-code');

        // In dev mode (no SES configured), auto-fill the code
        if (result.dev_code) {
          setCodeDigits(result.dev_code.split(''));
        } else {
          setCodeDigits(['', '', '', '']);
          setTimeout(() => codeRefs.current[0]?.focus(), 200);
        }
      } else {
        closeEditModal();
      }

      haptic.medium();
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Could not save. Please try again.';
      // Attribute the error to whichever field triggered the server call
      if (emailChanged) {
        setEmailError(detail);
      } else {
        setNameError(detail);
      }
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Remove profile photo (confirm → delete → stay on profile step)
  const handleRemovePhoto = () => {
    haptic.selection();
    Alert.alert(
      'Remove Profile Photo',
      'Your photo will be removed. You can always upload a new one.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setIsRemovingPhoto(true);
            try {
              await deleteProfileImage();
              haptic.medium();
            } catch {
              Alert.alert('Remove Failed', 'Could not remove your photo. Please try again.');
            } finally {
              setIsRemovingPhoto(false);
            }
          },
        },
      ]
    );
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

    setIsVerifyingCode(true);
    setEmailError('');
    try {
      await verifyEmailChange(pendingEmail, code);
      haptic.medium();
      closeEditModal();
    } catch (err: any) {
      setEmailError(err?.response?.data?.detail || 'Verification failed. Please try again.');
      setCodeDigits(['', '', '', '']);
      setTimeout(() => codeRefs.current[0]?.focus(), 100);
    } finally {
      setIsVerifyingCode(false);
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
        {/* Top row — streak badge only (name moves under the avatar) */}
        <View style={styles.titleRow}>
          {streakData && (
            <StreakBadge
              streak={streakData.current_streak}
              isTodayActive={streakData.is_today_active}
              onPress={() => setStreakModalVisible(true)}
            />
          )}
        </View>

        {/* Avatar + Email + Stats */}
        <Animated.View entering={FadeInUp.duration(enterConfig.content.duration)}>
          <View style={styles.avatarSection}>
            {/* Avatar — read-only. Upload and delete both live behind the
                pencil next to the display name (Edit Profile modal); the
                avatar itself is no longer a tap target. */}
            <View style={styles.avatarWrapper}>
              <View style={styles.avatar}>
                {hasProfileImage ? (
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
            </View>

            {/* Tappable Name — opens unified Edit Profile modal */}
            <Pressable onPress={openEditModal} hitSlop={8} style={styles.nameRow}>
              <Text style={styles.nameText}>{displayName}</Text>
              <Ionicons
                name="create-outline"
                size={18}
                color={surfaces.text.tertiary}
                style={styles.nameEditIcon}
              />
            </Pressable>

            {/* Tappable Email — opens unified Edit Profile modal (no icon; the one
                edit affordance lives next to the name) */}
            <Pressable onPress={openEditModal} hitSlop={8} style={styles.emailRow}>
              <Text style={styles.email}>{user?.email || ''}</Text>
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
              onPress={() => navigation.navigate('Privacy')}
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

      {/* ── Unified Edit Profile Sheet (profile → code) ──────────────── */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeEditModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.sheetOverlay}
        >
          <Pressable style={styles.sheetBackdrop} onPress={closeEditModal} />
          <Pressable
            style={[styles.sheetCard, { backgroundColor: surfaces.colors.raised }]}
            onPress={() => {}}
          >
            {/* Drag handle */}
            <View style={[styles.sheetHandle, { backgroundColor: surfaces.text.tertiary }]} />
              {modalStep === 'profile' ? (
                /* ── Unified profile edit: Name + Email inputs + single Save ── */
                <>
                  <Text style={[styles.modalTitle, { color: surfaces.text.primary }]}>
                    Edit Profile
                  </Text>

                  {/* Name field */}
                  <Text style={[styles.fieldLabel, { color: surfaces.text.tertiary }]}>
                    Name
                  </Text>
                  <View
                    style={[
                      styles.modalInput,
                      {
                        backgroundColor: surfaces.colors.input,
                        borderColor: nameError
                          ? '#D94848'
                          : surfaces.edge('input').borderColor || 'transparent',
                      },
                    ]}
                  >
                    <TextInput
                      value={editedName}
                      onChangeText={(t) => {
                        setEditedName(t);
                        if (nameError) setNameError('');
                      }}
                      placeholder="Your name"
                      placeholderTextColor={surfaces.text.tertiary}
                      autoCapitalize="words"
                      autoCorrect={false}
                      returnKeyType="next"
                      style={[styles.modalInputText, { color: surfaces.text.primary }]}
                    />
                  </View>
                  {nameError ? <Text style={styles.modalError}>{nameError}</Text> : null}

                  {/* Email field — live input; Save triggers code popup if changed */}
                  <Text
                    style={[
                      styles.fieldLabel,
                      { color: surfaces.text.tertiary, marginTop: spacing.lg },
                    ]}
                  >
                    Email
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
                      value={editedEmail}
                      onChangeText={(t) => {
                        setEditedEmail(t);
                        if (emailError) setEmailError('');
                      }}
                      onSubmitEditing={handleSaveProfile}
                      placeholder="you@email.com"
                      placeholderTextColor={surfaces.text.tertiary}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="done"
                      style={[styles.modalInputText, { color: surfaces.text.primary }]}
                    />
                  </View>
                  {emailError ? <Text style={styles.modalError}>{emailError}</Text> : null}

                  {/* Photo action — remove (if photo exists) or upload (if not) */}
                  {hasProfileImage ? (
                    <Pressable
                      onPress={handleRemovePhoto}
                      disabled={isRemovingPhoto}
                      style={styles.removePhotoRow}
                    >
                      {isRemovingPhoto ? (
                        <ActivityIndicator size="small" color="#D94848" />
                      ) : (
                        <>
                          <Ionicons name="trash-outline" size={16} color="#D94848" />
                          <Text style={styles.removePhotoText}>Remove profile photo</Text>
                        </>
                      )}
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={handlePickPhotoInModal}
                      style={styles.uploadPhotoRow}
                    >
                      {pendingPhotoUri ? (
                        <>
                          <Image
                            source={{ uri: pendingPhotoUri }}
                            style={styles.uploadPhotoPreview}
                          />
                          <Text style={styles.uploadPhotoText}>
                            Photo selected · Tap to change
                          </Text>
                        </>
                      ) : (
                        <>
                          <Ionicons name="camera-outline" size={16} color="#6C63FF" />
                          <Text style={styles.uploadPhotoText}>Upload profile photo</Text>
                        </>
                      )}
                    </Pressable>
                  )}

                  <View style={styles.modalActions}>
                    <Pressable onPress={closeEditModal} style={styles.modalCancelBtn}>
                      <Text style={[styles.modalCancelText, { color: surfaces.text.secondary }]}>
                        Cancel
                      </Text>
                    </Pressable>
                    {(() => {
                      const trimmedName = editedName.trim();
                      const trimmedEmail = editedEmail.trim().toLowerCase();
                      const nothingChanged =
                        (trimmedName === (user?.display_name || '') || !trimmedName) &&
                        trimmedEmail === (user?.email || '').toLowerCase() &&
                        !pendingPhotoUri;
                      const disabled = isSavingProfile || nothingChanged;
                      return (
                        <Pressable
                          onPress={handleSaveProfile}
                          disabled={disabled}
                          style={[styles.modalSaveBtn, disabled && { opacity: 0.5 }]}
                        >
                          {isSavingProfile ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text style={styles.modalSaveText}>Save</Text>
                          )}
                        </Pressable>
                      );
                    })()}
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
                      {pendingEmail}
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

                  {/* Resend — re-issues the code for the same pendingEmail, then
                      goes back to the profile step so the user can correct a typo */}
                  <Pressable
                    onPress={() => {
                      setEmailError('');
                      setCodeDigits(['', '', '', '']);
                      setModalStep('profile');
                    }}
                    style={styles.resendBtn}
                  >
                    <Text style={[styles.resendText, { color: surfaces.text.tertiary }]}>
                      Wrong email? <Text style={{ color: '#6C63FF' }}>Edit</Text>
                    </Text>
                  </Pressable>

                  <View style={styles.modalActions}>
                    <Pressable onPress={closeEditModal} style={styles.modalCancelBtn}>
                      <Text style={[styles.modalCancelText, { color: surfaces.text.secondary }]}>
                        Cancel
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={handleVerifyCode}
                      disabled={isVerifyingCode || codeDigits.join('').length !== 4}
                      style={[
                        styles.modalSaveBtn,
                        (isVerifyingCode || codeDigits.join('').length !== 4) && { opacity: 0.6 },
                      ]}
                    >
                      {isVerifyingCode ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.modalSaveText}>Verify</Text>
                      )}
                    </Pressable>
                  </View>
                </>
              )}
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
      paddingTop: spacing.xs,
      paddingBottom: 120,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      marginBottom: 0,
    },
    title: {
      ...typography.h2,
      color: surfaces.text.primary,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 0,
      marginBottom: spacing.xs,
    },
    nameText: {
      ...typography.h2,
      color: surfaces.text.primary,
    },
    nameEditIcon: {
      marginLeft: 8,
      opacity: 0.7,
    },
    avatarSection: {
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    avatarWrapper: {
      marginBottom: spacing.sm,
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
    emailRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    email: {
      ...typography.bodySmall,
      color: surfaces.text.secondary,
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
    // ── Sheet styles ───────────────────────────────────────────────────
    sheetOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    sheetBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    sheetCard: {
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: Platform.OS === 'ios' ? spacing.xl + spacing.lg : spacing.xl,
    },
    sheetHandle: {
      alignSelf: 'center',
      width: 40,
      height: 5,
      borderRadius: 3,
      opacity: 0.35,
      marginTop: spacing.sm,
      marginBottom: spacing.lg,
    },
    modalTitle: {
      ...typography.h2,
      marginBottom: spacing.xl,
    },
    modalSubtitle: {
      ...typography.bodySmall,
      lineHeight: 20,
      marginBottom: spacing.lg,
    },
    modalInput: {
      borderWidth: 1,
      borderRadius: borderRadius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: Platform.OS === 'ios' ? 18 : 14,
      marginBottom: spacing.xs,
      marginTop: spacing.xs,
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
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: spacing.xl,
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
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      minWidth: 120,
      alignItems: 'center',
    },
    modalSaveText: {
      ...typography.body,
      fontWeight: '600' as const,
      color: '#FFFFFF',
    },
    // ── Unified edit-profile styles ─────────────────────────────────────
    fieldLabel: {
      ...typography.caption,
      fontWeight: '500' as const,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.5,
      marginBottom: spacing.sm,
    },
    removePhotoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: spacing.lg,
      paddingVertical: spacing.sm,
    },
    removePhotoText: {
      ...typography.bodySmall,
      fontWeight: '500' as const,
      color: '#D94848',
    },
    uploadPhotoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: spacing.lg,
      paddingVertical: spacing.sm,
    },
    uploadPhotoText: {
      ...typography.bodySmall,
      fontWeight: '500' as const,
      color: '#6C63FF',
    },
    uploadPhotoPreview: {
      width: 24,
      height: 24,
      borderRadius: 12,
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
