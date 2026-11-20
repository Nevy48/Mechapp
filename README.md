# Aqua — monitoreo de tanque de agua

Prototipo de app móvil (React Native + Expo) para consultar el nivel de agua de
un tanque doméstico. El hardware real es un **ESP32-C3 SuperMini** con un sensor
ultrasónico **AJ-SR04M** conectado por Wi-Fi; mientras tanto, la app funciona con
un simulador de datos integrado.

La pantalla principal muestra, de un vistazo:

1. Qué porcentaje del tanque está lleno.
2. Cuántos litros quedan disponibles.
3. Si la bomba está encendida y si la cisterna tiene agua.
4. Avisos del control de llenado: cisterna vacía, falla o bloqueo.
5. Si el sensor está conectado y si la medición es actual.

El botón del reloj abre el **historial** de la sesión: gráfico de nivel con las
franjas en las que funcionó la bomba, resumen (llenados, tiempo de bomba, nivel
mínimo, fallas) y registro de eventos.

## Control de llenado

El equipo no sólo mide: comanda el llenado actuando sobre el circuito del
automático del tanque, y sólo da la orden si el automático de la cisterna
confirma que hay agua (firmware `control_llenado.ino`). La app muestra ese
estado y, en modo simulado, corre **la misma máquina de estados** que el
firmware (`src/data/tank/fill-controller.ts`):

| Estado (`llenado`) | En la app | Qué pasa |
|---|---|---|
| `REPOSO` | En reposo | Hay agua suficiente, la bomba está apagada. |
| `LLENANDO` | Llenando con la bomba | Nivel ≤ 20 % y cisterna con agua: el relé cierra. Corta al 90 %. |
| `ESPERA_CISTERNA` | Esperando la cisterna | Hace falta llenar pero la cisterna está vacía. |
| `FALLA` | Falla en el llenado | El nivel no subió (`SIN_CAUDAL`), se pasó el tiempo máximo (`TIEMPO_MAX`) o falló el sensor (`SENSOR`). Reintenta solo. |
| `BLOQUEO` | Llenado bloqueado | Tres fallas seguidas: hay que reiniciar el equipo. |

## Puesta en marcha

```bash
npm install
npx expo start
```

Comandos disponibles: `npm start`, `npm run ios`, `npm run android`, `npm run web`,
`npm run lint` y `npx tsc --noEmit` para el chequeo de tipos.

## Arquitectura

La app separa la presentación del origen de los datos. La UI nunca habla con el
hardware: consume eventos de una `TankDataSource`.

```
src/
  app/                  rutas de expo-router (_layout + dashboard)
  components/           interfaz (tanque, encabezado, lectura, sheet de configuración)
  constants/            paleta, tipografía y valores de configuración
  data/tank/            modelo de datos y fuentes de datos
  hooks/                utilidades reutilizables
  providers/            TankProvider: une la fuente de datos con la UI
  utils/                formateo de números y tiempos en español
```

### Modelo de medición

`src/data/tank/types.ts`

```ts
interface TankReading {
  levelPercent: number;  // 0–100, porcentaje medido
  distanceCm: number | null; // distancia del sensor a la superficie, en cm
  timestamp: number;     // epoch en ms de la medición
}
```

Los litros restantes **no se almacenan**: se calculan siempre a partir del
porcentaje medido y de la capacidad configurada
(`remainingLiters(levelPercent, capacityLiters)`), de modo que cambiar la
capacidad actualiza los litros al instante sin tocar el nivel medido.

### Interfaz de la fuente de datos

```ts
interface TankDataSource {
  readonly mode: 'simulated' | 'device';
  readonly isAvailable: boolean;
  start(): void;
  stop(): void;
  subscribe(listener: (event: TankSourceEvent) => void): () => void;
}
```

`TankSourceEvent` puede ser `{ type: 'reading', reading }` o
`{ type: 'status', status: 'connecting' | 'connected' | 'disconnected' }`.

- `MockTankSource` (`src/data/tank/mock-source.ts`): simulador determinista.
  Publica una medición cada 2 s con variaciones graduales y acotadas. Permite
  cortar la conexión a propósito (interruptor "Simular corte de conexión") para
  verificar el estado "sin conexión".
- `HttpTankSource` (`src/data/tank/http-source.ts`): consulta por HTTP al
  dispositivo real.

La fábrica `createTankSource(mode)` (`src/data/tank/index.ts`) es el único punto
que decide de dónde vienen los datos.

## Integración con el ESP32

### Endpoint

Definí la variable de entorno antes de iniciar la app:

```bash
EXPO_PUBLIC_TANK_API_URL=http://192.168.0.50:8080 npx expo start
```

La app consulta `{EXPO_PUBLIC_TANK_API_URL}/api/v1/tank/reading` cada 3 s. Sin
esa variable, el modo "Dispositivo" queda deshabilitado en Configuración y la app
sigue funcionando con datos simulados.

### Formato de la respuesta

La app acepta la trama del firmware tal cual sale por el puerto serie:

```json
{"id":"T1","nivel":15,"litros":75,"dist_cm":95,"alerta":"BAJO",
 "cisterna":"CON_AGUA","bomba":"ON","llenado":"LLENANDO","falla":"-"}
```

o el formato de la API:

```json
{
  "levelPercent": 68.4,
  "distanceCm": 51.6,
  "timestamp": 1720000000000,
  "pumpOn": false,
  "cisternHasWater": true,
  "fillState": "idle",
  "fault": null
}
```

- `levelPercent` / `nivel` (obligatorio): porcentaje de agua, entre 0 y 100.
- `distanceCm` / `dist_cm` (opcional): distancia del sensor a la superficie, en cm.
- `timestamp` (opcional): epoch en ms; si falta, se usa la hora de recepción.
- `bomba` / `pumpOn`, `cisterna` / `cisternHasWater`, `llenado` / `fillState`,
  `falla` / `fault` (opcionales): estado del control de llenado. Si el equipo no
  los manda (firmware anterior), la app funciona como monitor de nivel y oculta
  el panel de bomba y cisterna.

Cualquier valor fuera de rango se descarta: la UI nunca muestra una medición
inválida. Ante dos respuestas fallidas consecutivas la app pasa a "Sin conexión",
conserva la última lectura válida y la rotula como antigua.

### Otros transportes

Para recibir las lecturas por WebSocket o MQTT alcanza con implementar
`TankDataSource` y cambiar la fábrica en `src/data/tank/index.ts`; el resto de la
app no cambia.

## Configuración desde la app

El botón de la esquina superior derecha abre un sheet con:

- **Capacidad del tanque**: se define en litros (500 L por defecto, como el caso
  de diseño). Cambia los litros calculados, no el nivel medido.
- **Modo de conexión**: simulación o dispositivo real.
- **Estado de la conexión**: estado actual, última medición válida y estado del
  control de llenado.
- **Pruebas de la simulación** (sólo modo simulado): automático de la cisterna,
  bomba sin caudal (para probar fallas y bloqueo), corte de conexión y, cuando
  hay falla, el reinicio del equipo.

En el dashboard simulado, el botón **Vaciar** simula un consumo fuerte: el
tanque baja rápido y el control arranca la bomba solo. También se puede
arrastrar el agua para fijar el nivel a mano.

## Notas del prototipo

- La capacidad se mantiene en memoria: se reinicia con la app. Para persistirla
  hace falta agregar un almacenamiento local (por ejemplo
  `@react-native-async-storage/async-storage`).
- El historial y los eventos viven en memoria (unos 30 min): se borran al cerrar
  la app o cambiar de modo.
- Las notificaciones push (nivel crítico, cisterna vacía, falla) quedan para la
  versión con servidor: hoy los avisos se ven dentro de la app.
- Las mediciones simuladas están rotuladas como "Simulado" en el encabezado para
  que nunca se confundan con datos de un sensor real.
