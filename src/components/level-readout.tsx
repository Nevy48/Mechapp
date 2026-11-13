import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { formatNumber } from '@/utils/format';

export type LevelReadoutProps = {
  /** Nivel medido, en porcentaje. */
  levelPercent: number;
  /** Litros restantes, calculados a partir del porcentaje y la capacidad. */
  remainingLiters: number;
  /** Capacidad configurada del tanque. */
  capacityLiters: number;
  /** `false` mientras todavía no hay ninguna medición. */
  hasReading: boolean;
};

export function LevelReadout({
  levelPercent,
  remainingLiters,
  capacityLiters,
  hasReading,
}: LevelReadoutProps) {
  const rounded = Math.round(levelPercent);
  const scale = useSharedValue(1);
  const previous = useSharedValue(rounded);

  useEffect(() => {
    if (previous.value === rounded) return;
    previous.value = rounded;
    scale.value = 0.965;
    scale.value = withSpring(1, { damping: 15, stiffness: 210, mass: 0.7 });
  }, [rounded, previous, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const litersLabel = remainingLiters === 1 ? 'L disponible' : 'L disponibles';

  return (
    <View style={styles.container}>
      <Animated.View style={animatedStyle}>
        <ThemedText type="display">{hasReading ? `${rounded}%` : '—'}</ThemedText>
      </Animated.View>

      <ThemedText type="headline" themeColor="textSecondary" style={styles.liters}>
        {hasReading ? `${formatNumber(remainingLiters)} ${litersLabel}` : '—'}
      </ThemedText>

      <ThemedText type="caption" themeColor="textTertiary">
        de {formatNumber(capacityLiters)} L de capacidad
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 2,
  },
  liters: {
    marginTop: 2,
  },
});
