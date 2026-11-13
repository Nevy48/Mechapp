/**
 * Formateo de números y tiempos en español rioplatense.
 *
 * Separador de miles: punto (1.000 L). Sin coma decimal porque los valores
 * que se muestran son enteros.
 */

/** 1234 → "1.234" */
export function formatNumber(value: number): string {
  const safe = Number.isFinite(value) ? Math.round(value) : 0;
  const sign = safe < 0 ? '-' : '';
  const digits = Math.abs(safe).toString();

  let grouped = '';
  for (let index = 0; index < digits.length; index += 1) {
    if (index > 0 && (digits.length - index) % 3 === 0) {
      grouped += '.';
    }
    grouped += digits[index];
  }

  return `${sign}${grouped}`;
}

/** 68.4 → "68%" */
export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

/** 1000 → "1.000 L" */
export function formatLiters(value: number): string {
  return `${formatNumber(value)} L`;
}

/**
 * Tiempo transcurrido desde una medición, en lenguaje natural y breve.
 * `null` cuando todavía no hay ninguna medición.
 */
export function formatElapsed(timestamp: number | null, now: number): string | null {
  if (timestamp === null) return null;

  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 5) return 'ahora';
  if (seconds < 60) return `hace ${seconds} s`;

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;

  const hours = Math.round(minutes / 60);
  return `hace ${hours} h`;
}
