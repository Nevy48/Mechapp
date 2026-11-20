import { HttpTankSource } from './http-source';
import { MockTankSource } from './mock-source';
import type { TankDataSource, TankSourceMode } from './types';

export * from './types';
export * from './alert';
export * from './fill-state';
export { FillController } from './fill-controller';
export { HttpTankSource, parseControl, parseDevicePayload } from './http-source';
export { MockTankSource } from './mock-source';

/**
 * Fábrica de fuentes de datos.
 *
 * Es el único punto de la app que decide de dónde vienen los datos. Con el
 * ESP32 disponible, alcanza con pasar `mode: 'device'` (y definir
 * `EXPO_PUBLIC_TANK_API_URL`) para que la UI reciba las mismas mediciones.
 */
export function createTankSource(mode: TankSourceMode): TankDataSource {
  return mode === 'device' ? new HttpTankSource() : new MockTankSource();
}
