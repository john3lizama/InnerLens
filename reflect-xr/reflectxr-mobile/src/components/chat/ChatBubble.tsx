/**
 * ChatBubble — Refined.
 *
 * Changes:
 * - User messages: solid primary color (not gradient). Less attention on UI, more on words.
 * - Assistant messages: ground surface, no outline border. Color differentiation only.
 * - Increased spacing between messages (20px)
 * - Reduced max width from 82% to 78%
 * - Uses surface tokens for mode-aware styling
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { typography, spacing, borderRadius } from '../../theme';
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
  const { surfaces } = useTheme();
  const styles = makeStyles(surfaces);
  const isUser = role === 'user';

  return (
    <View style={[styles.container, isUser ? styles.containerUser : styles.containerAssistant]}>
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
        ]}
      >
        <Text style={[styles.text, isUser ? styles.textUser : styles.textAssistant]}>
          {content}
        </Text>
        {!isUser && emotionTags && emotionTags.length > 0 && (
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
    </View>
  );
}

const makeStyles = (surfaces: any) => StyleSheet.create({
  container: {
    marginBottom: 20,
    paddingHorizontal: spacing.md,
  },
  containerUser: {
    alignItems: 'flex-end',
  },
  containerAssistant: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
  },
  bubbleUser: {
    backgroundColor: '#6C63FF',
    borderBottomRightRadius: borderRadius.sm,
  },
  bubbleAssistant: {
    backgroundColor: surfaces.colors.ground,
    borderBottomLeftRadius: borderRadius.sm,
  },
  text: {
    ...typography.body,
    lineHeight: 22,
  },
  textUser: {
    color: '#FFFFFF',
  },
  textAssistant: {
    color: surfaces.text.primary,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
});
