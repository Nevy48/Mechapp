import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { ConnectionStatus } from '@/data/tank';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { formatElapsed } from '@/utils/format';

export type LastMeasurementProps = {
  /** Momento de la última medición válida. */
  timestamp: number | null;
  status: ConnectionStatus;
};

/**
 * Línea de estado de la última medición.
 *
 * Cuando no hay conexión se conserva el último valor conocido, pero se
 * rotula como lectura antigua: nunca se presenta como dato en vivo.
 */
export function LastMeasurement({ timestamp, status }: LastMeasurementProps) {
  const theme = useTheme();
  const now = useNow(1000);
  const elapsed = formatElapsed(timestamp, now);

  const isLive = status === 'connected';
  const color =
    status === 'connected'
      ? theme.positive
      : status === 'connecting'
        ? theme.caution
        : theme.textTertiary;

  const label = isLive ? 'Actualizado' : status === 'connecting' ? 'Reconectando' : 'Sin conexión';

  return (
    <View style={styles.container} accessibilityRole="text">
      <View style={[styles.dot, { backgroundColor: color }]} />
      <ThemedText type="caption" themeColor="textTertiary">
        {label}
        {isLive && elapsed ? ` ${elapsed}` : ''}
        {!isLive && elapsed ? ` · Última lectura ${elapsed}` : ''}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
