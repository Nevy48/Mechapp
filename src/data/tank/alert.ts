import {
  LEVEL_CRITICAL_PERCENT,
  LEVEL_FULL_PERCENT,
  LEVEL_HYSTERESIS_PERCENT,
  LEVEL_LOW_PERCENT,
} from '@/constants/config';

/** Estado de alerta del nivel: el mismo que publica el firmware en `alerta`. */
export type LevelAlert = 'critical' | 'low' | 'ok' | 'full';

/** Nombres cortos, como en el firmware (CRITICO, BAJO, OK, LLENO). */
export const LEVEL_ALERT_LABELS: Record<LevelAlert, string> = {
  critical: 'Crítico',
  low: 'Bajo',
  ok: 'OK',
  full: 'Lleno',
};

/**
 * Estado de alerta para un nivel. Port de `calcularEstado()` del firmware:
 * para salir del estado actual, el nivel tiene que cruzar el umbral más la
 * histéresis.
 */
export function getLevelAlert(levelPercent: number, current: LevelAlert | null): LevelAlert {
  let critical = LEVEL_CRITICAL_PERCENT;
  let low = LEVEL_LOW_PERCENT;
  let full = LEVEL_FULL_PERCENT;
  if (current === 'critical') critical += LEVEL_HYSTERESIS_PERCENT;
  if (current === 'low') low += LEVEL_HYSTERESIS_PERCENT;
  if (current === 'full') full -= LEVEL_HYSTERESIS_PERCENT;

  if (levelPercent < critical) return 'critical';
  if (levelPercent < low) return 'low';
  if (levelPercent >= full) return 'full';
  return 'ok';
}
