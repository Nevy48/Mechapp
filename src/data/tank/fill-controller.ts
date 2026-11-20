import { FILL_CONTROL, LEVEL_FULL_PERCENT, LEVEL_HYSTERESIS_PERCENT, LEVEL_LOW_PERCENT } from '@/constants/config';

import type { FillControlState, FillFault, FillState } from './types';

export interface FillControllerInput {
  now: number;
  levelPercent: number;
  sensorOk: boolean;
  /** Lectura cruda del automático de la cisterna (sin antirrebote). */
  cisternRaw: boolean;
}

export type FillControllerConfig = { [K in keyof typeof FILL_CONTROL]: number } & {
  lowPercent: number;
  fullPercent: number;
  hysteresisPercent: number;
};

export const DEFAULT_FILL_CONFIG: FillControllerConfig = {
  ...FILL_CONTROL,
  lowPercent: LEVEL_LOW_PERCENT,
  fullPercent: LEVEL_FULL_PERCENT,
  hysteresisPercent: LEVEL_HYSTERESIS_PERCENT,
};

/**
 * Máquina de estados del control de llenado.
 *
 * Es un port directo de `controlLlenado()` del firmware (control_llenado.ino):
 * misma lógica, mismos estados y mismos tiempos. El simulador la usa para que
 * la app se comporte igual que el equipo real.
 *
 * - Arranca la bomba con nivel ≤ bajo, sólo si la cisterna confirma agua.
 * - Corta al llegar a lleno, si la cisterna se queda sin agua o si falla el sensor.
 * - Exige que el nivel suba durante el llenado (si no, falla "sin caudal").
 * - Reintenta después de una falla y se bloquea tras varias seguidas.
 */
export class FillController {
  private state: FillState = 'idle';
  private fault: FillFault | null = null;
  private pumpOn = false;

  private cisternStable = false;
  private cisternLastRaw: boolean | null = null;
  private cisternChangedAt = 0;

  private offSince = Number.NEGATIVE_INFINITY;
  private fillStartedAt = 0;
  private lastVerifyAt = 0;
  private levelAtLastVerify = 0;
  private faultAt = 0;
  private consecutiveFaults = 0;
  private sensorOk = true;

  constructor(private readonly config: FillControllerConfig = DEFAULT_FILL_CONFIG) {}

  /** Equivale a apretar el botón de reset del Arduino. */
  reset(now: number): void {
    this.state = 'idle';
    this.fault = null;
    this.pumpOn = false;
    this.offSince = now - this.config.minOffMs;
    this.consecutiveFaults = 0;
  }

  update(input: FillControllerInput): FillControlState {
    this.sensorOk = input.sensorOk;
    this.updateCistern(input.now, input.cisternRaw);
    this.step(input.now, input.levelPercent);
    return this.snapshot();
  }

  snapshot(): FillControlState {
    return {
      pumpOn: this.pumpOn,
      cisternHasWater: this.cisternStable,
      fillState: this.state,
      fault: this.fault,
      sensorOk: this.sensorOk,
    };
  }

  private updateCistern(now: number, raw: boolean): void {
    if (this.cisternLastRaw === null) {
      // Primera lectura: se toma tal cual (el firmware la confirma después
      // del antirrebote; en el simulador no tiene sentido mostrar 2 s de
      // "cisterna vacía" al abrir la app).
      this.cisternLastRaw = raw;
      this.cisternChangedAt = now;
      this.cisternStable = raw;
      return;
    }
    if (raw !== this.cisternLastRaw) {
      this.cisternLastRaw = raw;
      this.cisternChangedAt = now;
    }
    if (now - this.cisternChangedAt >= this.config.cisternDebounceMs) {
      this.cisternStable = raw;
    }
  }

  private startPump(now: number, level: number): void {
    this.pumpOn = true;
    this.fillStartedAt = now;
    this.lastVerifyAt = now;
    this.levelAtLastVerify = level;
    this.fault = null;
    this.state = 'filling';
  }

  private stopPump(now: number, next: FillState, fault: FillFault | null = null): void {
    this.pumpOn = false;
    this.offSince = now;
    if (next === 'fault') {
      this.fault = fault;
      this.faultAt = now;
      this.consecutiveFaults += 1;
      if (this.consecutiveFaults >= this.config.maxRetries) next = 'locked';
    }
    this.state = next;
  }

  private step(now: number, level: number): void {
    const c = this.config;
    const minOffElapsed = now - this.offSince >= c.minOffMs;

    switch (this.state) {
      case 'idle':
        if (this.sensorOk && level <= c.lowPercent && minOffElapsed) {
          if (this.cisternStable) this.startPump(now, level);
          else this.state = 'waitingCistern';
        }
        return;

      case 'waitingCistern':
        if (this.sensorOk && level > c.lowPercent + c.hysteresisPercent) {
          this.state = 'idle';
          return;
        }
        if (this.sensorOk && this.cisternStable && minOffElapsed) this.startPump(now, level);
        return;

      case 'filling':
        if (!this.sensorOk) return this.stopPump(now, 'fault', 'sensor');
        if (!this.cisternStable) return this.stopPump(now, 'waitingCistern');
        if (level >= c.fullPercent) {
          this.consecutiveFaults = 0;
          return this.stopPump(now, 'idle');
        }
        if (now - this.fillStartedAt >= c.maxFillMs) return this.stopPump(now, 'fault', 'timeout');
        if (now - this.lastVerifyAt >= c.verifyIntervalMs) {
          if (level - this.levelAtLastVerify < c.minRisePercent) {
            return this.stopPump(now, 'fault', 'noFlow');
          }
          this.levelAtLastVerify = level;
          this.lastVerifyAt = now;
        }
        return;

      case 'fault':
        if (now - this.faultAt >= c.retryDelayMs) this.state = 'idle';
        return;

      case 'locked':
        return;
    }
  }
}
