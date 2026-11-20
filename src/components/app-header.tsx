import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { ConnectionPill } from '@/components/connection-pill';
import { GlassSurface } from '@/components/glass-surface';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { TuneIcon } from '@/components/tune-icon';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTank } from '@/providers/tank-provider';

export type AppHeaderProps = {
  onOpenSettings: () => void;
  onOpenHistory: () => void;
};

/** Reloj con flecha: historial. */
function HistoryIcon({ size = 18 }: { size?: number }) {
  const theme = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M3.5 12 a8.5 8.5 0 1 0 2.5 -6"
        stroke={theme.text}
        strokeWidth={1.9}
        strokeLinecap="round"
        fill="none"
      />
      <Path d="M3 3.5 V7.5 H7" stroke={theme.text} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M12 7.5 V12 L15 14" stroke={theme.text} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Circle cx={12} cy={12} r={0.6} fill={theme.text} />
    </Svg>
  );
}

export function AppHeader({ onOpenSettings, onOpenHistory }: AppHeaderProps) {
  const { mode, status } = useTank();

  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <ThemedText type="headline" style={styles.wordmark}>
          Aqua
        </ThemedText>
        {mode === 'simulated' && (
          <ThemedText type="label" themeColor="textTertiary" style={styles.simulatedTag}>
            Simulado
          </ThemedText>
        )}
      </View>

      <View style={styles.actions}>
        <GlassSurface style={styles.pill}>
          <ConnectionPill status={status} />
        </GlassSurface>

        <PressableScale
          onPress={onOpenHistory}
          accessibilityRole="button"
          accessibilityLabel="Historial"
          style={styles.iconButton}>
          <GlassSurface style={styles.iconSurface}>
            <HistoryIcon />
          </GlassSurface>
        </PressableScale>

        <PressableScale
          onPress={onOpenSettings}
          accessibilityRole="button"
          accessibilityLabel="Configuración"
          style={styles.iconButton}>
          <GlassSurface style={styles.iconSurface}>
            <TuneIcon />
          </GlassSurface>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  wordmark: {
    letterSpacing: -0.6,
  },
  simulatedTag: {
    marginBottom: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pill: {
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  iconButton: {
    borderRadius: Radius.pill,
  },
  iconSurface: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
