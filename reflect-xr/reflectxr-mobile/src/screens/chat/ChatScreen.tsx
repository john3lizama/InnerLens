/**
 * ChatScreen — Refined.
 *
 * Changes:
 * - Header subtitle: "Here when you need" (was "Your creative companion")
 * - Image label: "From our conversation" (was "Art created from our conversation")
 * - Uses surface tokens for mode-aware styling
 * - Removed shadow imports, uses surface system
 * - Reduced header visual weight
 */

import React, { useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import SafeAreaWrapper from '../../components/ui/SafeAreaWrapper';
import ChatBubble from '../../components/chat/ChatBubble';
import ChatInput from '../../components/chat/ChatInput';
import CrisisAlert from '../../components/chat/CrisisAlert';
import TypingIndicator from '../../components/chat/TypingIndicator';
import { typography, spacing, borderRadius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { useChat } from '../../hooks/useChat';
import { Message } from '../../types/chat';

const IMAGE_PREFIX = '__IMAGE__';

export default function ChatScreen() {
  const navigation = useNavigation() as any;
  const { surfaces } = useTheme();
  const { messages, isTyping, sendMessage, showCrisisAlert, dismissCrisisAlert } = useChat();
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  const styles = makeStyles(surfaces);

  // Tab bar height (to clear the native bottom tab bar for the input)
  let tabBarHeight = 0;
  try {
    tabBarHeight = useBottomTabBarHeight();
  } catch {
    // not inside a tab navigator
  }

  // Compute reliable top/bottom safe areas.
  // Both insets AND Constants.statusBarHeight can return 0 on iOS under
  // native UITabBarController + native stack, so use device-aware fallbacks.
  // Using `||` (not `??`) so 0 correctly falls back to the default.
  const { height: screenH, width: screenW } = Dimensions.get('screen');
  const hasDynamicIslandOrNotch = Platform.OS === 'ios' && screenH / screenW > 2.0;
  const topSafeArea =
    insets.top || (Platform.OS === 'ios' ? (hasDynamicIslandOrNotch ? 59 : 47) : 24);
  const bottomSafeArea =
    insets.bottom || (Platform.OS === 'ios' ? (hasDynamicIslandOrNotch ? 34 : 20) : 0);
  // Native tab bar (~49px) + home indicator area
  const bottomClearance = tabBarHeight || (Platform.OS === 'ios' ? 49 + bottomSafeArea : 56);

  const handleSend = useCallback(
    (text: string) => {
      sendMessage(text);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    },
    [sendMessage]
  );

  const renderItem = useCallback(
    ({ item }: { item: Message }) => {
      // Check if this is a special image message
      if (item.content.startsWith(IMAGE_PREFIX)) {
        const imageUrl = item.content.slice(IMAGE_PREFIX.length);
        return (
          <Animated.View entering={FadeInUp.springify().damping(18)} style={styles.imageReveal}>
            <Text style={styles.imageLabel}>From our conversation</Text>
            <Pressable
              onPress={() =>
                navigation.navigate('ChatImageReveal', { imageUrl })
              }
            >
              <Image
                source={{ uri: imageUrl }}
                style={styles.generatedImage}
                contentFit="cover"
                transition={500}
              />
              <View style={styles.imageTapHint}>
                <Text style={styles.imageTapText}>Tap to expand</Text>
              </View>
            </Pressable>
          </Animated.View>
        );
      }

      return (
        <Animated.View entering={FadeInUp.springify().damping(18)}>
          <ChatBubble
            content={item.content}
            role={item.role}
            emotionTags={item.emotion_tags}
          />
        </Animated.View>
      );
    },
    [navigation, styles]
  );

  return (
    <View style={styles.flex}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Header — paddingTop uses insets.top with a device-aware fallback */}
        <View style={[styles.header, { paddingTop: topSafeArea + spacing.md }]}>
          <Image
            source={require('../../../assets/mindmate-icon.svg')}
            style={styles.headerIcon}
            contentFit="contain"
          />
          <View>
            <Text style={styles.headerTitle}>MindMate</Text>
            <Text style={styles.headerSubtitle}>Here when you need</Text>
          </View>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          ListFooterComponent={isTyping ? <TypingIndicator /> : null}
        />

        {/* Input */}
        <ChatInput onSend={handleSend} disabled={isTyping} />
        <View style={{ height: bottomClearance }} />
      </KeyboardAvoidingView>

      {/* Crisis Alert Modal */}
      <CrisisAlert visible={showCrisisAlert} onClose={dismissCrisisAlert} />
    </View>
  );
}

const makeStyles = (surfaces: any) => StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: surfaces.edge('input').borderColor || 'transparent',
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    marginRight: spacing.md,
  },
  headerTitle: {
    ...typography.h3,
    color: surfaces.text.primary,
  },
  headerSubtitle: {
    ...typography.caption,
    color: surfaces.text.secondary,
    marginTop: 1,
  },
  messageList: {
    paddingVertical: spacing.md,
  },
  imageReveal: {
    paddingHorizontal: spacing.md,
    marginVertical: spacing.md,
  },
  imageLabel: {
    ...typography.caption,
    color: surfaces.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  generatedImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: borderRadius.xl,
  },
  imageTapHint: {
    position: 'absolute',
    bottom: spacing.md,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  imageTapText: {
    ...typography.caption,
    color: '#FFFFFF',
  },
});
