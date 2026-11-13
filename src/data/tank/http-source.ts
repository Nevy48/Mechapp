import {
  DEVICE_POLL_INTERVAL_MS,
  DEVICE_REQUEST_TIMEOUT_MS,
  TANK_API_BASE_URL,
  TANK_READING_PATH,
} from '@/constants/config';

import {
  isValidDistanceCm,
  isValidLevelPercent,
  type ConnectionStatus,
  type TankDataSource,
  type TankReading,
  type TankSourceEvent,
} from './types';

/**
 * Formato esperado del dispositivo (JSON).
 *
 * ```json
 * {
 *   "levelPercent": 68.4,
 *   "distanceCm": 51.6,
 *   "timestamp": 1720000000000
 * }
 * ```
 *
 * - `levelPercent` (obligatorio): porcentaje de agua, 0–100.
 * - `distanceCm` (opcional): distancia del sensor a la superficie, en cm.
 * - `timestamp` (opcional): epoch en ms; si falta se usa la hora de recepción.
 *
 * También acepta la trama del firmware del Arduino tal cual sale por serie:
 * `{"id":"T1","nivel":68,"litros":340,"dist_cm":42,"alerta":"OK"}`.
 *
 * Cualquier valor fuera de rango se descarta: la UI nunca muestra una
 * medición inválida.
 */
export function parseDevicePayload(payload: unknown): TankReading | null {
  if (typeof payload !== 'object' || payload === null) return null;

  const body = payload as Record<string, unknown>;
  const levelPercent = body.levelPercent ?? body.nivel;
  if (!isValidLevelPercent(levelPercent)) return null;

  const distance = body.distanceCm ?? body.dist_cm;
  const distanceCm = isValidDistanceCm(distance) ? distance : null;
  const timestamp =
    typeof body.timestamp === 'number' && Number.isFinite(body.timestamp)
      ? body.timestamp
      : Date.now();

  return { levelPercent, distanceCm, timestamp };
}

/**
 * Fuente de datos que consulta el dispositivo real por HTTP.
 *
 * La capa de comunicación queda aislada del resto de la app: si en el futuro
 * el ESP32 publica por WebSocket o MQTT, alcanza con implementar
 * `TankDataSource` y cambiar la fábrica en `index.ts`.
 */
export class HttpTankSource implements TankDataSource {
  readonly mode = 'device' as const;
  readonly isAvailable: boolean;

  private listeners = new Set<(event: TankSourceEvent) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private controller: AbortController | null = null;
  private failures = 0;
  private status: ConnectionStatus = 'connecting';

  constructor(private readonly baseUrl: string | null = TANK_API_BASE_URL) {
    this.isAvailable = Boolean(baseUrl);
  }

  subscribe(listener: (event: TankSourceEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  start(): void {
    if (this.timer) return;

    if (!this.isAvailable) {
      this.setStatus('disconnected', 'Falta configurar el endpoint del dispositivo');
      return;
    }

    this.setStatus('connecting');
    void this.poll();
    this.timer = setInterval(() => {
      void this.poll();
    }, DEVICE_POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.controller?.abort();
    this.controller = null;
    this.listeners.clear();
  }

  private async poll(): Promise<void> {
    if (!this.baseUrl) return;

    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    const timeout = setTimeout(() => controller.abort(), DEVICE_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.baseUrl}${TANK_READING_PATH}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reading = parseDevicePayload(await response.json());
      if (!reading) {
        throw new Error('Respuesta inválida');
      }

      this.failures = 0;
      this.setStatus('connected');
      this.emit({ type: 'reading', reading });
    } catch {
      this.failures += 1;
      if (this.failures >= 2) {
        this.setStatus('disconnected', 'Sin respuesta del sensor');
      }
    } finally {
      clearTimeout(timeout);
      if (this.controller === controller) {
        this.controller = null;
      }
    }
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
