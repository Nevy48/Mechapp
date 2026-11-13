import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';

import { AppHeader } from '@/components/app-header';
import { LastMeasurement } from '@/components/last-measurement';
import { LevelReadout } from '@/components/level-readout';
import { SettingsSheet } from '@/components/settings-sheet';
import { SimulateButton } from '@/components/simulate-button';
import { ThemedText } from '@/components/themed-text';
import { TankStatusBadge } from '@/components/tank-status';
import { WaterTank } from '@/components/water-tank';
import { remainingLiters } from '@/data/tank';
import { useTheme } from '@/hooks/use-theme';
import { useTank } from '@/providers/tank-provider';

export default function DashboardScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const {
    mode,
    reading,
    status,
    capacityLiters,
    isStale,
    trend,
    alert,
    isFillSimulationRunning,
    startFillSimulation,
    stopFillSimulation,
    setManualLevel,
  } = useTank();
  const [settingsVisible, setSettingsVisible] = useState(false);
  /** La pista de "arrastrá" se muestra hasta que se usa una vez. */
  const [hasDragged, setHasDragged] = useState(false);
  const isSimulated = mode === 'simulated';
  const handleDragStart = useCallback(() => setHasDragged(true), []);

  const levelPercent = reading?.levelPercent ?? 0;
  const liters = reading ? remainingLiters(reading.levelPercent, capacityLiters) : 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View
        style={[
          styles.content,
          { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 14 },
        ]}>
        <Animated.View entering={FadeInDown.duration(700).delay(40)}>
          <AppHeader onOpenSettings={() => setSettingsVisible(true)} />
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(820).delay(140)} style={styles.tankArea}>
          <WaterTank
            levelPercent={levelPercent}
            alert={alert}
            distanceCm={reading?.distanceCm ?? null}
            isStale={isStale}
            isTurbulent={isFillSimulationRunning}
            onLevelChange={isSimulated && !isStale ? setManualLevel : undefined}
            onDragStart={handleDragStart}
          />
          {isSimulated && !hasDragged && !isStale && (
            <Animated.View entering={FadeIn.duration(500).delay(900)} exiting={FadeOut.duration(250)}>
              <ThemedText type="caption" themeColor="textTertiary" style={styles.hint}>
                Arrastrá el agua para mover el nivel
              </ThemedText>
            </Animated.View>
          )}
        </Animated.View>

        <Animated.View entering={FadeIn.duration(700).delay(320)}>
          <LevelReadout
            levelPercent={levelPercent}
            remainingLiters={liters}
            capacityLiters={capacityLiters}
            hasReading={reading !== null}
          />
        </Animated.View>

        <Animated.View entering={FadeIn.duration(700).delay(420)} style={styles.statusArea}>
          <TankStatusBadge alert={alert} trend={trend} />
          {isSimulated && (
            <SimulateButton
              running={isFillSimulationRunning}
              onPress={isFillSimulationRunning ? stopFillSimulation : startFillSimulation}
            />
          )}
        </Animated.View>

        <Animated.View entering={FadeIn.duration(700).delay(520)} style={styles.footer}>
          <LastMeasurement timestamp={reading?.timestamp ?? null} status={status} />
        </Animated.View>
      </View>

      <SettingsSheet visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  tankArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  statusArea: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
  },
  hint: {
    marginTop: 6,
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
  },
});
