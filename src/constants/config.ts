/**
 * Configuración del prototipo.
 *
 * Los valores de la app (capacidad por defecto, intervalo de actualización,
 * endpoint del dispositivo) viven acá para poder ajustarlos sin tocar la UI.
 */

/** Capacidad inicial del tanque, en litros. */
export const DEFAULT_TANK_CAPACITY_LITERS = 1000;

export const MIN_TANK_CAPACITY_LITERS = 50;
export const MAX_TANK_CAPACITY_LITERS = 100000;

/** Intervalo con el que el simulador publica una medición nueva. */
export const MOCK_UPDATE_INTERVAL_MS = 2000;

/** Nivel con el que arranca el simulador (%). */
export const MOCK_INITIAL_LEVEL_PERCENT = 68;

/** Simulación de llenado (botón "Simular"): tiempo con el tanque vacío antes de empezar. */
export const FILL_SIMULATION_EMPTY_HOLD_MS = 3000;

/** Duración del llenado completo, de 0% a 100%. */
export const FILL_SIMULATION_DURATION_MS = 45_000;

/** Durante la simulación las mediciones son más frecuentes para que el llenado se vea fluido. */
export const FILL_SIMULATION_UPDATE_INTERVAL_MS = 500;

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
