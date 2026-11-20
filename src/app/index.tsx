import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';

import { AppHeader } from '@/components/app-header';
import { ControlNotice } from '@/components/control-notice';
import { LastMeasurement } from '@/components/last-measurement';
import { LevelReadout } from '@/components/level-readout';
import { SettingsSheet } from '@/components/settings-sheet';
import { SimulateButton } from '@/components/simulate-button';
import { SystemPanel } from '@/components/system-panel';
import { ThemedText } from '@/components/themed-text';
import { TankStatusBadge } from '@/components/tank-status';
import { WaterTank } from '@/components/water-tank';
import { getControlNotice, remainingLiters } from '@/data/tank';
import { useTheme } from '@/hooks/use-theme';
import { useTank } from '@/providers/tank-provider';

export default function DashboardScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const {
    mode,
    reading,
    control,
    status,
    capacityLiters,
    isStale,
    trend,
    alert,
    isDrainRunning,
    startDrain,
    stopDrain,
    setManualLevel,
    resetController,
    simulationControls,
    setCisternWater,
  } = useTank();
  const [settingsVisible, setSettingsVisible] = useState(false);
  /** La pista de "arrastrá" se muestra hasta que se usa una vez. */
  const [hasDragged, setHasDragged] = useState(false);
  const isSimulated = mode === 'simulated';
  const [isTankDragging, setIsTankDragging] = useState(false);
  const handleDragStart = useCallback(() => setIsTankDragging(true), []);
  const handleDragEnd = useCallback(() => {
    setIsTankDragging(false);
    // La pista se oculta al soltar, para no achicar el tanque en pleno arrastre.
    setHasDragged(true);
  }, []);
  const openHistory = useCallback(() => router.push('/history'), []);
  /** Alto real del área del tanque: el tanque se ajusta para no tapar el encabezado. */
  const [tankArea, setTankArea] = useState<{ width: number; height: number } | null>(null);
  const showHint = isSimulated && !hasDragged;
  const handleTankAreaLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setTankArea({ width: Math.round(width), height: Math.round(height) });
  }, []);

  const levelPercent = reading?.levelPercent ?? 0;
  const liters = reading ? remainingLiters(reading.levelPercent, capacityLiters) : 0;
  const liveNotice = getControlNotice(control);
  /**
   * Mientras se arrastra el agua, el aviso del control queda congelado: si
   * apareciera o desapareciera, el tanque cambiaría de tamaño bajo el dedo.
   * Se actualiza al soltar.
   */
  const [shownNotice, setShownNotice] = useState(liveNotice);
  if (!isTankDragging && shownNotice?.title !== liveNotice?.title) {
    setShownNotice(liveNotice);
  }
  const notice = isTankDragging ? shownNotice : liveNotice;
  // En el equipo real el bloqueo se resuelve con el reset del Arduino; en la
  // simulación se ofrece el botón para probar el flujo completo.
  const canReset = isSimulated && control?.fillState === 'locked';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View
        style={[
          styles.content,
          { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 14 },
        ]}>
        <Animated.View entering={FadeInDown.duration(700).delay(40)}>
          <AppHeader
            onOpenSettings={() => setSettingsVisible(true)}
            onOpenHistory={openHistory}
          />
        </Animated.View>

        {notice && (
          <Animated.View
            key={notice.title}
            entering={FadeInDown.duration(380)}
            exiting={FadeOut.duration(220)}
            style={styles.notice}>
            <ControlNotice
              notice={notice}
              actionLabel={canReset ? 'Reiniciar' : undefined}
              onAction={canReset ? resetController : undefined}
            />
          </Animated.View>
        )}

        <Animated.View
          entering={FadeInDown.duration(820).delay(140)}
          style={styles.tankArea}
          onLayout={handleTankAreaLayout}>
          {/* El tanque se dibuja recién cuando se conoce el espacio disponible:
              así nunca tapa el encabezado y en web no queda con la medida del pre-render. */}
          {tankArea && (
            <WaterTank
              levelPercent={levelPercent}
              alert={alert}
              distanceCm={reading?.distanceCm ?? null}
              isStale={isStale}
              isTurbulent={isDrainRunning || (control?.pumpOn ?? false)}
              onLevelChange={isSimulated && !isStale ? setManualLevel : undefined}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              maxWidth={tankArea.width}
              maxHeight={tankArea.height - TANK_AREA_PADDING * 2 - (showHint ? HINT_SPACE : 0)}
            />
          )}
          {showHint && !isStale && (
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
          <TankStatusBadge alert={alert} trend={trend} control={control} />
          {isSimulated && (
            <SimulateButton
              running={isDrainRunning}
              onPress={isDrainRunning ? stopDrain : startDrain}
            />
          )}
        </Animated.View>

        <Animated.View entering={FadeIn.duration(700).delay(470)} style={styles.systemArea}>
          <SystemPanel
            control={control}
            isStale={isStale}
            onCisternPress={
              mode === 'simulated'
                ? () => setCisternWater(!(simulationControls?.cisternHasWater ?? true))
                : undefined
            }
          />
        </Animated.View>

        <Animated.View entering={FadeIn.duration(700).delay(520)} style={styles.footer}>
          <LastMeasurement timestamp={reading?.timestamp ?? null} status={status} />
        </Animated.View>
      </View>

      <SettingsSheet visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
    </View>
  );
}

/** Padding vertical del área del tanque y lugar reservado para la pista. */
const TANK_AREA_PADDING = 12;
const HINT_SPACE = 26;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  notice: {
    marginTop: 14,
  },
  tankArea: {
    flex: 1,
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: TANK_AREA_PADDING,
    overflow: 'hidden',
  },
  statusArea: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  systemArea: {
    marginTop: 16,
  },
  hint: {
    marginTop: 6,
  },
  footer: {
    alignItems: 'center',
    marginTop: 14,
  },
});
