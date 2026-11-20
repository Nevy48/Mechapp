import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { LEVEL_FULL_PERCENT, LEVEL_LOW_PERCENT } from '@/constants/config';
import { Radius } from '@/constants/theme';
import type { FillControlState } from '@/data/tank';
import { useTheme } from '@/hooks/use-theme';

export type SystemPanelProps = {
  control: FillControlState | null;
  /** Atenúa el panel cuando el dato no es en vivo. */
  isStale: boolean;
};

/** Rotor de la bomba: gira mientras la bomba está encendida. */
function PumpIcon({ running, color }: { running: boolean; color: string }) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (running) {
      rotation.value = 0;
      rotation.value = withRepeat(
        withTiming(360, { duration: 1100, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      cancelAnimation(rotation);
      rotation.value = withTiming(0, { duration: 300 });
    }
  }, [running, rotation]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={style}>
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={1.8} fill="none" />
        <Path
          d="M12 12 C12 8 14 6 16.5 6.5 M12 12 C15.5 14 15.5 17 13.5 18.5 M12 12 C8.5 14 6 13 5.5 10.5"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
          fill="none"
        />
        <Circle cx={12} cy={12} r={1.8} fill={color} />
      </Svg>
    </Animated.View>
  );
}

function CisternIcon({ hasWater, color }: { hasWater: boolean | null; color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        d="M4 5 V18 a2 2 0 0 0 2 2 H18 a2 2 0 0 0 2 -2 V5"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
      />
      {hasWater ? (
        <Path d="M5.5 11 Q8.5 9.5 12 11 T18.5 11 V18 a0.8 0.8 0 0 1 -0.8 0.8 H6.3 a0.8 0.8 0 0 1 -0.8 -0.8 Z" fill={color} />
      ) : (
        <Path d="M6 18.5 H18" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      )}
    </Svg>
  );
}

function pumpDetail(control: FillControlState): string {
  switch (control.fillState) {
    case 'filling':
      return 'Subiendo agua';
    case 'waitingCistern':
      return 'Espera cisterna';
    case 'fault':
      return 'Cortó por falla';
    case 'locked':
      return 'Bloqueada';
    default:
      return 'En espera';
  }
}

/**
 * Estado de la bomba y de la cisterna, tal como lo informa el control de
 * llenado. Si el equipo no manda esos datos (firmware anterior), no se muestra.
 */
export function SystemPanel({ control, isStale }: SystemPanelProps) {
  const theme = useTheme();
  if (!control) return null;

  const pumpFault = control.fillState === 'fault' || control.fillState === 'locked';
  const pumpColor = pumpFault ? theme.critical : control.pumpOn ? theme.accent : theme.textTertiary;

  const cisternColor =
    control.cisternHasWater === null
      ? theme.textTertiary
      : control.cisternHasWater
        ? theme.accent
        : theme.caution;
  const cisternLabel =
    control.cisternHasWater === null ? 'Sin dato' : control.cisternHasWater ? 'Con agua' : 'Vacía';
  const cisternDetail =
    control.cisternHasWater === null
      ? 'No informada'
      : control.cisternHasWater
        ? 'Bomba habilitada'
        : 'Bomba protegida';

  return (
    <View style={[styles.container, isStale && styles.stale]}>
      <View style={styles.row}>
        <View
          style={[styles.tile, { backgroundColor: theme.surface, borderColor: theme.hairline }]}
          accessibilityRole="text"
          accessibilityLabel={`Bomba ${control.pumpOn ? 'encendida' : 'apagada'}. ${pumpDetail(control)}`}>
          <PumpIcon running={control.pumpOn && !isStale} color={pumpColor} />
          <View style={styles.tileText}>
            <ThemedText type="label" themeColor="textTertiary">
              Bomba
            </ThemedText>
            <ThemedText type="default" style={[styles.value, { color: pumpFault ? theme.critical : theme.text }]}>
              {control.pumpOn ? 'Encendida' : 'Apagada'}
            </ThemedText>
            <ThemedText type="caption" themeColor="textTertiary" numberOfLines={1}>
              {pumpDetail(control)}
            </ThemedText>
          </View>
        </View>

        <View
          style={[styles.tile, { backgroundColor: theme.surface, borderColor: theme.hairline }]}
          accessibilityRole="text"
          accessibilityLabel={`Cisterna: ${cisternLabel}`}>
          <CisternIcon hasWater={control.cisternHasWater} color={cisternColor} />
          <View style={styles.tileText}>
            <ThemedText type="label" themeColor="textTertiary">
              Cisterna
            </ThemedText>
            <ThemedText
              type="default"
              style={[styles.value, { color: control.cisternHasWater === false ? theme.caution : theme.text }]}>
              {cisternLabel}
            </ThemedText>
            <ThemedText type="caption" themeColor="textTertiary" numberOfLines={1}>
              {cisternDetail}
            </ThemedText>
          </View>
        </View>
      </View>

      <ThemedText type="caption" themeColor="textTertiary" style={styles.rule}>
        Llenado automático: arranca en {LEVEL_LOW_PERCENT}% y corta en {LEVEL_FULL_PERCENT}%
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  stale: {
    opacity: 0.55,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  tile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tileText: {
    flex: 1,
    gap: 1,
  },
  value: {
    fontWeight: '600',
    lineHeight: 20,
  },
  rule: {
    textAlign: 'center',
  },
});
