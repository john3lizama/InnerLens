import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { typography, spacing, borderRadius, shadow } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import EmotionTag from '../ui/EmotionTag';

interface ChatBubbleProps {
  content: string;
  role: 'user' | 'assistant';
  emotionTags?: Array<{ emotion: string; intensity: number }>;
  timestamp?: string;
}

export default function ChatBubble({
  content,
  role,
  emotionTags,
  timestamp,
}: ChatBubbleProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const isUser = role === 'user';

  return (
    <View style={[styles.container, isUser ? styles.containerUser : styles.containerAssistant]}>
      {isUser ? (
        <LinearGradient
          colors={[...colors.gradient.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.bubble, styles.bubbleUser]}
        >
          <Text style={[styles.text, styles.textUser]}>{content}</Text>
        </LinearGradient>
      ) : (
        <View style={[styles.bubble, styles.bubbleAssistant]}>
          <Text style={[styles.text, styles.textAssistant]}>{content}</Text>
          {emotionTags && emotionTags.length > 0 && (
            <View style={styles.tags}>
              {emotionTags.map((tag) => (
                <EmotionTag
                  key={tag.emotion}
                  emotion={tag.emotion}
                  intensity={tag.intensity}
                  size="small"
                />
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: {
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  containerUser: {
    alignItems: 'flex-end',
  },
  containerAssistant: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
  },
  bubbleUser: {
    borderBottomRightRadius: borderRadius.sm,
    ...shadow.sm,
  },
  bubbleAssistant: {
    backgroundColor: colors.surface + 'D9',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderBottomLeftRadius: borderRadius.sm,
    shadowColor: '#2D2B3D',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  text: {
    ...typography.body,
    lineHeight: 22,
  },
  textUser: {
    color: colors.textInverse,
  },
  textAssistant: {
    color: colors.text,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
});
