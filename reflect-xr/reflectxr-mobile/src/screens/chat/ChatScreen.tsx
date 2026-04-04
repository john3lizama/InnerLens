import React, { useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import Animated, { FadeInUp } from 'react-native-reanimated';
import SafeAreaWrapper from '../../components/ui/SafeAreaWrapper';
import ChatBubble from '../../components/chat/ChatBubble';
import ChatInput from '../../components/chat/ChatInput';
import TypingIndicator from '../../components/chat/TypingIndicator';
import { typography, spacing, borderRadius, shadow } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { useChat } from '../../hooks/useChat';
import { ChatStackParamList } from '../../navigation/types';
import { Message } from '../../types/chat';

type Nav = NativeStackNavigationProp<ChatStackParamList, 'Chat'>;

export default function ChatScreen() {
  const navigation = useNavigation<Nav>();
  const { colors } = useTheme();
  const { messages, isTyping, generatedImageUrl, sendMessage } = useChat();
  const flatListRef = useRef<FlatList>(null);
  const styles = makeStyles(colors);

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
    ({ item }: { item: Message }) => (
      <Animated.View entering={FadeInUp.springify().damping(18)}>
        <ChatBubble
          content={item.content}
          role={item.role}
          emotionTags={item.emotion_tags}
        />
      </Animated.View>
    ),
    []
  );

  return (
    <SafeAreaWrapper edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Text style={styles.headerEmoji}>💜</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>MindMate</Text>
            <Text style={styles.headerSubtitle}>Your creative companion</Text>
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
          ListFooterComponent={
            <>
              {isTyping && <TypingIndicator />}
              {generatedImageUrl && (
                <Animated.View entering={FadeInUp.springify()} style={styles.imageReveal}>
                  <Text style={styles.imageLabel}>Art created from our conversation</Text>
                  <Pressable
                    onPress={() =>
                      navigation.navigate('ChatImageReveal', {
                        imageUrl: generatedImageUrl,
                      })
                    }
                  >
                    <Image
                      source={{ uri: generatedImageUrl }}
                      style={styles.generatedImage}
                      contentFit="cover"
                      transition={500}
                    />
                    <View style={styles.imageTapHint}>
                      <Text style={styles.imageTapText}>Tap to expand</Text>
                    </View>
                  </Pressable>
                </Animated.View>
              )}
            </>
          }
        />

        {/* Input */}
        <ChatInput onSend={handleSend} disabled={isTyping} />
        <View style={{ height: Platform.OS === 'ios' ? 80 : 60 }} />
      </KeyboardAvoidingView>
    </SafeAreaWrapper>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.overlay.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  headerEmoji: {
    fontSize: 20,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  messageList: {
    paddingVertical: spacing.md,
  },
  imageReveal: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  imageLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  generatedImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: borderRadius.xl,
    ...shadow.md,
  },
  imageTapHint: {
    position: 'absolute',
    bottom: spacing.md,
    alignSelf: 'center',
    backgroundColor: colors.overlay.dark,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  imageTapText: {
    ...typography.caption,
    color: colors.textInverse,
  },
});
