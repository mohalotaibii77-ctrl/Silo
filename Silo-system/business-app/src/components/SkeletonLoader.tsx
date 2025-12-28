import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

// Individual skeleton element with shimmer animation
export const Skeleton: React.FC<SkeletonProps> = ({ 
  width = '100%', 
  height = 16, 
  borderRadius = 8,
  style 
}) => {
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
  }, []);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};

// Card skeleton for delivery partners, drivers, discounts
export const CardSkeleton: React.FC<{ style?: ViewStyle }> = ({ style }) => (
  <View style={[styles.card, style]}>
    <View style={styles.cardHeader}>
      <Skeleton width={48} height={48} borderRadius={12} />
      <View style={styles.cardHeaderInfo}>
        <Skeleton width="70%" height={16} />
        <Skeleton width="50%" height={12} style={{ marginTop: 8 }} />
      </View>
    </View>
    <View style={styles.cardBody}>
      <Skeleton width="100%" height={12} style={{ marginTop: 12 }} />
      <Skeleton width="60%" height={12} style={{ marginTop: 8 }} />
    </View>
    <View style={styles.cardActions}>
      <Skeleton width={32} height={32} borderRadius={8} />
      <Skeleton width={32} height={32} borderRadius={8} />
      <Skeleton width={32} height={32} borderRadius={8} />
    </View>
  </View>
);

// Grid card skeleton for tables, categories
export const GridCardSkeleton: React.FC<{ style?: ViewStyle }> = ({ style }) => (
  <View style={[styles.gridCard, style]}>
    <View style={styles.gridCardHeader}>
      <Skeleton width={44} height={44} borderRadius={12} />
      <View style={styles.gridCardInfo}>
        <Skeleton width="60%" height={14} />
        <Skeleton width="40%" height={10} style={{ marginTop: 6 }} />
      </View>
    </View>
    <Skeleton width="80%" height={10} style={{ marginTop: 10 }} />
    <View style={styles.gridCardActions}>
      <Skeleton width={28} height={28} borderRadius={6} />
      <Skeleton width={28} height={28} borderRadius={6} />
      <Skeleton width={28} height={28} borderRadius={6} />
    </View>
  </View>
);

// Bundle card skeleton with image
export const BundleCardSkeleton: React.FC<{ style?: ViewStyle }> = ({ style }) => (
  <View style={[styles.bundleCard, style]}>
    <Skeleton width="100%" height={140} borderRadius={0} style={styles.bundleImage} />
    <View style={styles.bundleInfo}>
      <Skeleton width="80%" height={14} />
      <Skeleton width="40%" height={10} style={{ marginTop: 6 }} />
      <View style={styles.bundlePricing}>
        <Skeleton width={60} height={16} />
        <Skeleton width={40} height={12} />
      </View>
      <View style={styles.bundleStats}>
        <Skeleton width={50} height={10} />
        <Skeleton width={50} height={10} />
      </View>
    </View>
  </View>
);

// Request card skeleton
export const RequestCardSkeleton: React.FC<{ style?: ViewStyle }> = ({ style }) => (
  <View style={[styles.requestCard, style]}>
    <View style={styles.requestHeader}>
      <Skeleton width={48} height={48} borderRadius={12} />
      <View style={styles.requestInfo}>
        <Skeleton width="60%" height={14} />
        <View style={styles.requestMeta}>
          <Skeleton width={70} height={20} borderRadius={10} />
          <Skeleton width={60} height={12} />
        </View>
      </View>
      <Skeleton width={20} height={20} borderRadius={10} />
    </View>
  </View>
);

// Stats skeleton for top stats row
export const StatsSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <View style={styles.statsRow}>
    {Array.from({ length: count }).map((_, i) => (
      <View key={i} style={styles.statCard}>
        <Skeleton width={40} height={24} />
        <Skeleton width={50} height={10} style={{ marginTop: 6 }} />
      </View>
    ))}
  </View>
);

// List skeleton - renders multiple card skeletons
interface ListSkeletonProps {
  count?: number;
  type?: 'card' | 'grid' | 'bundle' | 'request';
  style?: ViewStyle;
}

export const ListSkeleton: React.FC<ListSkeletonProps> = ({ 
  count = 4, 
  type = 'card',
  style 
}) => {
  const renderSkeleton = () => {
    switch (type) {
      case 'grid':
        return <GridCardSkeleton />;
      case 'bundle':
        return <BundleCardSkeleton />;
      case 'request':
        return <RequestCardSkeleton />;
      default:
        return <CardSkeleton />;
    }
  };

  if (type === 'grid' || type === 'bundle') {
    return (
      <View style={[styles.gridContainer, style]}>
        {Array.from({ length: count }).map((_, i) => (
          <View key={i} style={styles.gridItem}>
            {renderSkeleton()}
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={[styles.listContainer, style]}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i}>{renderSkeleton()}</View>
      ))}
    </View>
  );
};

// Section skeleton for grouped content
interface SectionSkeletonProps {
  showHeader?: boolean;
  itemCount?: number;
  type?: 'card' | 'grid';
}

export const SectionSkeleton: React.FC<SectionSkeletonProps> = ({
  showHeader = true,
  itemCount = 2,
  type = 'grid'
}) => (
  <View style={styles.section}>
    {showHeader && (
      <View style={styles.sectionHeader}>
        <Skeleton width={16} height={16} borderRadius={4} />
        <Skeleton width={120} height={14} />
      </View>
    )}
    <ListSkeleton count={itemCount} type={type} />
  </View>
);

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: colors.border,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardHeaderInfo: {
    flex: 1,
  },
  cardBody: {
    marginTop: 4,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 6,
  },
  gridCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gridCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  gridCardInfo: {
    flex: 1,
  },
  gridCardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 6,
  },
  bundleCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  bundleImage: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  bundleInfo: {
    padding: 12,
  },
  bundlePricing: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  bundleStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  requestCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  requestInfo: {
    flex: 1,
  },
  requestMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 10,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridItem: {
    width: '48%',
  },
  listContainer: {
    gap: 0,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
});

export default {
  Skeleton,
  CardSkeleton,
  GridCardSkeleton,
  BundleCardSkeleton,
  RequestCardSkeleton,
  StatsSkeleton,
  ListSkeleton,
  SectionSkeleton,
};



