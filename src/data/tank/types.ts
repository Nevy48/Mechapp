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
  /**
   * Estado del control de llenado (bomba, cisterna, fallas). `null` cuando el
   * equipo sólo informa el nivel (firmware anterior al control de llenado).
   */
  control: FillControlState | null;
}

/**
 * Estado de la máquina de llenado del firmware.
 *
 * - `idle`: tanque con agua suficiente, sin orden de llenado (REPOSO).
 * - `waitingCistern`: hace falta llenar pero la cisterna no tiene agua (ESPERA_CISTERNA).
 * - `filling`: el relé está cerrado y la bomba sube agua (LLENANDO).
 * - `fault`: se cortó por una falla y va a reintentar solo (FALLA).
 * - `locked`: varias fallas seguidas; requiere reiniciar el equipo (BLOQUEO).
 */
export type FillState = 'idle' | 'waitingCistern' | 'filling' | 'fault' | 'locked';

/**
 * Motivo de la última falla del llenado.
 *
 * - `noFlow`: la bomba funcionó pero el nivel no subió (SIN_CAUDAL).
 * - `timeout`: se superó el tiempo máximo de llenado (TIEMPO_MAX).
 * - `sensor`: lectura del sensor fuera de rango (SENSOR).
 */
export type FillFault = 'noFlow' | 'timeout' | 'sensor';

export interface FillControlState {
  /** Orden de la bomba: `true` cuando el relé está cerrado. */
  pumpOn: boolean;
  /** Lo que informa el automático de la cisterna. `null` si el equipo no lo reporta. */
  cisternHasWater: boolean | null;
  fillState: FillState;
  fault: FillFault | null;
  /** `false` cuando el firmware marca la medición como falla de sensor. */
  sensorOk: boolean;
}

export type TankSourceEvent =
  | { type: 'reading'; reading: TankReading }
  | { type: 'status'; status: ConnectionStatus; detail?: string }
  /** Sólo la fuente simulada: avisa cuando arranca o termina la simulación de llenado. */
  | { type: 'simulation'; running: boolean }
  /** Sólo la fuente simulada: estado de los controles de prueba (cisterna, falla de bomba). */
  | { type: 'simulationControls'; controls: SimulationControls };

/** Controles de prueba de la fuente simulada. */
export interface SimulationControls {
  /** Posición del automático de la cisterna simulado. */
  cisternHasWater: boolean;
  /** Simula una bomba que funciona pero no sube agua (cañería tapada, bomba sin cebar). */
  pumpFailure: boolean;
}

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
