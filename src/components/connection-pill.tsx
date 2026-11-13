import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import type { ConnectionStatus } from '@/data/tank';
import { useTheme } from '@/hooks/use-theme';

export type ConnectionPillProps = {
  status: ConnectionStatus;
  /** Oculta el texto y muestra sólo el punto. */
  compact?: boolean;
};

export function connectionLabel(status: ConnectionStatus): string {
  if (status === 'connected') return 'Conectado';
  if (status === 'connecting') return 'Reconectando…';
  return 'Sin conexión';
}

export function ConnectionPill({ status, compact = false }: ConnectionPillProps) {
  const theme = useTheme();
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withSequence(
      withTiming(1.3, { duration: 220 }),
      withTiming(1, { duration: 320 })
    );
  }, [status, pulse]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const color =
    status === 'connected'
      ? theme.positive
      : status === 'connecting'
        ? theme.caution
        : theme.textTertiary;

  return (
    <View style={styles.container} accessibilityRole="text" accessibilityLabel={connectionLabel(status)}>
      <Animated.View style={[styles.dot, { backgroundColor: color }, dotStyle]} />
      {!compact && (
        <ThemedText type="caption" themeColor="textSecondary" style={styles.label}>
          {connectionLabel(status)}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  label: {
    letterSpacing: -0.1,
  },
});
