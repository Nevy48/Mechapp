import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import type { ControlNotice as ControlNoticeData } from '@/data/tank';
import { useTheme } from '@/hooks/use-theme';

export type ControlNoticeProps = {
  notice: ControlNoticeData;
  /** Acción opcional (por ejemplo, reiniciar el equipo simulado). */
  actionLabel?: string;
  onAction?: () => void;
};

/**
 * Aviso destacado del control de llenado: cisterna vacía, falla o bloqueo.
 * Es lo primero que tiene que ver el usuario cuando algo no anda.
 */
export function ControlNotice({ notice, actionLabel, onAction }: ControlNoticeProps) {
  const theme = useTheme();
  const color = notice.tone === 'critical' ? theme.critical : theme.caution;
  const background = notice.tone === 'critical' ? theme.criticalSoft : theme.cautionSoft;

  return (
    <View
      style={[styles.container, { backgroundColor: background }]}
      accessibilityRole="alert"
      accessibilityLabel={`${notice.title}. ${notice.message}`}>
      <View style={[styles.bar, { backgroundColor: color }]} />
      <View style={styles.text}>
        <ThemedText type="default" style={[styles.title, { color }]}>
          {notice.title}
        </ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          {notice.message}
        </ThemedText>
      </View>
      {actionLabel && onAction ? (
        <PressableScale
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={[styles.action, { borderColor: color }]}>
          <ThemedText type="caption" style={[styles.actionLabel, { color }]}>
            {actionLabel}
          </ThemedText>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingRight: 12,
    paddingLeft: 12,
    borderRadius: Radius.md,
  },
  bar: {
    alignSelf: 'stretch',
    width: 3,
    borderRadius: 2,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontWeight: '600',
    lineHeight: 20,
  },
  action: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  actionLabel: {
    fontWeight: '600',
  },
});
