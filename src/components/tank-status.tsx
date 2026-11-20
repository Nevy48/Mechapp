import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import type { FillControlState, LevelAlert } from '@/data/tank';
import { useTheme } from '@/hooks/use-theme';
import type { TankTrend } from '@/providers/tank-provider';

export type TankStatusKey =
  | 'full'
  | 'optimal'
  | 'filling'
  | 'pumping'
  | 'waiting'
  | 'fault'
  | 'dropping'
  | 'low'
  | 'critical';

export type TankStatus = {
  key: TankStatusKey;
  label: string;
};

/**
 * Estado del tanque. Los umbrales salen de la alerta del firmware
 * (`getLevelAlert`); el control de llenado y la tendencia agregan los matices.
 *
 * - Falla en el llenado: el control cortó por una falla o está bloqueado.
 * - Llenando con la bomba: el relé está cerrado.
 * - Esperando la cisterna: hace falta llenar pero la cisterna no tiene agua.
 * - Tanque lleno: alerta "lleno".
 * - Nivel crítico: alerta "crítico".
 * - Se está llenando: el nivel sube (por encima del nivel crítico).
 * - Queda poca agua: alerta "bajo".
 * - El nivel está bajando: todavía hay agua, pero se está consumiendo.
 * - Nivel óptimo: hay agua de sobra.
 */
export function getTankStatus(
  alert: LevelAlert | null,
  trend: TankTrend,
  control: FillControlState | null = null
): TankStatus {
  if (control?.fillState === 'fault' || control?.fillState === 'locked') {
    return { key: 'fault', label: 'Falla en el llenado' };
  }
  if (control?.pumpOn) {
    return { key: 'pumping', label: 'Llenando con la bomba' };
  }
  if (control?.fillState === 'waitingCistern') {
    return { key: 'waiting', label: 'Esperando la cisterna' };
  }
  if (alert === 'full') {
    return { key: 'full', label: 'Tanque lleno' };
  }
  if (alert === 'critical') {
    return { key: 'critical', label: 'Nivel crítico' };
  }
  if (trend === 'up') {
    return { key: 'filling', label: 'Se está llenando' };
  }
  if (alert === 'low') {
    return { key: 'low', label: 'Queda poca agua' };
  }
  if (trend === 'down') {
    return { key: 'dropping', label: 'El nivel está bajando' };
  }
  return { key: 'optimal', label: 'Nivel óptimo' };
}

export type TankStatusBadgeProps = {
  alert: LevelAlert | null;
  trend: TankTrend;
  control?: FillControlState | null;
};

export function TankStatusBadge({ alert, trend, control = null }: TankStatusBadgeProps) {
  const theme = useTheme();
  const status = getTankStatus(alert, trend, control);

  const palette: Record<TankStatusKey, { color: string; background: string }> = {
    full: { color: theme.positive, background: theme.positiveSoft },
    optimal: { color: theme.accentText, background: theme.accentSoft },
    filling: { color: theme.accentText, background: theme.accentSoft },
    pumping: { color: theme.accentText, background: theme.accentSoft },
    waiting: { color: theme.caution, background: theme.cautionSoft },
    fault: { color: theme.critical, background: theme.criticalSoft },
    dropping: { color: theme.caution, background: theme.cautionSoft },
    low: { color: theme.caution, background: theme.cautionSoft },
    critical: { color: theme.critical, background: theme.criticalSoft },
  };

  const colors = palette[status.key];

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
      accessibilityRole="text"
      accessibilityLabel={status.label}>
      <View style={[styles.dot, { backgroundColor: colors.color }]} />
      <ThemedText type="caption" style={[styles.label, { color: colors.color }]}>
        {status.label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.pill,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontWeight: '600',
    letterSpacing: -0.1,
  },
});
