import { useEffect, useState } from 'react';

/**
 * Reloj que se actualiza cada `intervalMs`.
 * Se usa para mostrar "Actualizado hace 8 s" sin recargar toda la pantalla.
 * `enabled` permite detener el temporizador cuando el dato no está a la vista.
 */
export function useNow(intervalMs = 1000, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;

    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, enabled]);

  return now;
}
