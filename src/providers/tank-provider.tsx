import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  DEFAULT_TANK_CAPACITY_LITERS,
  EVENT_LOG_MAX,
  HISTORY_MAX_POINTS,
  HISTORY_SAMPLE_INTERVAL_MS,
  MAX_TANK_CAPACITY_LITERS,
  MIN_TANK_CAPACITY_LITERS,
} from '@/constants/config';
import {
  createTankSource,
  deriveEvents,
  getLevelAlert,
  isValidReading,
  type ConnectionStatus,
  type FillControlState,
  type LevelAlert,
  type SimulationControls,
  type TankDataSource,
  type TankEvent,
  type TankReading,
  type TankSourceEvent,
  type TankSourceMode,
} from '@/data/tank';

/** Ventana temporal usada para detectar si el nivel está bajando. */
const TREND_WINDOW_MS = 20_000;

/** Variación mínima (en %) para considerar que el nivel se movió. */
const TREND_THRESHOLD_PERCENT = 0.2;

export type TankTrend = 'up' | 'down' | 'steady';

/** Un punto del historial de nivel. */
export interface HistoryPoint {
  timestamp: number;
  levelPercent: number;
  pumpOn: boolean;
}

export interface TankContextValue {
  /** Origen de los datos: simulación o dispositivo real. */
  mode: TankSourceMode;
  status: ConnectionStatus;
  statusDetail: string | null;
  /** Última medición válida conocida. Se conserva aunque se pierda la conexión. */
  reading: TankReading | null;
  /** Estado del control de llenado (bomba, cisterna, fallas), si el equipo lo informa. */
  control: FillControlState | null;
  capacityLiters: number;
  /** `true` cuando la medición no viene de una conexión activa. */
  isStale: boolean;
  trend: TankTrend;
  /** Alerta del nivel (crítico, bajo, ok, lleno), con la histéresis del firmware. */
  alert: LevelAlert | null;
  /** Historial de nivel de esta sesión (un punto cada 5 s, hasta ~30 min). */
  history: HistoryPoint[];
  /** Registro de eventos de esta sesión, el más reciente primero. */
  events: TankEvent[];
  /** `true` si hay un endpoint configurado para el dispositivo real. */
  isDeviceAvailable: boolean;
  /** Estado del sensor simulado: `false` equivale a un corte de conexión. */
  isSimulatedOnline: boolean;
  /** `true` mientras corre el vaciado rápido de la simulación. */
  isDrainRunning: boolean;
  /** Controles de prueba del simulador (cisterna, falla de bomba). */
  simulationControls: SimulationControls | null;
  setCapacityLiters: (liters: number) => void;
  setMode: (mode: TankSourceMode) => void;
  setSimulatedConnection: (online: boolean) => void;
  startDrain: () => void;
  stopDrain: () => void;
  /** Sólo en modo simulado: fija el nivel a mano (arrastrando el agua). */
  setManualLevel: (levelPercent: number) => void;
  setCisternWater: (hasWater: boolean) => void;
  setPumpFailure: (failure: boolean) => void;
  /** Sólo en modo simulado: equivale al botón de reset del Arduino. */
  resetController: () => void;
  clearEvents: () => void;
}

const TankContext = createContext<TankContextValue | null>(null);

/** Controles disponibles sólo en la fuente simulada. */
interface SimulatedSourceControl {
  setSimulatedOnline(online: boolean): void;
  startDrain(): void;
  stopDrain(): void;
  setManualLevel(levelPercent: number): void;
  setCisternWater(hasWater: boolean): void;
  setPumpFailure(failure: boolean): void;
  resetController(): void;
}

function isSimulatedSource(
  source: TankDataSource
): source is TankDataSource & SimulatedSourceControl {
  return (
    source.mode === 'simulated' &&
    typeof (source as Partial<SimulatedSourceControl>).setSimulatedOnline === 'function'
  );
}

let connectionEventCounter = 0;

function connectionEvent(timestamp: number, online: boolean): TankEvent {
  connectionEventCounter += 1;
  return {
    id: `conn-${timestamp}-${connectionEventCounter}`,
    timestamp,
    tone: online ? 'positive' : 'caution',
    title: online ? 'Conexión restablecida' : 'Se perdió la conexión con el equipo',
  };
}

export function TankProvider({ children }: PropsWithChildren) {
  const [mode, setModeState] = useState<TankSourceMode>('simulated');
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [statusDetail, setStatusDetail] = useState<string | null>(null);
  const [reading, setReading] = useState<TankReading | null>(null);
  const [capacityLiters, setCapacityLitersState] = useState(DEFAULT_TANK_CAPACITY_LITERS);
  const [trend, setTrend] = useState<TankTrend>('steady');
  const [alert, setAlert] = useState<LevelAlert | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [events, setEvents] = useState<TankEvent[]>([]);
  const [isSimulatedOnline, setIsSimulatedOnline] = useState(true);
  const [isDrainRunning, setIsDrainRunning] = useState(false);
  const [simulationControls, setSimulationControls] = useState<SimulationControls | null>(null);

  const trendRef = useRef<{ level: number; at: number } | null>(null);
  /** Último estado visto, para detectar cambios y generar eventos. */
  const lastStateRef = useRef<{ control: FillControlState | null; alert: LevelAlert | null } | null>(
    null
  );
  const lastSampleAtRef = useRef(0);
  const lastStatusRef = useRef<ConnectionStatus | null>(null);

  const pushEvents = useCallback((next: TankEvent[]) => {
    if (next.length === 0) return;
    setEvents((current) => [...next.reverse(), ...current].slice(0, EVENT_LOG_MAX));
  }, []);

  const handleReading = useCallback(
    (next: TankReading) => {
      if (!isValidReading(next)) return;

      const previous = lastStateRef.current;
      const nextAlert = getLevelAlert(next.levelPercent, previous?.alert ?? null);
      pushEvents(
        deriveEvents(
          previous,
          { control: next.control, alert: nextAlert, levelPercent: next.levelPercent },
          next.timestamp
        )
      );
      lastStateRef.current = { control: next.control, alert: nextAlert };

      setReading(next);
      setAlert(nextAlert);

      // Historial: un punto cada HISTORY_SAMPLE_INTERVAL_MS, y siempre que la
      // bomba cambia de estado para que el gráfico marque bien los llenados.
      const pumpOn = next.control?.pumpOn ?? false;
      const pumpChanged = (previous?.control?.pumpOn ?? false) !== pumpOn;
      if (pumpChanged || next.timestamp - lastSampleAtRef.current >= HISTORY_SAMPLE_INTERVAL_MS) {
        lastSampleAtRef.current = next.timestamp;
        setHistory((current) =>
          [...current, { timestamp: next.timestamp, levelPercent: next.levelPercent, pumpOn }].slice(
            -HISTORY_MAX_POINTS
          )
        );
      }

      const reference = trendRef.current;
      if (!reference || next.timestamp - reference.at > TREND_WINDOW_MS) {
        trendRef.current = { level: next.levelPercent, at: next.timestamp };
        setTrend('steady');
        return;
      }

      const delta = next.levelPercent - reference.level;
      setTrend(
        delta < -TREND_THRESHOLD_PERCENT ? 'down' : delta > TREND_THRESHOLD_PERCENT ? 'up' : 'steady'
      );
    },
    [pushEvents]
  );

  const handleEvent = useCallback(
    (event: TankSourceEvent) => {
      switch (event.type) {
        case 'reading':
          handleReading(event.reading);
          return;
        case 'simulation':
          setIsDrainRunning(event.running);
          return;
        case 'simulationControls':
          setSimulationControls(event.controls);
          return;
        case 'status': {
          const previous = lastStatusRef.current;
          lastStatusRef.current = event.status;
          if (previous === 'connected' && event.status === 'disconnected') {
            pushEvents([connectionEvent(Date.now(), false)]);
          } else if (previous === 'disconnected' && event.status === 'connected') {
            pushEvents([connectionEvent(Date.now(), true)]);
          }
          setStatus(event.status);
          setStatusDetail(event.detail ?? null);
          return;
        }
      }
    },
    [handleReading, pushEvents]
  );

  /**
   * La fuente se recrea cuando cambia el modo: el `useEffect` de abajo se
   * encarga de cerrar la anterior y abrir la nueva, sin timers duplicados.
   */
  const source = useMemo(() => createTankSource(mode), [mode]);

  useEffect(() => {
    const unsubscribe = source.subscribe(handleEvent);
    source.start();

    return () => {
      unsubscribe();
      source.stop();
    };
  }, [source, handleEvent]);

  const setCapacityLiters = useCallback((liters: number) => {
    if (!Number.isFinite(liters)) return;
    const clamped = Math.min(
      MAX_TANK_CAPACITY_LITERS,
      Math.max(MIN_TANK_CAPACITY_LITERS, Math.round(liters))
    );
    setCapacityLitersState(clamped);
  }, []);

  const setMode = useCallback((next: TankSourceMode) => {
    setModeState((current) => {
      if (current === next) return current;
      // La medición anterior corresponde a otra fuente: no se muestra como
      // si fuera de la nueva.
      setReading(null);
      setAlert(null);
      setHistory([]);
      setEvents([]);
      trendRef.current = null;
      lastStateRef.current = null;
      lastStatusRef.current = null;
      lastSampleAtRef.current = 0;
      setTrend('steady');
      setStatus('connecting');
      setStatusDetail(null);
      setIsDrainRunning(false);
      setSimulationControls(null);
      return next;
    });
  }, []);

  const setSimulatedConnection = useCallback(
    (online: boolean) => {
      if (isSimulatedSource(source)) {
        setIsSimulatedOnline(online);
        source.setSimulatedOnline(online);
      }
    },
    [source]
  );

  const startDrain = useCallback(() => {
    if (isSimulatedSource(source)) source.startDrain();
  }, [source]);

  const stopDrain = useCallback(() => {
    if (isSimulatedSource(source)) source.stopDrain();
  }, [source]);

  const setManualLevel = useCallback(
    (levelPercent: number) => {
      if (!isSimulatedSource(source)) return;
      // El salto manual no es una tendencia real: se descarta la referencia.
      trendRef.current = null;
      source.setManualLevel(levelPercent);
    },
    [source]
  );

  const setCisternWater = useCallback(
    (hasWater: boolean) => {
      if (isSimulatedSource(source)) source.setCisternWater(hasWater);
    },
    [source]
  );

  const setPumpFailure = useCallback(
    (failure: boolean) => {
      if (isSimulatedSource(source)) source.setPumpFailure(failure);
    },
    [source]
  );

  const resetController = useCallback(() => {
    if (!isSimulatedSource(source)) return;
    source.resetController();
    pushEvents([
      {
        id: `reset-${Date.now()}`,
        timestamp: Date.now(),
        tone: 'info',
        title: 'Equipo reiniciado',
        detail: 'Se borró el bloqueo del control de llenado',
      },
    ]);
  }, [source, pushEvents]);

  const clearEvents = useCallback(() => setEvents([]), []);

  const value = useMemo<TankContextValue>(
    () => ({
      mode,
      status,
      statusDetail,
      reading,
      control: reading?.control ?? null,
      capacityLiters,
      isStale: status !== 'connected' || reading === null,
      trend,
      alert,
      history,
      events,
      isDeviceAvailable: source.isAvailable,
      isSimulatedOnline,
      isDrainRunning,
      simulationControls,
      setCapacityLiters,
      setMode,
      setSimulatedConnection,
      startDrain,
      stopDrain,
      setManualLevel,
      setCisternWater,
      setPumpFailure,
      resetController,
      clearEvents,
    }),
    [
      mode,
      status,
      statusDetail,
      reading,
      capacityLiters,
      trend,
      alert,
      history,
      events,
      source,
      isSimulatedOnline,
      isDrainRunning,
      simulationControls,
      setCapacityLiters,
      setMode,
      setSimulatedConnection,
      startDrain,
      stopDrain,
      setManualLevel,
      setCisternWater,
      setPumpFailure,
      resetController,
      clearEvents,
    ]
  );

  return <TankContext.Provider value={value}>{children}</TankContext.Provider>;
}

export function useTank(): TankContextValue {
  const context = useContext(TankContext);
  if (!context) {
    throw new Error('useTank debe usarse dentro de <TankProvider>');
  }
  return context;
}
