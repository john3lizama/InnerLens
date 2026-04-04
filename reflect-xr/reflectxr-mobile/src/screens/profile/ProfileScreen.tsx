import React, { useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Alert } from 'react-native';
import Animated, {
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import SafeAreaWrapper from '../../components/ui/SafeAreaWrapper';
import Card from '../../components/ui/Card';
import { typography, spacing, borderRadius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { mockJournals } from '../../data/mockJournals';

function ProfileRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <Pressable onPress={() => { if (onPress) { Haptics.selectionAsync(); onPress(); } }} style={styles.row} disabled={!onPress}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
        {value && <Text style={styles.rowValue}>{value}</Text>}
      </View>
      {onPress && (
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      )}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const avatarScale = useSharedValue(1);
  useEffect(() => {
    avatarScale.value = withRepeat(
      withTiming(1.03, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [avatarScale]);
  const avatarPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: avatarScale.value }],
  }));

  const handleLogout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <SafeAreaWrapper>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Profile</Text>

        {/* Avatar + Name */}
        <Animated.View entering={FadeInUp.duration(400).delay(0)}>
          <View style={styles.avatarSection}>
            <View style={styles.avatarContainer}>
              <Animated.View style={[styles.avatarHalo, avatarPulseStyle]}>
                <LinearGradient
                  colors={[...colors.gradient.primary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.avatarHaloGradient}
                />
              </Animated.View>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user?.display_name?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>
            </View>
            <Text style={styles.name}>{user?.display_name || 'User'}</Text>
            <Text style={styles.email}>{user?.email || ''}</Text>
            <Text style={styles.stats}>{mockJournals.length} Reflections · 7 Days Active</Text>
          </View>
        </Animated.View>

        {/* Settings */}
        <Animated.View entering={FadeInUp.duration(400).delay(100)}>
          <Card style={styles.card}>
            <ProfileRow
              icon="brush-outline"
              label="Preferred Style"
              value={user?.preferred_style || 'Not set'}
            />
            <View style={styles.divider} />
            <ProfileRow
              icon="notifications-outline"
              label="Notifications"
              value="Enabled"
            />
            <View style={styles.divider} />
            <ProfileRow
              icon="shield-checkmark-outline"
              label="Privacy"
            />
          </Card>
        </Animated.View>

        {/* About */}
        <Animated.View entering={FadeInUp.duration(400).delay(200)}>
          <Card style={styles.card}>
            <ProfileRow
              icon="information-circle-outline"
              label="About ReflectXR"
              value="v1.0.0"
            />
            <View style={styles.divider} />
            <ProfileRow
              icon="people-outline"
              label="Team InnerLens"
              value="Challenge X 2026"
            />
          </Card>
        </Animated.View>

        {/* Logout */}
        <Animated.View entering={FadeInUp.duration(400).delay(300)}>
          <Pressable onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text style={styles.logoutText}>Sign Out</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaWrapper>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 120,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  avatarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHalo: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    opacity: 0.15,
    overflow: 'hidden',
  },
  avatarHaloGradient: {
    width: 100,
    height: 100,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.overlay.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    ...typography.display,
    color: colors.primary,
  },
  name: {
    ...typography.h2,
    color: colors.text,
  },
  email: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  stats: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  card: {
    marginBottom: spacing.xl,
    paddingVertical: spacing.sm,
    paddingHorizontal: 0,
  },
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
    backgroundColor: `${colors.primary}10`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  rowContent: {
    flex: 1,
  },
  rowLabel: {
    ...typography.body,
    color: colors.text,
  },
  rowValue: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginLeft: spacing.lg + 36 + spacing.md,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  logoutText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.error,
  },
});
