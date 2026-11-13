/**
 * Modelo de datos del tanque.
 *
 * La capa de presentación nunca habla con el hardware: consume un `TankDataSource`
 * que emite `TankSourceEvent`. De esta forma el simulador y el ESP32 real son
 * intercambiables sin tocar la interfaz.
 */

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export type TankSourceMode = 'simulated' | 'device';

/**
 * Una medición válida del sensor.
 *
 * - `levelPercent`: porcentaje de agua sobre el útil del tanque (0–100).
 * - `distanceCm`: distancia del sensor a la superficie del agua, en cm.
 * - `timestamp`: momento de la medición (epoch en ms).
 */
export interface TankReading {
  levelPercent: number;
  distanceCm: number | null;
  timestamp: number;
}

export type TankSourceEvent =
  | { type: 'reading'; reading: TankReading }
  | { type: 'status'; status: ConnectionStatus; detail?: string }
  /** Sólo la fuente simulada: avisa cuando arranca o termina la simulación de llenado. */
  | { type: 'simulation'; running: boolean };

export interface TankDataSource {
  readonly mode: TankSourceMode;
  /** `false` cuando la fuente no puede operar (por ejemplo, falta el endpoint). */
  readonly isAvailable: boolean;
  start(): void;
  stop(): void;
  subscribe(listener: (event: TankSourceEvent) => void): () => void;
}

export function clampLevelPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function isValidLevelPercent(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
}

export function isValidDistanceCm(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1000;
}

/**
 * Litros restantes. Se calcula siempre a partir del porcentaje medido y de la
 * capacidad configurada: nunca se almacena un valor derivado.
 */
export function remainingLiters(levelPercent: number, capacityLiters: number): number {
  const capacity = Number.isFinite(capacityLiters) ? Math.max(0, capacityLiters) : 0;
  return Math.round((clampLevelPercent(levelPercent) / 100) * capacity);
}

export function isValidReading(reading: TankReading): boolean {
  return (
    isValidLevelPercent(reading.levelPercent) &&
    (reading.distanceCm === null || isValidDistanceCm(reading.distanceCm)) &&
    Number.isFinite(reading.timestamp)
  );
}
