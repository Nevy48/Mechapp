import {
  FILL_SIMULATION_DURATION_MS,
  FILL_SIMULATION_EMPTY_HOLD_MS,
  FILL_SIMULATION_UPDATE_INTERVAL_MS,
  MOCK_INITIAL_LEVEL_PERCENT,
  MOCK_UPDATE_INTERVAL_MS,
  SENSOR_DISTANCE_EMPTY_CM,
  SENSOR_DISTANCE_FULL_CM,
} from '@/constants/config';

import {
  clampLevelPercent,
  type ConnectionStatus,
  type TankDataSource,
  type TankReading,
  type TankSourceEvent,
} from './types';

/**
 * Nivel simulado en función del tiempo transcurrido.
 *
 * Es una suma de senos con períodos largos: el nivel sube y baja de forma
 * gradual (nunca hay saltos) y permanece siempre dentro de un rango acotado.
 */
export function simulateLevelPercent(elapsedMs: number): number {
  const seconds = elapsedMs / 1000;
  const swell = -5.5 * Math.sin((2 * Math.PI * seconds) / 420);
  const ripple = 3.2 * Math.sin((2 * Math.PI * seconds) / 900);
  return clampLevelPercent(MOCK_INITIAL_LEVEL_PERCENT + swell + ripple + sensorJitter(elapsedMs));
}

/** Ruido leve del sensor: unas décimas, nunca saltos. */
function sensorJitter(elapsedMs: number): number {
  const seconds = elapsedMs / 1000;
  return 0.12 * Math.sin(seconds * 1.7) + 0.06 * Math.sin(seconds * 0.63 + 2.1);
}

/**
 * Nivel durante la simulación de llenado.
 *
 * Arranca con el tanque vacío unos segundos y después se llena. El llenado
 * se desacelera al final, como cuando el flotante va cerrando la entrada.
 */
export function simulateFillLevelPercent(elapsedMs: number): number {
  const fillingMs = elapsedMs - FILL_SIMULATION_EMPTY_HOLD_MS;
  if (fillingMs <= 0) return 0;

  const progress = Math.min(1, fillingMs / FILL_SIMULATION_DURATION_MS);
  const eased = 1 - Math.pow(1 - progress, 1.6);
  return clampLevelPercent(eased * 100 + (progress < 1 ? sensorJitter(elapsedMs) * 2 : 0));
}

/**
 * Distancia a la superficie del agua que "mediría" el sensor en ese nivel.
 * Es la inversa de la fórmula del firmware: nivel = (dMax - d) / (dMax - dMin).
 */
export function simulateDistanceCm(levelPercent: number): number {
  const span = SENSOR_DISTANCE_EMPTY_CM - SENSOR_DISTANCE_FULL_CM;
  const distance = SENSOR_DISTANCE_EMPTY_CM - (clampLevelPercent(levelPercent) / 100) * span;
  return Math.round(distance * 10) / 10;
}

/**
 * Fuente de datos simulada.
 *
 * Reemplaza al ESP32 durante el prototipo. Publica mediciones graduales y
 * permite cortar la conexión a propósito para poder verificar el estado
 * "sin conexión" de la app.
 */
export class MockTankSource implements TankDataSource {
  readonly mode = 'simulated' as const;
  readonly isAvailable = true;

  private listeners = new Set<(event: TankSourceEvent) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private startedAt = 0;
  private online = true;
  /** Inicio de la simulación de llenado en curso, o `null` si no hay ninguna. */
  private fillStartedAt: number | null = null;
  /** Nivel en el que quedó el tanque al terminar o detener una simulación. */
  private heldLevel: number | null = null;
  private lastLevel = MOCK_INITIAL_LEVEL_PERCENT;
  private status: ConnectionStatus = 'connecting';

  subscribe(listener: (event: TankSourceEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  start(): void {
    if (this.timer) return;

    this.startedAt = Date.now();
    this.online = true;
    this.setStatus('connecting');
    this.publishReading();
    this.setStatus('connected');
    this.startTimer(MOCK_UPDATE_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.fillStartedAt = null;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.listeners.clear();
  }

  /**
   * Corta o restablece la conexión simulada.
   * Al reconectar se anuncia "Reconectando…" antes de volver a publicar datos.
   */
  setSimulatedOnline(online: boolean): void {
    if (online === this.online) return;
    this.online = online;

    if (!online) {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.setStatus('disconnected', 'Sensor sin conexión');
      return;
    }

    this.setStatus('connecting');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.online) return;
      this.setStatus('connected');
      this.publishReading();
    }, 1600);
  }

  /** Vacía el tanque y lo llena de a poco, para mostrar la app en vivo. */
  startFillSimulation(): void {
    this.fillStartedAt = Date.now();
    this.heldLevel = null;
    this.emit({ type: 'simulation', running: true });
    this.startTimer(FILL_SIMULATION_UPDATE_INTERVAL_MS);
    if (this.online) this.publishReading();
  }

  /**
   * Fija el nivel a mano (arrastrando el agua en el tanque). Corta la
   * simulación de llenado si estaba corriendo y publica la medición al toque.
   */
  setManualLevel(levelPercent: number): void {
    const level = clampLevelPercent(levelPercent);
    if (this.fillStartedAt !== null) {
      this.finishFillSimulation(level);
    }
    this.heldLevel = level;
    if (this.online) this.publishReading();
  }

  /** Corta la simulación: el tanque queda en el nivel al que había llegado. */
  stopFillSimulation(): void {
    if (this.fillStartedAt === null) return;
    this.finishFillSimulation(this.lastLevel);
  }

  private finishFillSimulation(level: number): void {
    this.fillStartedAt = null;
    this.heldLevel = level;
    this.emit({ type: 'simulation', running: false });
    this.startTimer(MOCK_UPDATE_INTERVAL_MS);
  }

  private startTimer(intervalMs: number): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (!this.online) return;
      this.publishReading();
    }, intervalMs);
  }

  private nextLevel(now: number): number {
    if (this.fillStartedAt !== null) {
      const elapsed = now - this.fillStartedAt;
      const level = simulateFillLevelPercent(elapsed);
      if (elapsed >= FILL_SIMULATION_EMPTY_HOLD_MS + FILL_SIMULATION_DURATION_MS) {
        this.finishFillSimulation(level);
      }
      return level;
    }
    if (this.heldLevel !== null) {
      return clampLevelPercent(this.heldLevel + sensorJitter(now - this.startedAt));
    }
    return simulateLevelPercent(now - this.startedAt);
  }

  private publishReading(): void {
    const levelPercent = this.nextLevel(Date.now());
    this.lastLevel = levelPercent;
    const reading: TankReading = {
      levelPercent,
      distanceCm: simulateDistanceCm(levelPercent),
      timestamp: Date.now(),
    };
    this.emit({ type: 'reading', reading });
  }

  private setStatus(status: ConnectionStatus, detail?: string): void {
    if (this.status === status) return;
    this.status = status;
    this.emit({ type: 'status', status, detail });
  }

  private emit(event: TankSourceEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }
}
