import { useEffect, useMemo, useState } from 'react';
import {
  type AccessibilityActionEvent,
  PanResponder,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  type DerivedValue,
  Easing,
  interpolateColor,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { clampLevelPercent, LEVEL_ALERT_LABELS, type LevelAlert } from '@/data/tank';
import { useTheme } from '@/hooks/use-theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

/** Ancho máximo del tanque: nunca debe dominar más que la pantalla. */
const MAX_TANK_WIDTH = 320;
const HORIZONTAL_INSET = 24;
/** Tamaño mínimo: evita medidas negativas antes de conocer el layout. */
const MIN_TANK_WIDTH = 120;
/** Relación entre el alto y el ancho del tanque. */
const TANK_ASPECT = 1.12;
/** Espacio bajo el tanque para la sombra de apoyo. */
const SHADOW_SPACE = 18;

/**
 * Silueta del tanque, en fracciones del alto: tapa, hombro cónico y cuerpo
 * cilíndrico con dos refuerzos, como los tanques plásticos de polietileno.
 */
const LID_BOTTOM = 0.075;
const SHOULDER_Y = 0.28;
/** Línea de agua al 100%: dentro del cono, por debajo de la tapa. */
const FULL_WATER_Y = 0.13;
const RIB_POSITIONS = [0.5, 0.74];
/** Curvatura de los refuerzos: el tanque se ve levemente desde arriba. */
const RIB_SAG = 0.022;

/** Amplitud de la ola, en px: en reposo y mientras el tanque se llena. */
const WAVE_AMPLITUDE = 4;
const WAVE_AMPLITUDE_TURBULENT = 9;
const WAVE_PERIOD_MS = 4200;
/** Separación horizontal entre los puntos de la ola. */
const WAVE_STEP_PX = 6;

/** Pulsos del sensor que bajan de la tapa a la superficie del agua. */
const PULSE_COUNT = 3;
const PULSE_PERIOD_MS = 1800;

/** Variación mínima (en %) para publicar el nivel mientras se arrastra el agua. */
const DRAG_EMIT_STEP_PERCENT = 0.5;
/** Paso de las acciones de accesibilidad (subir / bajar el nivel). */
const ACCESSIBILITY_STEP_PERCENT = 5;

/** Orden de las alertas: el color del agua interpola entre vecinas. */
const ALERT_ORDER: LevelAlert[] = ['critical', 'low', 'ok', 'full'];

export type WaterTankProps = {
  /** Nivel medido, en porcentaje (0–100). */
  levelPercent: number;
  /** Alerta del nivel: define el color del agua y la etiqueta. */
  alert: LevelAlert | null;
  /** Distancia que mide el sensor a la superficie, en cm. */
  distanceCm: number | null;
  /** `true` cuando la medición no es en vivo: el agua se atenúa. */
  isStale?: boolean;
  /** `true` mientras entra agua: la superficie se agita más. */
  isTurbulent?: boolean;
  /** Si está definido, el nivel se puede arrastrar con el dedo (modo simulado). */
  onLevelChange?: (levelPercent: number) => void;
  onDragStart?: () => void;
  /**
   * Alto disponible para el tanque. Si está definido, el tanque se achica
   * para entrar en ese alto y no tapar el resto de la pantalla.
   */
  maxHeight?: number;
  /** Ancho disponible (medido por el contenedor). Si falta, se usa el de la pantalla. */
  maxWidth?: number;
};

/** Contorno del hombro y el cuerpo (sin la tapa): también recorta el agua. */
function buildBodyPath(width: number, height: number): string {
  const top = height * LID_BOTTOM;
  const shoulder = height * SHOULDER_Y;
  const coneHalf = width * 0.31;
  const center = width / 2;
  const corner = width * 0.06;

  return [
    `M ${center - coneHalf} ${top}`,
    `L ${center + coneHalf} ${top}`,
    `C ${width * 0.9} ${top + height * 0.02} ${width} ${shoulder - height * 0.09} ${width} ${shoulder}`,
    `L ${width} ${height - corner}`,
    `Q ${width} ${height} ${width - corner} ${height}`,
    `L ${corner} ${height}`,
    `Q 0 ${height} 0 ${height - corner}`,
    `L 0 ${shoulder}`,
    `C 0 ${shoulder - height * 0.09} ${width * 0.1} ${top + height * 0.02} ${center - coneHalf} ${top}`,
    'Z',
  ].join(' ');
}

/**
 * Superficie del agua: suma de dos senos con frecuencias distintas para que
 * la ola no se vea mecánica. `phase` recorre 0–2π, así el bucle no salta.
 */
function buildWavePath(
  width: number,
  bottom: number,
  surfaceY: number,
  amplitude: number,
  phase: number,
  offset: number
): string {
  'worklet';
  const k = (2 * Math.PI) / (width * 0.85);
  let d = `M 0 ${bottom}`;
  for (let x = 0; x <= width + WAVE_STEP_PX; x += WAVE_STEP_PX) {
    const y =
      surfaceY +
      amplitude *
        (0.7 * Math.sin(k * x + phase + offset) + 0.3 * Math.sin(2.3 * k * x - 2 * phase));
    d += ` L ${x} ${y}`;
  }
  return `${d} L ${width + WAVE_STEP_PX} ${bottom} Z`;
}

type SensorPulseProps = {
  index: number;
  clock: SharedValue<number>;
  surfaceY: DerivedValue<number>;
  originY: number;
  centerX: number;
  visibility: SharedValue<number>;
  color: string;
};

/** Un frente de onda del ultrasonido: se abre y se apaga a medida que baja. */
function SensorPulse({ index, clock, surfaceY, originY, centerX, visibility, color }: SensorPulseProps) {
  const animatedProps = useAnimatedProps(() => {
    const t = (clock.value + index / PULSE_COUNT) % 1;
    const y = originY + t * (surfaceY.value - originY);
    const r = 5 + t * 16;
    return {
      d: `M ${centerX - r} ${y} Q ${centerX} ${y + r * 0.45} ${centerX + r} ${y}`,
      strokeOpacity: (1 - t) * 0.9 * visibility.value,
    };
  });

  return (
    <AnimatedPath
      animatedProps={animatedProps}
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      fill="none"
    />
  );
}

/**
 * Visualización del tanque.
 *
 * La silueta se dibuja con SVG y el agua se recorta contra ella, así que al
 * subir sigue la forma del cono. En la tapa va el sensor ultrasónico: sus
 * pulsos bajan hasta la superficie y la etiqueta muestra la distancia medida.
 * Reanimated recalcula olas, pulsos y color en cada frame en el hilo de UI.
 */
export function WaterTank({
  levelPercent,
  alert,
  distanceCm,
  isStale = false,
  isTurbulent = false,
  onLevelChange,
  onDragStart,
  maxHeight,
  maxWidth,
}: WaterTankProps) {
  const theme = useTheme();
  const { width: screenWidth } = useWindowDimensions();

  const size = useMemo(() => {
    const available =
      maxWidth !== undefined && maxWidth > 0 ? maxWidth : screenWidth - HORIZONTAL_INSET * 2;
    let width = Math.min(available, MAX_TANK_WIDTH);
    if (maxHeight !== undefined && maxHeight > 0) {
      width = Math.min(width, (maxHeight - SHADOW_SPACE) / TANK_ASPECT);
    }
    width = Math.max(MIN_TANK_WIDTH, Math.round(width));
    return { width, height: Math.round(width * TANK_ASPECT) };
  }, [screenWidth, maxHeight, maxWidth]);

  const bodyPath = useMemo(() => buildBodyPath(size.width, size.height), [size]);

  const ribPaths = useMemo(
    () =>
      RIB_POSITIONS.map((position) => {
        const y = size.height * position;
        const sag = size.height * RIB_SAG;
        return `M 0 ${y} Q ${size.width / 2} ${y + sag * 2} ${size.width} ${y}`;
      }),
    [size]
  );

  const level = useSharedValue(0);
  const phase = useSharedValue(0);
  const amplitude = useSharedValue(WAVE_AMPLITUDE);
  const waterOpacity = useSharedValue(1);
  const pulseClock = useSharedValue(0);
  const sensorVisibility = useSharedValue(1);
  const alertIndex = useSharedValue(ALERT_ORDER.indexOf(alert ?? 'ok'));

  const [isDragging, setIsDragging] = useState(false);
  /** Estado del arrastre: nivel al empezar, y último nivel publicado. */
  const dragStart = useSharedValue(0);
  const dragEmitted = useSharedValue(0);

  useEffect(() => {
    // Mientras se arrastra, el agua sigue al dedo: las mediciones no la mueven.
    if (isDragging) return;
    level.value = withSpring(clampLevelPercent(levelPercent), {
      damping: 20,
      stiffness: 70,
      mass: 1,
    });
  }, [levelPercent, level, isDragging]);

  useEffect(() => {
    phase.value = withRepeat(
      withTiming(2 * Math.PI, { duration: WAVE_PERIOD_MS, easing: Easing.linear }),
      -1,
      false
    );
    pulseClock.value = withRepeat(
      withTiming(1, { duration: PULSE_PERIOD_MS, easing: Easing.linear }),
      -1,
      false
    );
    return () => {
      cancelAnimation(phase);
      cancelAnimation(pulseClock);
    };
  }, [phase, pulseClock]);

  useEffect(() => {
    amplitude.value = withTiming(
      isTurbulent || isDragging ? WAVE_AMPLITUDE_TURBULENT : WAVE_AMPLITUDE,
      { duration: 900, easing: Easing.inOut(Easing.quad) }
    );
  }, [isTurbulent, isDragging, amplitude]);

  useEffect(() => {
    waterOpacity.value = withTiming(isStale ? 0.68 : 1, { duration: 320 });
    // Sin conexión el sensor no mide: se apagan el haz y las etiquetas.
    sensorVisibility.value = withTiming(isStale ? 0 : 1, { duration: 320 });
  }, [isStale, waterOpacity, sensorVisibility]);

  useEffect(() => {
    alertIndex.value = withTiming(ALERT_ORDER.indexOf(alert ?? 'ok'), {
      duration: 600,
      easing: Easing.inOut(Easing.quad),
    });
  }, [alert, alertIndex]);

  const sensorOriginY = size.height * LID_BOTTOM + 2.5;
  const centerX = size.width / 2;
  /** Recorrido vertical del agua entre 0% y 100%, en px. */
  const travel = size.height * (1 - FULL_WATER_Y);

  /** Altura de la superficie y amplitud efectiva (sin olas con el tanque vacío). */
  const surface = useDerivedValue(() => {
    const ratio = Math.min(1, Math.max(0, level.value / 100));
    return {
      y: size.height - ratio * travel,
      amplitude: amplitude.value * Math.min(1, ratio * 12),
    };
  });
  const surfaceY = useDerivedValue(() => surface.value.y);

  const frontWave = useDerivedValue(() =>
    buildWavePath(size.width, size.height, surface.value.y, surface.value.amplitude, phase.value, 0)
  );

  const waterColors = [theme.waterCritical, theme.waterLow, theme.water, theme.waterFull];
  const surfaceColors = [
    theme.waterCriticalSurface,
    theme.waterLowSurface,
    theme.waterSurface,
    theme.waterFullSurface,
  ];

  const frontWaveProps = useAnimatedProps(() => ({
    d: frontWave.value,
    fill: interpolateColor(alertIndex.value, [0, 1, 2, 3], waterColors),
  }));
  const depthProps = useAnimatedProps(() => ({ d: frontWave.value }));
  const backWaveProps = useAnimatedProps(() => ({
    d: buildWavePath(
      size.width,
      size.height,
      surface.value.y - 2,
      surface.value.amplitude * 0.85,
      -phase.value,
      2.1
    ),
    fill: interpolateColor(alertIndex.value, [0, 1, 2, 3], surfaceColors),
  }));
  const waterGroupProps = useAnimatedProps(() => ({ opacity: waterOpacity.value }));

  const beamProps = useAnimatedProps(() => ({
    d: `M ${centerX} ${sensorOriginY} L ${centerX} ${surfaceY.value}`,
    strokeOpacity: 0.45 * sensorVisibility.value,
  }));
  const echoProps = useAnimatedProps(() => ({
    d: `M ${centerX - 9} ${surfaceY.value} L ${centerX + 9} ${surfaceY.value}`,
    strokeOpacity: 0.9 * sensorVisibility.value,
  }));

  /** Distancia medida: a mitad del haz, a la derecha. */
  const distanceTagStyle = useAnimatedStyle(() => ({
    opacity: sensorVisibility.value,
    transform: [{ translateY: (sensorOriginY + surfaceY.value) / 2 - 10 }],
  }));
  /** Nombre del nivel: justo debajo de la superficie, a la izquierda del haz. */
  const alertTagStyle = useAnimatedStyle(() => ({
    opacity: sensorVisibility.value,
    transform: [{ translateY: Math.min(surfaceY.value + 12, size.height - 30) }],
  }));

  const isDraggable = Boolean(onLevelChange);

  /**
   * Arrastre vertical sobre el tanque: el agua sigue al dedo y el nivel se
   * publica a la fuente simulada, como si lo midiera el sensor.
   */
  const panResponder = useMemo(() => {
    const finish = () => {
      setIsDragging(false);
      onLevelChange?.(level.get());
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => isDraggable,
      onMoveShouldSetPanResponder: () => isDraggable,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        cancelAnimation(level);
        dragStart.set(level.get());
        dragEmitted.set(level.get());
        setIsDragging(true);
        onDragStart?.();
      },
      onPanResponderMove: (_, gesture) => {
        const next = clampLevelPercent(dragStart.get() - (gesture.dy / travel) * 100);
        level.set(next);
        if (Math.abs(next - dragEmitted.get()) >= DRAG_EMIT_STEP_PERCENT) {
          dragEmitted.set(next);
          onLevelChange?.(next);
        }
      },
      onPanResponderRelease: finish,
      onPanResponderTerminate: finish,
    });
  }, [isDraggable, level, dragStart, dragEmitted, travel, onLevelChange, onDragStart]);

  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    const step =
      event.nativeEvent.actionName === 'increment'
        ? ACCESSIBILITY_STEP_PERCENT
        : -ACCESSIBILITY_STEP_PERCENT;
    onLevelChange?.(clampLevelPercent(levelPercent + step));
  };

  const lidWidth = size.width * 0.5;
  const lidHeight = size.height * LID_BOTTOM + 2;

  // Módulo del sensor (HC-SR04) visto desde arriba, sobre la tapa.
  const moduleWidth = lidWidth * 0.46;
  const moduleHeight = lidHeight * 0.66;
  const moduleY = 0.5 + (lidHeight - moduleHeight) / 2;
  const transducerRadius = moduleHeight * 0.4;
  const transducerY = moduleY + moduleHeight / 2;

  const alertLabel = alert ? LEVEL_ALERT_LABELS[alert] : null;
  const alertColor = {
    critical: theme.critical,
    low: theme.caution,
    ok: theme.accentText,
    full: theme.positive,
  }[alert ?? 'ok'];

  return (
    <View
      accessible
      accessibilityLabel={`Nivel del tanque: ${Math.round(levelPercent)} por ciento${
        alertLabel ? `, ${alertLabel}` : ''
      }`}
      accessibilityRole={isDraggable ? 'adjustable' : undefined}
      accessibilityActions={
        isDraggable ? [{ name: 'increment' }, { name: 'decrement' }] : undefined
      }
      onAccessibilityAction={handleAccessibilityAction}
      style={{ width: size.width, height: size.height + SHADOW_SPACE }}
      {...panResponder.panHandlers}>
      <Svg width={size.width} height={size.height + SHADOW_SPACE}>
        <Defs>
          <ClipPath id="tankBodyClip">
            <Path d={bodyPath} />
          </ClipPath>

          {/* Sombreado cilíndrico: brillo a la izquierda, bordes más oscuros. */}
          <LinearGradient id="tankShading" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={theme.tankInnerShadow} stopOpacity={1} />
            <Stop offset="0.16" stopColor={theme.glassHighlight} stopOpacity={0.45} />
            <Stop offset="0.36" stopColor={theme.glassHighlight} stopOpacity={0} />
            <Stop offset="0.8" stopColor={theme.tankInnerShadow} stopOpacity={0} />
            <Stop offset="1" stopColor={theme.tankInnerShadow} stopOpacity={1} />
          </LinearGradient>

          {/* Profundidad: el fondo del agua siempre se ve más oscuro. */}
          <LinearGradient
            id="waterDepth"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1={size.height * 0.6}
            x2="0"
            y2={size.height}>
            <Stop offset="0" stopColor={theme.waterDepth} stopOpacity={0} />
            <Stop offset="1" stopColor={theme.waterDepth} stopOpacity={1} />
          </LinearGradient>

          <RadialGradient id="groundShadow" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={theme.tankShadow} stopOpacity={1} />
            <Stop offset="1" stopColor={theme.tankShadow} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        {/* Sombra de apoyo. */}
        <Ellipse
          cx={size.width / 2}
          cy={size.height + 2}
          rx={size.width * 0.54}
          ry={SHADOW_SPACE * 0.85}
          fill="url(#groundShadow)"
        />

        {/* Cuerpo vacío. */}
        <Path d={bodyPath} fill={theme.glassTint} />

        {/* Agua: recortada contra el cuerpo, así sigue la forma del cono. */}
        <G clipPath="url(#tankBodyClip)">
          <AnimatedG animatedProps={waterGroupProps}>
            <AnimatedPath animatedProps={backWaveProps} opacity={0.6} />
            <AnimatedPath animatedProps={frontWaveProps} />
            <AnimatedPath animatedProps={depthProps} fill="url(#waterDepth)" />
          </AnimatedG>

          {/* Haz del sensor: de la tapa a la superficie, con el eco al llegar. */}
          <AnimatedPath
            animatedProps={beamProps}
            stroke={theme.sensorBeam}
            strokeWidth={1.2}
            strokeDasharray="3 5"
            fill="none"
          />
          {Array.from({ length: PULSE_COUNT }, (_, index) => (
            <SensorPulse
              key={index}
              index={index}
              clock={pulseClock}
              surfaceY={surfaceY}
              originY={sensorOriginY}
              centerX={centerX}
              visibility={sensorVisibility}
              color={theme.sensorBeam}
            />
          ))}
          <AnimatedPath
            animatedProps={echoProps}
            stroke={theme.sensorBeam}
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
          />

          <Rect width={size.width} height={size.height} fill="url(#tankShading)" />

          {/* Refuerzos del cuerpo: una canaleta oscura con su reflejo debajo. */}
          {ribPaths.map((d) => (
            <G key={d}>
              <Path d={d} stroke={theme.tankStroke} strokeWidth={2.5} fill="none" />
              <Path
                d={d}
                stroke={theme.glassHighlight}
                strokeWidth={1.2}
                strokeOpacity={0.7}
                fill="none"
                transform="translate(0, 2.4)"
              />
            </G>
          ))}
        </G>

        {/* Borde del cuerpo. */}
        <Path d={bodyPath} fill="none" stroke={theme.tankStroke} strokeWidth={1} />

        {/* Tapa. */}
        <Rect
          x={(size.width - lidWidth) / 2}
          y={0.5}
          width={lidWidth}
          height={lidHeight}
          rx={size.width * 0.025}
          fill={theme.glassTint}
          stroke={theme.tankStroke}
          strokeWidth={1}
        />
        <Rect
          x={(size.width - lidWidth) / 2}
          y={0.5}
          width={lidWidth}
          height={lidHeight}
          rx={size.width * 0.025}
          fill="url(#tankShading)"
        />

        {/* Sensor ultrasónico montado en la tapa. */}
        <Rect
          x={centerX - moduleWidth / 2}
          y={moduleY}
          width={moduleWidth}
          height={moduleHeight}
          rx={3}
          fill={theme.sensorBody}
        />
        {[-1, 1].map((side) => (
          <G key={side}>
            <Circle
              cx={centerX + side * moduleWidth * 0.26}
              cy={transducerY}
              r={transducerRadius}
              fill={theme.sensorTransducer}
              stroke={theme.tankStroke}
              strokeWidth={1}
            />
            <Circle
              cx={centerX + side * moduleWidth * 0.26}
              cy={transducerY}
              r={transducerRadius * 0.55}
              fill={theme.textSecondary}
              opacity={0.55}
            />
          </G>
        ))}
      </Svg>

      {distanceCm !== null && (
        <Animated.View
          pointerEvents="none"
          style={[styles.tag, { left: centerX + 12 }, distanceTagStyle]}>
          <View style={[styles.tagSurface, { backgroundColor: theme.glassSurface }]}>
            <ThemedText type="caption" themeColor="textSecondary" style={styles.tagText}>
              {Math.round(distanceCm)} cm
            </ThemedText>
          </View>
        </Animated.View>
      )}

      {alertLabel && (
        <Animated.View
          pointerEvents="none"
          style={[styles.tag, { right: size.width - centerX + 12 }, alertTagStyle]}>
          <View style={[styles.tagSurface, { backgroundColor: theme.glassSurface }]}>
            <View style={[styles.tagDot, { backgroundColor: alertColor }]} />
            <ThemedText type="caption" style={[styles.tagText, { color: alertColor }]}>
              {alertLabel.toUpperCase()}
            </ThemedText>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    position: 'absolute',
    top: 0,
  },
  tagSurface: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  tagDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  tagText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
    fontVariant: ['tabular-nums'],
  },
});
