import {
  MOCK_INITIAL_LEVEL_PERCENT,
  MOCK_UPDATE_INTERVAL_MS,
  SENSOR_DISTANCE_EMPTY_CM,
  SENSOR_DISTANCE_FULL_CM,
  SIM_CONSUMPTION_PERCENT_PER_S,
  SIM_DRAIN_PERCENT_PER_S,
  SIM_DRAIN_TARGET_PERCENT,
  SIM_PUMP_RATE_PERCENT_PER_S,
  SIM_TICK_MS,
} from '@/constants/config';

import { DEFAULT_FILL_CONFIG, FillController } from './fill-controller';
import {
  clampLevelPercent,
  type ConnectionStatus,
  type FillControlState,
  type SimulationControls,
  type TankDataSource,
  type TankReading,
  type TankSourceEvent,
} from './types';

/** Ruido leve del sensor: unas décimas, nunca saltos. */
export function sensorJitter(elapsedMs: number): number {
  const seconds = elapsedMs / 1000;
  return 0.12 * Math.sin(seconds * 1.7) + 0.06 * Math.sin(seconds * 0.63 + 2.1);
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
 * Cuánto cambia el nivel en un paso de simulación.
 *
 * La casa consume siempre un poco; el botón "Vaciar" simula un consumo fuerte.
 * La bomba sólo sube agua si la cisterna tiene agua y no hay falla simulada.
 */
export function simulateLevelDelta(options: {
  dtMs: number;
  pumpOn: boolean;
  cisternHasWater: boolean;
  pumpFailure: boolean;
  draining: boolean;
}): number {
  const seconds = options.dtMs / 1000;
  const consumption = options.draining ? SIM_DRAIN_PERCENT_PER_S : SIM_CONSUMPTION_PERCENT_PER_S;
  const pumping =
    options.pumpOn && options.cisternHasWater && !options.pumpFailure
      ? SIM_PUMP_RATE_PERCENT_PER_S
      : 0;
  return (pumping - consumption) * seconds;
}

/**
 * Fuente de datos simulada.
 *
 * Reemplaza al equipo real durante el prototipo. Simula el tanque, la cisterna
 * y la bomba, y corre la misma máquina de estados que el firmware, así la app
 * muestra exactamente lo que vería con el Arduino: arranque y corte de la
 * bomba, espera por cisterna vacía, fallas y bloqueo.
 */
export class MockTankSource implements TankDataSource {
  readonly mode = 'simulated' as const;
  readonly isAvailable = true;

  private listeners = new Set<(event: TankSourceEvent) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private startedAt = 0;
  private lastTickAt = 0;
  private lastPublishAt = 0;
  private online = true;
  private status: ConnectionStatus = 'connecting';

  /** Nivel "real" del agua (sin el ruido del sensor). */
  private level = MOCK_INITIAL_LEVEL_PERCENT;
  private draining = false;
  private controls: SimulationControls = { cisternHasWater: true, pumpFailure: false };
  /**
   * Sin antirrebote de la cisterna: en el simulador el cambio lo hace el
   * usuario a mano, así que se aplica al instante.
   */
  private controller = new FillController({ ...DEFAULT_FILL_CONFIG, cisternDebounceMs: 0 });
  private control: FillControlState = this.controller.snapshot();

  subscribe(listener: (event: TankSourceEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  start(): void {
    if (this.timer) return;

    const now = Date.now();
    this.startedAt = now;
    this.lastTickAt = now;
    this.online = true;
    this.controller.reset(now);
    this.setStatus('connecting');
    this.emit({ type: 'simulationControls', controls: this.controls });
    this.tick(true);
    this.setStatus('connected');
    this.timer = setInterval(() => this.tick(false), SIM_TICK_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.listeners.clear();
  }

  /**
   * Corta o restablece la conexión simulada. El tanque y la bomba siguen
   * funcionando: sólo se dejan de recibir datos, como pasaría con el Wi-Fi.
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

  /** Simula un consumo fuerte: el tanque baja rápido y el control tiene que llenarlo. */
  startDrain(): void {
    this.draining = true;
    this.emit({ type: 'simulation', running: true });
  }

  stopDrain(): void {
    if (!this.draining) return;
    this.draining = false;
    this.emit({ type: 'simulation', running: false });
  }

  /** Fija el nivel a mano (arrastrando el agua en el tanque). */
  setManualLevel(levelPercent: number): void {
    this.stopDrain();
    this.level = clampLevelPercent(levelPercent);
    this.tick(true);
  }

  setCisternWater(hasWater: boolean): void {
    this.setControls({ ...this.controls, cisternHasWater: hasWater });
    // Se recalcula ya, sin esperar al próximo paso de la simulación.
    this.tick(true);
  }

  setPumpFailure(failure: boolean): void {
    this.setControls({ ...this.controls, pumpFailure: failure });
  }

  /** Equivale al botón de reset del Arduino: sale del bloqueo. */
  resetController(): void {
    this.controller.reset(Date.now());
    this.tick(true);
  }

  private setControls(controls: SimulationControls): void {
    this.controls = controls;
    this.emit({ type: 'simulationControls', controls });
  }

  private tick(forcePublish: boolean): void {
    const now = Date.now();
    const dtMs = Math.min(5000, Math.max(0, now - this.lastTickAt));
    this.lastTickAt = now;

    this.level = clampLevelPercent(
      this.level +
        simulateLevelDelta({
          dtMs,
          pumpOn: this.control.pumpOn,
          cisternHasWater: this.controls.cisternHasWater,
          pumpFailure: this.controls.pumpFailure,
          draining: this.draining,
        })
    );

    if (this.draining && this.level <= SIM_DRAIN_TARGET_PERCENT) {
      this.stopDrain();
    }

    const previous = this.control;
    this.control = this.controller.update({
      now,
      levelPercent: this.level,
      sensorOk: true,
      cisternRaw: this.controls.cisternHasWater,
    });

    const changed =
      previous.pumpOn !== this.control.pumpOn ||
      previous.fillState !== this.control.fillState ||
      previous.cisternHasWater !== this.control.cisternHasWater;
    // El nivel quieto se publica cada 2 s; con movimiento o cambios de estado,
    // en cada paso para que el tanque se vea fluido.
    const moving = this.control.pumpOn || this.draining;
    if (
      forcePublish ||
      changed ||
      moving ||
      now - this.lastPublishAt >= MOCK_UPDATE_INTERVAL_MS
    ) {
      if (this.online) this.publishReading();
    }
  }

  private publishReading(): void {
    const now = Date.now();
    this.lastPublishAt = now;
    const levelPercent = clampLevelPercent(this.level + sensorJitter(now - this.startedAt));
    const reading: TankReading = {
      levelPercent,
      distanceCm: simulateDistanceCm(levelPercent),
      timestamp: now,
      control: this.control,
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
