/**
 * CrisisAlert — Refined for clarity and safety.
 *
 * Changes:
 * - Removed heart icon (aestheticizes the moment)
 * - Title: "You're not alone" (was "We're Here for You")
 * - Primary action (988) is the only visually dominant element — solid color, not gradient
 * - "Find help near you" is a text button, not a filled card
 * - Dismiss: "Go back" (was "Continue in Chat")
 * - No haptic feedback in this flow (silence is appropriate)
 * - Darker overlay for seriousness
 * - Uses surface tokens
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  Pressable,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { typography, spacing, borderRadius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

interface CrisisAlertProps {
  visible: boolean;
  onClose: () => void;
}

const CRISIS_NUMBER = '988';
const MH_SEARCH_QUERY = 'licensed mental health professional near me';

function openDialer() {
  // No haptics in crisis flow
  Linking.openURL(`tel:${CRISIS_NUMBER}`);
}

function openMaps() {
  // No haptics in crisis flow
  const encoded = encodeURIComponent(MH_SEARCH_QUERY);
  const url =
    Platform.OS === 'ios'
      ? `maps:?q=${encoded}`
      : `geo:0,0?q=${encoded}`;
  Linking.openURL(url);
}

export default function CrisisAlert({ visible, onClose }: CrisisAlertProps) {
  const { surfaces } = useTheme();
  const styles = makeStyles(surfaces);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Title — direct, clear */}
          <Text style={styles.title}>You're not alone</Text>
          <Text style={styles.body}>
            It sounds like you're going through something really difficult.
            You don't have to face this alone — please reach out to someone
            who can help.
          </Text>

          {/* Primary action — Call 988, solid, dominant */}
          <Pressable onPress={openDialer} style={styles.primaryAction}>
            <Ionicons name="call" size={22} color="#FFFFFF" />
            <View style={styles.actionText}>
              <Text style={styles.primaryTitle}>Call or Text 988</Text>
              <Text style={styles.primarySub}>
                Suicide & Crisis Lifeline (24/7)
              </Text>
            </View>
          </Pressable>

          {/* Secondary action — Find help, text button */}
          <Pressable onPress={openMaps} style={styles.secondaryAction}>
            <Ionicons name="location-outline" size={18} color={surfaces.text.secondary} />
            <Text style={styles.secondaryText}>Find help near you</Text>
          </Pressable>

          {/* Dismiss — quiet, bottom */}
          <Pressable onPress={onClose} style={styles.dismissButton}>
            <Text style={styles.dismissText}>Go back</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (surfaces: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    card: {
      width: '100%',
      backgroundColor: surfaces.colors.raised,
      borderRadius: borderRadius.xxl,
      padding: spacing.xl,
      alignItems: 'center',
    },
    title: {
      ...typography.h2,
      color: surfaces.text.primary,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    body: {
      ...typography.bodySmall,
      color: surfaces.text.secondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: spacing.xl,
    },
    primaryAction: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.lg,
      borderRadius: borderRadius.lg,
      backgroundColor: '#C94040',
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    actionText: {
      flex: 1,
    },
    primaryTitle: {
      ...typography.body,
      fontWeight: '700' as const,
      color: '#FFFFFF',
    },
    primarySub: {
      ...typography.caption,
      color: 'rgba(255,255,255,0.8)',
      marginTop: 2,
    },
    secondaryAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      marginBottom: spacing.md,
    },
    secondaryText: {
      ...typography.body,
      color: surfaces.text.secondary,
    },
    dismissButton: {
      paddingVertical: spacing.sm,
    },
    dismissText: {
      ...typography.bodySmall,
      color: surfaces.text.tertiary,
    },
  });
