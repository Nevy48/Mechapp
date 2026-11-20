import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Switch,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { ConnectionPill } from '@/components/connection-pill';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { useTank } from '@/providers/tank-provider';
import { FILL_STATE_LABELS } from '@/data/tank';
import { formatElapsed, formatNumber } from '@/utils/format';

/** Paso de los botones de capacidad, en litros. */
const CAPACITY_STEP = 50;

export type SettingsSheetProps = {
  visible: boolean;
  onClose: () => void;
};

export function SettingsSheet({ visible, onClose }: SettingsSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const now = useNow(1000, visible);

  const {
    capacityLiters,
    setCapacityLiters,
    mode,
    setMode,
    isDeviceAvailable,
    status,
    statusDetail,
    reading,
    isSimulatedOnline,
    setSimulatedConnection,
    control,
    simulationControls,
    setCisternWater,
    setPumpFailure,
    resetController,
  } = useTank();

  const [mounted, setMounted] = useState(visible);
  const [draft, setDraft] = useState<string | null>(null);
  const [segmentWidth, setSegmentWidth] = useState(0);

  const progress = useSharedValue(0);
  const dragY = useSharedValue(0);
  const sheetHeight = useSharedValue(0);
  const indicatorX = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      dragY.set(0);
      progress.set(withSpring(1, { damping: 24, stiffness: 190, mass: 0.9 }));
      return;
    }
    setMounted(false);
  }, [visible, progress, dragY]);

  useEffect(() => {
    const target = mode === 'simulated' ? 0 : segmentWidth;
    indicatorX.set(withSpring(target, { damping: 20, stiffness: 210, mass: 0.7 }));
  }, [mode, segmentWidth, indicatorX]);

  const dismiss = useCallback(() => {
    progress.set(
      withTiming(0, { duration: 240, easing: Easing.out(Easing.quad) }, (finished) => {
        if (finished) {
          scheduleOnRN(onClose);
        }
      })
    );
  }, [onClose, progress]);

  /**
   * Arrastre hacia abajo en cualquier parte del sheet. Se captura antes que los
   * hijos (botones, switch) para que un deslizamiento que empieza sobre ellos
   * también cierre el sheet; los toques simples no se mueven y siguen llegando.
   */
  const panResponder = useMemo(() => {
    const isDownwardDrag = (_: unknown, gesture: { dx: number; dy: number }) =>
      gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx);

    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: isDownwardDrag,
      onMoveShouldSetPanResponderCapture: isDownwardDrag,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gesture) => {
        dragY.set(Math.max(0, gesture.dy));
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 120 || gesture.vy > 0.9) {
          dismiss();
          return;
        }
        dragY.set(withSpring(0, { damping: 20, stiffness: 220, mass: 0.8 }));
      },
      onPanResponderTerminate: () => {
        dragY.set(withSpring(0, { damping: 20, stiffness: 220, mass: 0.8 }));
      },
    });
  }, [dismiss, dragY]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * sheetHeight.value + dragY.value }],
  }));

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: progress.value * (1 - Math.min(1, dragY.value / Math.max(1, sheetHeight.value))),
  }));

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  const handleSheetLayout = (event: LayoutChangeEvent) => {
    sheetHeight.set(event.nativeEvent.layout.height);
  };

  const handleSegmentLayout = (event: LayoutChangeEvent) => {
    setSegmentWidth((event.nativeEvent.layout.width - 6) / 2);
  };

  const commitCapacity = (value: string) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      setCapacityLiters(parsed);
    }
  };

  const displayCapacity = draft ?? formatNumber(capacityLiters);

  const modeDescription =
    mode === 'simulated'
      ? 'Los datos son sintéticos: sirven para probar la app sin el dispositivo.'
      : isDeviceAvailable
        ? 'Lecturas reales del sensor por Wi-Fi.'
        : 'Falta definir EXPO_PUBLIC_TANK_API_URL para conectar el dispositivo.';

  const controlSummary = control
    ? `${FILL_STATE_LABELS[control.fillState]} · bomba ${control.pumpOn ? 'encendida' : 'apagada'}`
    : mode === 'device' && reading
      ? 'El equipo no informa el control de llenado (firmware anterior).'
      : 'sin datos';

  const lastReading = reading
    ? `${Math.round(reading.levelPercent)}% · ${formatElapsed(reading.timestamp, now) ?? 'sin datos'}`
    : 'sin mediciones';

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={dismiss}>
      <View style={styles.root}>
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }, scrimStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={dismiss}
            accessibilityRole="button"
            accessibilityLabel="Cerrar configuración"
          />
        </Animated.View>

        <Animated.View
          {...panResponder.panHandlers}
          onLayout={handleSheetLayout}
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              paddingBottom: insets.bottom + 20,
            },
            sheetStyle,
          ]}>
          <View style={styles.grabArea}>
            <View style={[styles.grabber, { backgroundColor: theme.hairline }]} />
            <ThemedText type="headline" style={styles.title}>
              Configuración
            </ThemedText>
          </View>

          <View style={styles.section}>
            <ThemedText type="label" themeColor="textTertiary">
              Capacidad del tanque
            </ThemedText>

            <View style={styles.capacityRow}>
              <PressableScale
                onPress={() => setCapacityLiters(capacityLiters - CAPACITY_STEP)}
                accessibilityRole="button"
                accessibilityLabel="Reducir capacidad"
                style={styles.stepButton}>
                <ThemedText type="headline" themeColor="textSecondary">
                  −
                </ThemedText>
              </PressableScale>

              <View style={styles.capacityField}>
                <TextInput
                  value={displayCapacity}
                  onChangeText={(text) => setDraft(text.replace(/[^0-9]/g, ''))}
                  onFocus={() => setDraft(String(capacityLiters))}
                  onBlur={() => {
                    if (draft !== null) commitCapacity(draft);
                    setDraft(null);
                  }}
                  keyboardType="number-pad"
                  selectTextOnFocus
                  maxLength={6}
                  style={[styles.capacityInput, { color: theme.text }]}
                  accessibilityLabel="Capacidad del tanque en litros"
                />
                <ThemedText type="headline" themeColor="textTertiary">
                  L
                </ThemedText>
              </View>

              <PressableScale
                onPress={() => setCapacityLiters(capacityLiters + CAPACITY_STEP)}
                accessibilityRole="button"
                accessibilityLabel="Aumentar capacidad"
                style={styles.stepButton}>
                <ThemedText type="headline" themeColor="textSecondary">
                  +
                </ThemedText>
              </PressableScale>
            </View>

            <ThemedText type="caption" themeColor="textTertiary">
              Cambia los litros calculados. El nivel medido no se modifica.
            </ThemedText>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.hairline }]} />

          <View style={styles.section}>
            <ThemedText type="label" themeColor="textTertiary">
              Modo de conexión
            </ThemedText>

            <View
              onLayout={handleSegmentLayout}
              style={[styles.segmented, { backgroundColor: theme.surfaceMuted }]}>
              <Animated.View
                style={[
                  styles.segmentIndicator,
                  { width: segmentWidth, backgroundColor: theme.surface },
                  indicatorStyle,
                ]}
              />
              <Pressable
                style={styles.segment}
                onPress={() => setMode('simulated')}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === 'simulated' }}>
                <ThemedText
                  type="caption"
                  themeColor={mode === 'simulated' ? 'text' : 'textSecondary'}
                  style={styles.segmentLabel}>
                  Simulación
                </ThemedText>
              </Pressable>
              <Pressable
                style={styles.segment}
                onPress={() => setMode('device')}
                disabled={!isDeviceAvailable}
                accessibilityRole="button"
                accessibilityState={{
                  selected: mode === 'device',
                  disabled: !isDeviceAvailable,
                }}>
                <ThemedText
                  type="caption"
                  themeColor={
                    mode === 'device'
                      ? 'text'
                      : isDeviceAvailable
                        ? 'textSecondary'
                        : 'textTertiary'
                  }
                  style={styles.segmentLabel}>
                  Dispositivo
                </ThemedText>
              </Pressable>
            </View>

            <ThemedText type="caption" themeColor="textTertiary">
              {modeDescription}
            </ThemedText>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.hairline }]} />

          <View style={styles.section}>
            <ThemedText type="label" themeColor="textTertiary">
              Estado de la conexión
            </ThemedText>

            <View style={styles.statusRow}>
              <ConnectionPill status={status} />
              {statusDetail ? (
                <ThemedText type="caption" themeColor="textTertiary">
                  {statusDetail}
                </ThemedText>
              ) : null}
            </View>

            <ThemedText type="caption" themeColor="textTertiary">
              Última medición: {lastReading}
            </ThemedText>
            <ThemedText type="caption" themeColor="textTertiary">
              Control de llenado: {controlSummary}
            </ThemedText>
          </View>

          {mode === 'simulated' && (
            <>
              <View style={[styles.divider, { backgroundColor: theme.hairline }]} />

              <ThemedText type="label" themeColor="textTertiary" style={styles.groupLabel}>
                Pruebas de la simulación
              </ThemedText>

              <View style={styles.sectionRow}>
                <View style={styles.sectionRowText}>
                  <ThemedText type="default">Cisterna con agua</ThemedText>
                  <ThemedText type="caption" themeColor="textTertiary">
                    Es el automático de la cisterna
                  </ThemedText>
                </View>
                <Switch
                  value={simulationControls?.cisternHasWater ?? true}
                  onValueChange={setCisternWater}
                  accessibilityLabel="Cisterna con agua"
                />
              </View>

              <View style={styles.sectionRow}>
                <View style={styles.sectionRowText}>
                  <ThemedText type="default">Bomba sin caudal</ThemedText>
                  <ThemedText type="caption" themeColor="textTertiary">
                    Funciona pero no sube agua: prueba las fallas
                  </ThemedText>
                </View>
                <Switch
                  value={simulationControls?.pumpFailure ?? false}
                  onValueChange={setPumpFailure}
                  accessibilityLabel="Simular bomba sin caudal"
                />
              </View>

              <View style={styles.sectionRow}>
                <View style={styles.sectionRowText}>
                  <ThemedText type="default">Simular corte de conexión</ThemedText>
                  <ThemedText type="caption" themeColor="textTertiary">
                    Prueba el estado "sin conexión"
                  </ThemedText>
                </View>
                <Switch
                  value={!isSimulatedOnline}
                  onValueChange={(offline) => setSimulatedConnection(!offline)}
                  accessibilityLabel="Simular corte de conexión"
                />
              </View>

              {(control?.fillState === 'locked' || control?.fillState === 'fault') && (
                <PressableScale
                  onPress={resetController}
                  accessibilityRole="button"
                  accessibilityLabel="Reiniciar el equipo simulado"
                  style={[styles.resetButton, { backgroundColor: theme.criticalSoft }]}>
                  <ThemedText type="caption" style={[styles.resetLabel, { color: theme.critical }]}>
                    Reiniciar equipo (botón reset del Arduino)
                  </ThemedText>
                </PressableScale>
              )}
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 4,
  },
  grabArea: {
    paddingBottom: 6,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
  },
  title: {
    marginBottom: 4,
  },
  section: {
    gap: 10,
    paddingVertical: 14,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 9,
  },
  sectionRowText: {
    flex: 1,
    gap: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  capacityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  stepButton: {
    width: 46,
    height: 46,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capacityField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 6,
  },
  capacityInput: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '600',
    letterSpacing: -0.8,
    textAlign: 'center',
    minWidth: 120,
    paddingVertical: 0,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: Radius.pill,
    padding: 3,
  },
  segmentIndicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
    borderRadius: Radius.pill,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
  },
  segmentLabel: {
    fontWeight: '600',
  },
  groupLabel: {
    paddingTop: 14,
  },
  resetButton: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: Radius.md,
    marginTop: 6,
  },
  resetLabel: {
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
