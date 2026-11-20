import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { LEVEL_FULL_PERCENT, LEVEL_LOW_PERCENT } from '@/constants/config';
import { useTheme } from '@/hooks/use-theme';
import type { HistoryPoint } from '@/providers/tank-provider';

const HEIGHT = 180;
const PAD_LEFT = 30;
const PAD_RIGHT = 8;
const PAD_TOP = 8;
const PAD_BOTTOM = 8;
/** Ventana mínima del eje X, para que pocos puntos no queden estirados. */
const MIN_SPAN_MS = 60_000;

export type LevelChartProps = {
  points: HistoryPoint[];
};

/**
 * Nivel del tanque en el tiempo. Las franjas marcan cuándo estuvo encendida
 * la bomba y las líneas punteadas, los umbrales de arranque y corte.
 */
export function LevelChart({ points }: LevelChartProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  if (points.length < 2) {
    return (
      <View style={[styles.empty, { borderColor: theme.hairline }]}>
        <ThemedText type="caption" themeColor="textTertiary">
          Juntando mediciones… el gráfico aparece en unos segundos.
        </ThemedText>
      </View>
    );
  }

  const end = points[points.length - 1].timestamp;
  const start = Math.min(points[0].timestamp, end - MIN_SPAN_MS);
  const span = Math.max(1, end - start);
  const plotW = Math.max(0, width - PAD_LEFT - PAD_RIGHT);
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const x = (t: number) => PAD_LEFT + ((t - start) / span) * plotW;
  const y = (level: number) => PAD_TOP + (1 - level / 100) * plotH;

  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.timestamp).toFixed(1)},${y(p.levelPercent).toFixed(1)}`)
    .join(' ');
  const area = `${line} L${x(end).toFixed(1)},${y(0)} L${x(points[0].timestamp).toFixed(1)},${y(0)} Z`;

  // Franjas con la bomba encendida.
  const pumpBands: { from: number; to: number }[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    if (!points[i].pumpOn) continue;
    const last = pumpBands[pumpBands.length - 1];
    if (last && last.to === points[i].timestamp) last.to = points[i + 1].timestamp;
    else pumpBands.push({ from: points[i].timestamp, to: points[i + 1].timestamp });
  }

  return (
    <View onLayout={onLayout} style={styles.container}>
      {width > 0 && (
        <Svg width={width} height={HEIGHT}>
          <Defs>
            <LinearGradient id="levelArea" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={theme.water} stopOpacity={0.28} />
              <Stop offset="1" stopColor={theme.water} stopOpacity={0.02} />
            </LinearGradient>
          </Defs>

          {pumpBands.map((band) => (
            <Rect
              key={band.from}
              x={x(band.from)}
              y={PAD_TOP}
              width={Math.max(2, x(band.to) - x(band.from))}
              height={plotH}
              fill={theme.accentSoft}
            />
          ))}

          {[0, 50, 100].map((v) => (
            <SvgText
              key={v}
              x={PAD_LEFT - 6}
              y={y(v) + 4}
              fontSize={10}
              fill={theme.textTertiary}
              textAnchor="end">
              {`${v}%`}
            </SvgText>
          ))}
          <Line x1={PAD_LEFT} x2={PAD_LEFT + plotW} y1={y(0)} y2={y(0)} stroke={theme.hairline} strokeWidth={1} />

          {[LEVEL_LOW_PERCENT, LEVEL_FULL_PERCENT].map((v) => (
            <Line
              key={v}
              x1={PAD_LEFT}
              x2={PAD_LEFT + plotW}
              y1={y(v)}
              y2={y(v)}
              stroke={v === LEVEL_LOW_PERCENT ? theme.caution : theme.positive}
              strokeWidth={1}
              strokeDasharray="4 4"
              opacity={0.7}
            />
          ))}

          <Path d={area} fill="url(#levelArea)" />
          <Path d={line} stroke={theme.water} strokeWidth={2} fill="none" strokeLinejoin="round" />
        </Svg>
      )}

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]} />
          <ThemedText type="caption" themeColor="textTertiary">
            Bomba encendida
          </ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dash, { backgroundColor: theme.caution }]} />
          <ThemedText type="caption" themeColor="textTertiary">
            Arranque {LEVEL_LOW_PERCENT}%
          </ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dash, { backgroundColor: theme.positive }]} />
          <ThemedText type="caption" themeColor="textTertiary">
            Corte {LEVEL_FULL_PERCENT}%
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  empty: {
    height: HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    borderStyle: 'dashed',
    paddingHorizontal: 24,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  swatch: {
    width: 12,
    height: 10,
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dash: {
    width: 14,
    height: 2,
    borderRadius: 1,
  },
});
