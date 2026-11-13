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
  MAX_TANK_CAPACITY_LITERS,
  MIN_TANK_CAPACITY_LITERS,
} from '@/constants/config';
import {
  createTankSource,
  getLevelAlert,
  isValidReading,
  type LevelAlert,
  type ConnectionStatus,
  type TankDataSource,
  type TankReading,
  type TankSourceEvent,
  type TankSourceMode,
} from '@/data/tank';

/** Ventana temporal usada para detectar si el nivel está bajando. */
const TREND_WINDOW_MS = 20_000;

/** Variación mínima (en %) para considerar que el nivel se movió. */
const TREND_THRESHOLD_PERCENT = 0.2;

export type TankTrend = 'up' | 'down' | 'steady';

export interface TankContextValue {
  /** Origen de los datos: simulación o dispositivo real. */
  mode: TankSourceMode;
  status: ConnectionStatus;
  statusDetail: string | null;
  /** Última medición válida conocida. Se conserva aunque se pierda la conexión. */
  reading: TankReading | null;
  capacityLiters: number;
  /** `true` cuando la medición no viene de una conexión activa. */
  isStale: boolean;
  trend: TankTrend;
  /** Alerta del nivel (crítico, bajo, ok, lleno), con la histéresis del firmware. */
  alert: LevelAlert | null;
  /** `true` si hay un endpoint configurado para el dispositivo real. */
  isDeviceAvailable: boolean;
  /** Estado del sensor simulado: `false` equivale a un corte de conexión. */
  isSimulatedOnline: boolean;
  /** `true` mientras corre la simulación de llenado (tanque vacío → lleno). */
  isFillSimulationRunning: boolean;
  setCapacityLiters: (liters: number) => void;
  setMode: (mode: TankSourceMode) => void;
  setSimulatedConnection: (online: boolean) => void;
  startFillSimulation: () => void;
  stopFillSimulation: () => void;
  /** Sólo en modo simulado: fija el nivel a mano (arrastrando el agua). */
  setManualLevel: (levelPercent: number) => void;
}

const TankContext = createContext<TankContextValue | null>(null);

/** Controles disponibles sólo en la fuente simulada. */
interface SimulatedSourceControl {
  setSimulatedOnline(online: boolean): void;
  startFillSimulation(): void;
  stopFillSimulation(): void;
  setManualLevel(levelPercent: number): void;
}

function isSimulatedSource(
  source: TankDataSource
): source is TankDataSource & SimulatedSourceControl {
  return (
    source.mode === 'simulated' &&
    typeof (source as Partial<SimulatedSourceControl>).setSimulatedOnline === 'function'
  );
}

export function TankProvider({ children }: PropsWithChildren) {
  const [mode, setModeState] = useState<TankSourceMode>('simulated');
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [statusDetail, setStatusDetail] = useState<string | null>(null);
  const [reading, setReading] = useState<TankReading | null>(null);
  const [capacityLiters, setCapacityLitersState] = useState(DEFAULT_TANK_CAPACITY_LITERS);
  const [trend, setTrend] = useState<TankTrend>('steady');
  const [alert, setAlert] = useState<LevelAlert | null>(null);
  const [isSimulatedOnline, setIsSimulatedOnline] = useState(true);
  const [isFillSimulationRunning, setIsFillSimulationRunning] = useState(false);

  const trendRef = useRef<{ level: number; at: number } | null>(null);

  const handleReading = useCallback((next: TankReading) => {
    if (!isValidReading(next)) return;

    setReading(next);
    setAlert((current) => getLevelAlert(next.levelPercent, current));

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
  }, []);

  const handleEvent = useCallback(
    (event: TankSourceEvent) => {
      if (event.type === 'reading') {
        handleReading(event.reading);
        return;
      }
      if (event.type === 'simulation') {
        setIsFillSimulationRunning(event.running);
        return;
      }
      setStatus(event.status);
      setStatusDetail(event.detail ?? null);
    },
    [handleReading]
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
      trendRef.current = null;
      setTrend('steady');
      setStatus('connecting');
      setStatusDetail(null);
      setIsFillSimulationRunning(false);
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

  const startFillSimulation = useCallback(() => {
    if (!isSimulatedSource(source)) return;
    // El salto al tanque vacío no es una tendencia real: se descarta la referencia.
    trendRef.current = null;
    source.startFillSimulation();
  }, [source]);

  const stopFillSimulation = useCallback(() => {
    if (isSimulatedSource(source)) source.stopFillSimulation();
  }, [source]);

  const setManualLevel = useCallback(
    (levelPercent: number) => {
      if (isSimulatedSource(source)) source.setManualLevel(levelPercent);
    },
    [source]
  );

  const value = useMemo<TankContextValue>(
    () => ({
      mode,
      status,
      statusDetail,
      reading,
      capacityLiters,
      isStale: status !== 'connected' || reading === null,
      trend,
      alert,
      isDeviceAvailable: source.isAvailable,
      isSimulatedOnline,
      isFillSimulationRunning,
      setCapacityLiters,
      setMode,
      setSimulatedConnection,
      startFillSimulation,
      stopFillSimulation,
      setManualLevel,
    }),
    [
      mode,
      status,
      statusDetail,
      reading,
      capacityLiters,
      trend,
      alert,
      source,
      isSimulatedOnline,
      isFillSimulationRunning,
      setCapacityLiters,
      setMode,
      setSimulatedConnection,
      startFillSimulation,
      stopFillSimulation,
      setManualLevel,
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
