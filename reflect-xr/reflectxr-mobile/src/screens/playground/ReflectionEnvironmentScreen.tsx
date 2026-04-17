/**
 * ReflectionEnvironmentScreen — TBD stub.
 *
 * Placeholder for the upcoming "Reflection Environment" feature in the
 * Playground tab. Wired into navigation so the entry point on the hub
 * has a real destination, even though the actual feature is still being
 * designed.
 *
 * Replace this screen with the real implementation once the design lands.
 */

import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import SafeAreaWrapper from '../../components/ui/SafeAreaWrapper';
import { typography, spacing, borderRadius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

export default function ReflectionEnvironmentScreen() {
  const navigation = useNavigation() as any;
  const { surfaces } = useTheme();
  const styles = makeStyles(surfaces);

  return (
    <SafeAreaWrapper>
      <View style={styles.container}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color={surfaces.text.primary} />
        </Pressable>

        <View style={styles.body}>
          <View style={styles.iconBubble}>
            <Ionicons name="leaf-outline" size={40} color="#A89BFF" />
          </View>

          <View style={styles.chip}>
            <Text style={styles.chipText}>COMING SOON</Text>
          </View>

          <Text style={styles.title}>Reflection Environments</Text>

          <Text style={styles.body__text}>
            We're crafting ambient AR/VR scenes designed to settle your mind —
            forests at dusk, mountain mornings, gentle rain on still water.
          </Text>
          <Text style={styles.body__text}>
            Step inside, take a breath, and let the environment hold you while
            you reflect.
          </Text>
          <Text style={[styles.body__text, styles.signoff]}>
            On its way. Stay tuned.
          </Text>
        </View>
      </View>
    </SafeAreaWrapper>
  );
}

const makeStyles = (surfaces: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
    },
    backButton: {
      paddingVertical: spacing.sm,
      alignSelf: 'flex-start',
    },
    body: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxxl,
    },
    iconBubble: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: 'rgba(108, 99, 255, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    chip: {
      paddingVertical: 4,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.full,
      backgroundColor: 'rgba(108, 99, 255, 0.18)',
      borderWidth: 1,
      borderColor: 'rgba(108, 99, 255, 0.4)',
      marginBottom: spacing.lg,
    },
    chipText: {
      ...typography.caption,
      color: '#A89BFF',
      letterSpacing: 1.4,
      fontWeight: '700',
    },
    title: {
      ...typography.h1,
      color: surfaces.text.primary,
      textAlign: 'center',
      marginBottom: spacing.lg,
    },
    body__text: {
      ...typography.body,
      color: surfaces.text.secondary,
      textAlign: 'center',
      marginBottom: spacing.md,
      lineHeight: 24,
    },
    signoff: {
      color: surfaces.text.tertiary,
      marginTop: spacing.lg,
    },
  });
