import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { GlassSurface } from '@/components/glass-surface';
import { LevelChart } from '@/components/level-chart';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import type { EventTone, TankEvent } from '@/data/tank';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { type HistoryPoint, useTank } from '@/providers/tank-provider';
import { formatClock, formatDuration, formatElapsed } from '@/utils/format';

function BackIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        d="M15 5 L8 12 L15 19"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/** Resumen de la sesión a partir del historial y los eventos. */
function summarize(history: HistoryPoint[], events: TankEvent[]) {
  let pumpMs = 0;
  for (let i = 0; i < history.length - 1; i += 1) {
    if (history[i].pumpOn) pumpMs += history[i + 1].timestamp - history[i].timestamp;
  }
  const min = history.length ? Math.min(...history.map((p) => p.levelPercent)) : null;
  return {
    fills: events.filter((e) => e.title === 'Bomba encendida').length,
    faults: events.filter((e) => e.tone === 'critical' && e.title !== 'Nivel crítico').length,
    pumpMs,
    min,
  };
}

function Stat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: theme.surface, borderColor: theme.hairline }]}>
      <ThemedText type="label" themeColor="textTertiary">
        {label}
      </ThemedText>
      <ThemedText type="headline">{value}</ThemedText>
    </View>
  );
}

function EventRow({ event, now }: { event: TankEvent; now: number }) {
  const theme = useTheme();
  const tones: Record<EventTone, string> = {
    info: theme.accent,
    positive: theme.positive,
    caution: theme.caution,
    critical: theme.critical,
  };
  return (
    <View style={[styles.event, { borderColor: theme.hairline }]}>
      <View style={[styles.eventDot, { backgroundColor: tones[event.tone] }]} />
      <View style={styles.eventText}>
        <ThemedText type="default" style={styles.eventTitle}>
          {event.title}
        </ThemedText>
        {event.detail ? (
          <ThemedText type="caption" themeColor="textSecondary">
            {event.detail}
          </ThemedText>
        ) : null}
      </View>
      <View style={styles.eventTime}>
        <ThemedText type="caption" themeColor="textSecondary">
          {formatClock(event.timestamp)}
        </ThemedText>
        <ThemedText type="caption" themeColor="textTertiary">
          {formatElapsed(event.timestamp, now)}
        </ThemedText>
      </View>
    </View>
  );
}

export default function HistoryScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const now = useNow(5000);
  const { history, events, mode, clearEvents } = useTank();
  const stats = summarize(history, events);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <PressableScale
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={styles.backButton}>
          <GlassSurface style={styles.backSurface}>
            <BackIcon color={theme.text} />
          </GlassSurface>
        </PressableScale>
        <ThemedText type="headline">Historial</ThemedText>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}>
        <ThemedText type="caption" themeColor="textTertiary">
          {mode === 'simulated' ? 'Datos de la simulación' : 'Datos del equipo'} de esta sesión. Se
          borran al cerrar la app o cambiar de modo.
        </ThemedText>

        <View style={styles.section}>
          <ThemedText type="label" themeColor="textTertiary">
            Nivel del tanque
          </ThemedText>
          <LevelChart points={history} />
        </View>

        <View style={styles.stats}>
          <Stat label="Llenados" value={String(stats.fills)} />
          <Stat label="Bomba" value={formatDuration(stats.pumpMs)} />
          <Stat label="Mínimo" value={stats.min === null ? '—' : `${Math.round(stats.min)}%`} />
          <Stat label="Fallas" value={String(stats.faults)} />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText type="label" themeColor="textTertiary">
              Eventos
            </ThemedText>
            {events.length > 0 && (
              <PressableScale onPress={clearEvents} accessibilityRole="button" accessibilityLabel="Borrar eventos">
                <ThemedText type="caption" themeColor="accentText" style={styles.clear}>
                  Borrar
                </ThemedText>
              </PressableScale>
            )}
          </View>

          {events.length === 0 ? (
            <ThemedText type="caption" themeColor="textTertiary">
              Todavía no pasó nada. Acá aparecen los arranques y cortes de la bomba, los cambios de la
              cisterna, las alertas de nivel y las fallas.
            </ThemedText>
          ) : (
            <View>
              {events.map((event) => (
                <EventRow key={event.id} event={event} now={now} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
  },
  backSurface: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
    gap: 22,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clear: {
    fontWeight: '600',
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  stat: {
    flexGrow: 1,
    flexBasis: '45%',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  event: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  eventDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 8,
  },
  eventText: {
    flex: 1,
    gap: 2,
  },
  eventTitle: {
    fontWeight: '600',
    lineHeight: 22,
  },
  eventTime: {
    alignItems: 'flex-end',
    gap: 2,
  },
});
