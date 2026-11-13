import { StyleSheet } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { GlassSurface } from '@/components/glass-surface';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SimulateButtonProps = {
  running: boolean;
  onPress: () => void;
};

/**
 * Arranca o detiene la simulación de llenado: el tanque se vacía y se llena
 * de a poco, para mostrar la app en vivo con datos simulados.
 */
export function SimulateButton({ running, onPress }: SimulateButtonProps) {
  const theme = useTheme();

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={running ? 'Detener simulación de llenado' : 'Simular llenado del tanque'}
      style={styles.button}>
      <GlassSurface style={styles.surface}>
        <Svg width={10} height={10} viewBox="0 0 10 10">
          {running ? (
            <Rect x={1} y={1} width={8} height={8} rx={1.5} fill={theme.accentText} />
          ) : (
            <Path d="M2 1.2 L9 5 L2 8.8 Z" fill={theme.accentText} strokeLinejoin="round" />
          )}
        </Svg>
        <ThemedText type="caption" style={[styles.label, { color: theme.accentText }]}>
          {running ? 'Detener' : 'Simular'}
        </ThemedText>
      </GlassSurface>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: Radius.pill,
  },
  surface: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.pill,
  },
  label: {
    fontWeight: '600',
    letterSpacing: -0.1,
  },
});
