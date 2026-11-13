import { StyleSheet, View } from 'react-native';

import { ConnectionPill } from '@/components/connection-pill';
import { GlassSurface } from '@/components/glass-surface';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { TuneIcon } from '@/components/tune-icon';
import { Radius } from '@/constants/theme';
import { useTank } from '@/providers/tank-provider';

export type AppHeaderProps = {
  onOpenSettings: () => void;
};

export function AppHeader({ onOpenSettings }: AppHeaderProps) {
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
