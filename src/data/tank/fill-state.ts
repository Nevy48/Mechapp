import type { LevelAlert } from './alert';
import type { FillControlState, FillFault, FillState } from './types';

/** Nombre corto de cada estado del llenado. */
export const FILL_STATE_LABELS: Record<FillState, string> = {
  idle: 'En reposo',
  waitingCistern: 'Esperando agua',
  filling: 'Llenando',
  fault: 'Falla',
  locked: 'Bloqueado',
};

/** Qué pasó, en palabras del usuario. */
export const FILL_FAULT_LABELS: Record<FillFault, string> = {
  noFlow: 'La bomba funcionó pero el nivel no subió',
  timeout: 'El llenado superó el tiempo máximo',
  sensor: 'El sensor de nivel dio una lectura inválida',
};

/** Qué conviene revisar ante cada falla. */
export const FILL_FAULT_HINTS: Record<FillFault, string> = {
  noFlow: 'Revisá la bomba, que esté cebada, y que no haya llaves cerradas en la cañería.',
  timeout: 'Puede haber una pérdida o la bomba rinde menos de lo normal.',
  sensor: 'Revisá el sensor de la tapa del tanque y su cableado.',
};

export type EventTone = 'info' | 'positive' | 'caution' | 'critical';

export interface TankEvent {
  id: string;
  timestamp: number;
  tone: EventTone;
  title: string;
  detail?: string;
}

/**
 * Aviso destacado que la app muestra según el estado del control.
 * `null` cuando todo funciona normalmente.
 */
export interface ControlNotice {
  tone: Exclude<EventTone, 'info' | 'positive'>;
  title: string;
  message: string;
}

export function getControlNotice(control: FillControlState | null): ControlNotice | null {
  if (!control) return null;

  if (control.fillState === 'locked') {
    return {
      tone: 'critical',
      title: 'Llenado bloqueado',
      message: `${control.fault ? FILL_FAULT_LABELS[control.fault] : 'Fallaron varios intentos seguidos'}. Reiniciá el equipo después de revisar la instalación.`,
    };
  }
  if (control.fillState === 'fault') {
    return {
      tone: 'critical',
      title: 'Falla en el llenado',
      message: `${control.fault ? FILL_FAULT_LABELS[control.fault] : 'Se cortó el llenado'}. Va a reintentar solo en unos segundos.`,
    };
  }
  if (control.fillState === 'waitingCistern') {
    return {
      tone: 'caution',
      title: 'La cisterna está vacía',
      message: 'El tanque necesita agua, pero la bomba no arranca hasta que la cisterna se llene.',
    };
  }
  if (!control.sensorOk) {
    return {
      tone: 'critical',
      title: 'Falla del sensor',
      message: FILL_FAULT_HINTS.sensor,
    };
  }
  return null;
}

let eventCounter = 0;

function makeEvent(timestamp: number, tone: EventTone, title: string, detail?: string): TankEvent {
  eventCounter += 1;
  return { id: `${timestamp}-${eventCounter}`, timestamp, tone, title, detail };
}

/**
 * Eventos que se desprenden de pasar de un estado a otro: arranque y corte de
 * la bomba, cambios de la cisterna, fallas y alertas de nivel.
 */
export function deriveEvents(
  previous: { control: FillControlState | null; alert: LevelAlert | null } | null,
  next: { control: FillControlState | null; alert: LevelAlert | null; levelPercent: number },
  timestamp: number
): TankEvent[] {
  const events: TankEvent[] = [];
  const prev = previous?.control ?? null;
  const curr = next.control;
  const level = `${Math.round(next.levelPercent)}%`;

  if (curr && prev) {
    if (!prev.pumpOn && curr.pumpOn) {
      events.push(makeEvent(timestamp, 'info', 'Bomba encendida', `Arrancó el llenado con el tanque al ${level}`));
    }
    if (prev.pumpOn && !curr.pumpOn) {
      if (curr.fillState === 'idle') {
        events.push(makeEvent(timestamp, 'positive', 'Tanque lleno', `La bomba cortó al ${level}`));
      } else if (curr.fillState === 'waitingCistern') {
        events.push(makeEvent(timestamp, 'caution', 'Bomba apagada', 'La cisterna se quedó sin agua'));
      } else {
        events.push(makeEvent(timestamp, 'caution', 'Bomba apagada', `Se cortó al ${level}`));
      }
    }
    if (prev.cisternHasWater !== curr.cisternHasWater && curr.cisternHasWater !== null) {
      events.push(
        curr.cisternHasWater
          ? makeEvent(timestamp, 'positive', 'La cisterna tiene agua')
          : makeEvent(timestamp, 'caution', 'Cisterna vacía', 'El automático de la cisterna abrió')
      );
    }
    if (prev.fillState !== curr.fillState) {
      if (curr.fillState === 'fault') {
        events.push(
          makeEvent(
            timestamp,
            'critical',
            'Falla en el llenado',
            curr.fault ? FILL_FAULT_LABELS[curr.fault] : undefined
          )
        );
      }
      if (curr.fillState === 'locked') {
        events.push(makeEvent(timestamp, 'critical', 'Llenado bloqueado', 'Requiere reiniciar el equipo'));
      }
      if (curr.fillState === 'waitingCistern' && !prev.pumpOn) {
        events.push(makeEvent(timestamp, 'caution', 'Esperando agua de la cisterna', `Tanque al ${level}`));
      }
      if ((prev.fillState === 'fault' || prev.fillState === 'locked') && curr.fillState === 'idle') {
        events.push(makeEvent(timestamp, 'info', 'Control listo para reintentar'));
      }
    }
  }

  const prevAlert = previous?.alert ?? null;
  if (prevAlert !== null && prevAlert !== next.alert) {
    if (next.alert === 'critical') {
      events.push(makeEvent(timestamp, 'critical', 'Nivel crítico', `Quedan ${level}`));
    } else if (next.alert === 'low' && prevAlert !== 'critical') {
      events.push(makeEvent(timestamp, 'caution', 'Nivel bajo', `Quedan ${level}`));
    }
  }

  return events;
}
