/**
 * Configuración del prototipo.
 *
 * Los valores de la app (capacidad por defecto, intervalo de actualización,
 * endpoint del dispositivo) viven acá para poder ajustarlos sin tocar la UI.
 */

/** Capacidad inicial del tanque, en litros (caso de diseño del informe: 500 L). */
export const DEFAULT_TANK_CAPACITY_LITERS = 500;

export const MIN_TANK_CAPACITY_LITERS = 50;
export const MAX_TANK_CAPACITY_LITERS = 100000;

/** Intervalo con el que el simulador publica una medición cuando el nivel está quieto. */
export const MOCK_UPDATE_INTERVAL_MS = 2000;

/** Nivel con el que arranca el simulador (%). */
export const MOCK_INITIAL_LEVEL_PERCENT = 68;

/** Intervalo de consulta al dispositivo real. */
export const DEVICE_POLL_INTERVAL_MS = 3000;

/** Timeout de cada consulta al dispositivo real. */
export const DEVICE_REQUEST_TIMEOUT_MS = 6000;

/**
 * Endpoint del dispositivo (ESP32-C3 + AJ-SR04M).
 *
 * Definí la variable de entorno antes de arrancar la app:
 *
 *   EXPO_PUBLIC_TANK_API_URL=http://192.168.0.50:8080
 *
 * La app consulta `{EXPO_PUBLIC_TANK_API_URL}/api/v1/tank/reading`.
 * Si no está definida, el modo "Dispositivo" queda deshabilitado y la app
 * sigue funcionando con datos simulados.
 */
export const TANK_API_BASE_URL = process.env.EXPO_PUBLIC_TANK_API_URL?.trim() || null;

/** Ruta del recurso que expone la lectura del tanque. */
export const TANK_READING_PATH = '/api/v1/tank/reading';

/**
 * Sensor ultrasónico (mismos valores por defecto que el firmware del Arduino).
 *
 * - `SENSOR_DISTANCE_EMPTY_CM` (dMax): distancia del sensor al fondo, tanque vacío.
 * - `SENSOR_DISTANCE_FULL_CM` (dMin): distancia del sensor al agua, tanque lleno.
 */
export const SENSOR_DISTANCE_EMPTY_CM = 110;
export const SENSOR_DISTANCE_FULL_CM = 10;

/**
 * Umbrales de alerta del nivel (%), iguales a los del firmware.
 * La histéresis evita que el estado parpadee cuando el nivel ronda un umbral.
 */
export const LEVEL_CRITICAL_PERCENT = 10;
export const LEVEL_LOW_PERCENT = 20;
export const LEVEL_FULL_PERCENT = 90;
export const LEVEL_HYSTERESIS_PERCENT = 2;

/**
 * Control de llenado (mismos valores que el firmware con `SIMULACION 1`).
 *
 * La bomba arranca cuando el nivel baja a `LEVEL_LOW_PERCENT` y la cisterna
 * tiene agua, y corta al llegar a `LEVEL_FULL_PERCENT`.
 */
export const FILL_CONTROL = {
  /** La señal de la cisterna tiene que estar estable este tiempo. */
  cisternDebounceMs: 2000,
  /** Tiempo mínimo con la bomba apagada antes de volver a arrancar. */
  minOffMs: 5000,
  /** Cada cuánto se exige que el nivel haya subido. */
  verifyIntervalMs: 20_000,
  /** Subida mínima (en puntos %) en cada intervalo de verificación. */
  minRisePercent: 2,
  /** Corte de seguridad por tiempo de llenado. */
  maxFillMs: 180_000,
  /** Espera antes de reintentar después de una falla. */
  retryDelayMs: 30_000,
  /** Fallas seguidas antes de bloquear. */
  maxRetries: 3,
} as const;

/** Simulador: velocidad de llenado de la bomba (% por segundo). */
export const SIM_PUMP_RATE_PERCENT_PER_S = 2.2;

/** Simulador: consumo normal de la casa (% por segundo). */
export const SIM_CONSUMPTION_PERCENT_PER_S = 0.04;

/** Simulador: consumo del botón "Vaciar" (% por segundo). */
export const SIM_DRAIN_PERCENT_PER_S = 6;

/** Simulador: nivel en el que se corta el vaciado rápido. */
export const SIM_DRAIN_TARGET_PERCENT = 4;

/** Simulador: paso de la física y de las mediciones mientras hay movimiento. */
export const SIM_TICK_MS = 500;

/** Historial: cada cuánto se guarda un punto y cuántos se conservan (~30 min). */
export const HISTORY_SAMPLE_INTERVAL_MS = 5000;
export const HISTORY_MAX_POINTS = 360;

/** Registro de eventos: cantidad máxima conservada. */
export const EVENT_LOG_MAX = 60;
