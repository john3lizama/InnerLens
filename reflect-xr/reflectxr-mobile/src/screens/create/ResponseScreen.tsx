import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import SafeAreaWrapper from '../../components/ui/SafeAreaWrapper';
import Button from '../../components/ui/Button';
import ImageGrid from '../../components/create/ImageGrid';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { typography, spacing } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { CreateStackParamList } from '../../navigation/types';
import { createMockImages } from '../../data/mockImages';
import { GeneratedImage } from '../../types/image';

type Nav = NativeStackNavigationProp<CreateStackParamList, 'Response'>;
type Route = RouteProp<CreateStackParamList, 'Response'>;

export default function ResponseScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { colors } = useTheme();
  const { prompt, style, concept } = route.params;

  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  useEffect(() => {
    // Simulate API call to generate images
    const timer = setTimeout(() => {
      const sessionId = `session-${Date.now()}`;
      setImages(createMockImages(sessionId));
      setLoading(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const styles = makeStyles(colors);

  const selectedImage = images.find((img) => img.id === selectedId);

  const handleReflect = () => {
    if (!selectedImage) return;
    navigation.navigate('Reflect', { image: selectedImage, concept });
  };

  if (loading) {
    return (
      <SafeAreaWrapper>
        <View style={styles.loadingContainer}>
          <LoadingSpinner size={56} showText={true} />
        </View>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInUp.duration(400)}>
          <Text style={styles.title}>Your Artwork</Text>
          <Text style={styles.subtitle}>
            Tap an image that resonates with you
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(500).delay(100)}>
          <ImageGrid
            images={images}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </Animated.View>

        {selectedId && (
          <Animated.View
            entering={FadeInUp.duration(400).delay(300)}
            style={styles.footer}
          >
            <Button
              title="Reflect on This"
              onPress={handleReflect}
              fullWidth
            />
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaWrapper>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.h1,
    color: colors.text,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  footer: {
    paddingTop: spacing.lg,
    paddingBottom: 120,
  },
});
