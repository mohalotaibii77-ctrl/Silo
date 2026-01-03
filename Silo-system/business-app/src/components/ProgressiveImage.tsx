import React, { useState, useRef, useEffect, memo } from 'react';
import {
  View,
  Image,
  Animated,
  StyleSheet,
  ImageStyle,
  ViewStyle,
  ImageSourcePropType,
} from 'react-native';
import { useTheme, ThemeColors } from '../theme/ThemeContext';

/**
 * ProgressiveImage Component
 *
 * Loads a low-quality thumbnail first, then transitions smoothly to the full-quality image.
 * Provides a much better perceived loading experience.
 *
 * Features:
 * - Loads thumbnail immediately while full image loads
 * - Smooth opacity transition (not instant swap)
 * - BlurView placeholder effect while loading
 * - Error state fallback
 * - Memory-efficient with cleanup
 *
 * @example
 * <ProgressiveImage
 *   source={{ uri: product.image_url }}
 *   thumbnailSource={{ uri: product.thumbnail_url }}
 *   style={{ width: 200, height: 200 }}
 *   transitionDuration={300}
 * />
 */

interface ProgressiveImageProps {
  /** Full quality image source */
  source: ImageSourcePropType;
  /** Low quality thumbnail source (optional, will generate from full URL if not provided) */
  thumbnailSource?: ImageSourcePropType;
  /** Image style */
  style?: ImageStyle | ImageStyle[];
  /** Container style */
  containerStyle?: ViewStyle;
  /** Transition duration in ms (default: 300) */
  transitionDuration?: number;
  /** Resize mode for the image */
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  /** Placeholder background color */
  placeholderColor?: string;
  /** Called when full image loads successfully */
  onLoad?: () => void;
  /** Called when full image fails to load */
  onError?: () => void;
  /** Show blur effect on thumbnail */
  blurThumbnail?: boolean;
  /** Alt text for accessibility */
  accessibilityLabel?: string;
}

/**
 * Generate thumbnail URL from full image URL
 * Uses Supabase transform API if available
 */
function generateThumbnailUrl(fullUrl: string): string {
  if (!fullUrl) return '';

  // If it's a Supabase URL, use transform API
  if (fullUrl.includes('supabase.co/storage')) {
    const transformUrl = fullUrl.replace(
      '/storage/v1/object/',
      '/storage/v1/render/image/'
    );
    return `${transformUrl}?width=150&height=150&quality=60&resize=cover`;
  }

  // For other URLs, return as-is (thumbnail should be provided separately)
  return fullUrl;
}

const ProgressiveImage: React.FC<ProgressiveImageProps> = memo(({
  source,
  thumbnailSource,
  style,
  containerStyle,
  transitionDuration = 300,
  resizeMode = 'cover',
  placeholderColor,
  onLoad,
  onError,
  blurThumbnail = true,
  accessibilityLabel,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const effectivePlaceholderColor = placeholderColor ?? colors.muted;

  const [thumbnailLoaded, setThumbnailLoaded] = useState(false);
  const [fullImageLoaded, setFullImageLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const thumbnailOpacity = useRef(new Animated.Value(0)).current;
  const fullImageOpacity = useRef(new Animated.Value(0)).current;

  // Get thumbnail URL - use provided or generate from full URL
  const getThumbnailSource = (): ImageSourcePropType | null => {
    if (thumbnailSource) return thumbnailSource;

    if (typeof source === 'object' && 'uri' in source && source.uri) {
      const thumbnailUrl = generateThumbnailUrl(source.uri);
      return thumbnailUrl ? { uri: thumbnailUrl } : null;
    }

    return null;
  };

  const effectiveThumbnailSource = getThumbnailSource();

  // Handle thumbnail load
  const handleThumbnailLoad = () => {
    setThumbnailLoaded(true);
    Animated.timing(thumbnailOpacity, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

  // Handle full image load
  const handleFullImageLoad = () => {
    setFullImageLoaded(true);

    // Fade in full image while fading out thumbnail
    Animated.parallel([
      Animated.timing(fullImageOpacity, {
        toValue: 1,
        duration: transitionDuration,
        useNativeDriver: true,
      }),
      Animated.timing(thumbnailOpacity, {
        toValue: 0,
        duration: transitionDuration,
        useNativeDriver: true,
      }),
    ]).start();

    onLoad?.();
  };

  // Handle error
  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  // Cleanup on unmount - refs are stable so no dependencies needed
  useEffect(() => {
    return () => {
      thumbnailOpacity.stopAnimation();
      fullImageOpacity.stopAnimation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Flatten style array if needed
  const flattenedStyle = StyleSheet.flatten(style) || {};
  const { width, height, borderRadius, ...restStyle } = flattenedStyle;

  return (
    <View
      style={[
        styles.container,
        {
          width,
          height,
          borderRadius: borderRadius || 0,
          backgroundColor: effectivePlaceholderColor,
        },
        containerStyle,
      ]}
    >
      {/* Error Fallback */}
      {hasError && (
        <View style={[styles.fallback, { borderRadius: borderRadius || 0 }]}>
          <View style={styles.fallbackIcon}>
            <View style={styles.fallbackLine} />
            <View style={[styles.fallbackLine, styles.fallbackLineRotated]} />
          </View>
        </View>
      )}

      {/* Thumbnail (low quality, loads fast) */}
      {!hasError && effectiveThumbnailSource && (
        <Animated.View
          style={[
            styles.imageContainer,
            {
              opacity: thumbnailOpacity,
              borderRadius: borderRadius || 0,
            },
          ]}
        >
          <Image
            source={effectiveThumbnailSource}
            style={[
              styles.image,
              { borderRadius: borderRadius || 0 },
              restStyle,
            ]}
            resizeMode={resizeMode}
            onLoad={handleThumbnailLoad}
            blurRadius={blurThumbnail ? 2 : 0}
          />
        </Animated.View>
      )}

      {/* Full Image (high quality) */}
      {!hasError && (
        <Animated.View
          style={[
            styles.imageContainer,
            {
              opacity: fullImageOpacity,
              borderRadius: borderRadius || 0,
            },
          ]}
        >
          <Image
            source={source}
            style={[
              styles.image,
              { borderRadius: borderRadius || 0 },
              restStyle,
            ]}
            resizeMode={resizeMode}
            onLoad={handleFullImageLoad}
            onError={handleError}
            accessibilityLabel={accessibilityLabel}
          />
        </Animated.View>
      )}

      {/* Loading shimmer (shows before thumbnail loads) */}
      {!thumbnailLoaded && !hasError && (
        <ShimmerPlaceholder
          width={width as number}
          height={height as number}
          borderRadius={borderRadius as number}
          colors={colors}
        />
      )}
    </View>
  );
});

/**
 * Shimmer placeholder component for loading state
 */
const ShimmerPlaceholder: React.FC<{
  width?: number;
  height?: number;
  borderRadius?: number;
  colors: ThemeColors;
}> = ({ width, height, borderRadius = 0, colors }) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();

    return () => animation.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: colors.muted,
          width,
          height,
          borderRadius,
          opacity,
        },
      ]}
    />
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackIcon: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackLine: {
    position: 'absolute',
    width: 30,
    height: 2,
    backgroundColor: colors.mutedForeground,
    borderRadius: 1,
  },
  fallbackLineRotated: {
    transform: [{ rotate: '90deg' }],
  },
});

ProgressiveImage.displayName = 'ProgressiveImage';

export default ProgressiveImage;

// Re-export utility function for use elsewhere
export { generateThumbnailUrl };
