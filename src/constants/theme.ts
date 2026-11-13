/**
 * Paleta y tokens de la app.
 *
 * Un solo acento azul, tipografía casi negra sobre fondos cálidos y grises
 * apagados. Todo lo demás se resuelve con opacidades para mantener el
 * contraste y la profundidad sin sumar colores.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#15171B',
    background: '#F7F5F1',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#EDEAE4',
    textSecondary: '#6E747D',

    /** Superficies de la app. */
    surface: '#FFFFFF',
    surfaceMuted: '#EFEDE8',
    /** Texto terciario: unidades, metadatos. */
    textTertiary: '#9AA0A8',
    /** Separadores y bordes hairline. */
    hairline: 'rgba(21, 23, 27, 0.07)',
    /** Acento azul único. */
    accent: '#1B76D8',
    accentSoft: 'rgba(27, 118, 216, 0.10)',
    accentText: '#1464BC',

    /** Agua. */
    water: '#2E7BE0',
    waterSurface: '#5AA3F0',
    waterDeep: '#0E3A7C',
    /** Color del agua según la alerta del nivel (el azul de arriba es "OK"). */
    waterFull: '#17A398',
    waterFullSurface: '#5CCDC2',
    waterLow: '#E39A2B',
    waterLowSurface: '#F3C171',
    waterCritical: '#DE4A3E',
    waterCriticalSurface: '#F08D84',
    /** Haz y pulsos del sensor ultrasónico. */
    sensorBeam: '#1B76D8',
    sensorBody: '#2C6FB5',
    sensorTransducer: '#C9CED6',
    /** Sombra de profundidad al fondo del tanque. */
    waterDepth: 'rgba(8, 32, 72, 0.28)',
    /** Reflejo sobre la superficie del agua. */
    waterSheen: 'rgba(255, 255, 255, 0.30)',
    /** Vidrio del tanque. */
    glassTint: 'rgba(255, 255, 255, 0.55)',
    glassHighlight: 'rgba(255, 255, 255, 0.85)',
    /** Superficies translúcidas (cápsulas, sheets). */
    glassSurface: 'rgba(255, 255, 255, 0.72)',
    tankShadow: 'rgba(20, 32, 58, 0.10)',
    tankInnerShadow: 'rgba(20, 26, 40, 0.10)',
    /** Contorno y refuerzos del tanque. */
    tankStroke: 'rgba(21, 23, 27, 0.13)',

    /** Estados. El rojo sólo aparece en nivel crítico. */
    positive: '#1F7A52',
    positiveSoft: 'rgba(31, 122, 82, 0.10)',
    caution: '#A9700C',
    cautionSoft: 'rgba(169, 112, 12, 0.10)',
    critical: '#C0392B',
    criticalSoft: 'rgba(192, 57, 43, 0.10)',

    /** Scrim del sheet de configuración. */
    scrim: 'rgba(16, 19, 24, 0.32)',
  },
  dark: {
    text: '#F4F5F7',
    background: '#0E1013',
    backgroundElement: '#171A1F',
    backgroundSelected: '#22262C',
    textSecondary: '#99A0AA',

    surface: '#171A1F',
    surfaceMuted: '#1F232A',
    textTertiary: '#6C737D',
    hairline: 'rgba(255, 255, 255, 0.10)',
    accent: '#4C9BF2',
    accentSoft: 'rgba(76, 155, 242, 0.16)',
    accentText: '#8FBDF7',

    water: '#2E7BE0',
    waterSurface: '#6BAEF4',
    waterDeep: '#0A2A5C',
    waterFull: '#17A398',
    waterFullSurface: '#62D3C8',
    waterLow: '#E39A2B',
    waterLowSurface: '#F5C77E',
    waterCritical: '#DE4A3E',
    waterCriticalSurface: '#F2968D',
    sensorBeam: '#8FBDF7',
    sensorBody: '#2C6FB5',
    sensorTransducer: '#B7BDC6',
    waterDepth: 'rgba(2, 12, 30, 0.45)',
    waterSheen: 'rgba(255, 255, 255, 0.22)',
    glassTint: 'rgba(30, 34, 40, 0.60)',
    glassHighlight: 'rgba(255, 255, 255, 0.16)',
    glassSurface: 'rgba(23, 26, 31, 0.72)',
    tankShadow: 'rgba(0, 0, 0, 0.55)',
    tankInnerShadow: 'rgba(0, 0, 0, 0.35)',
    tankStroke: 'rgba(255, 255, 255, 0.14)',

    positive: '#4FC08D',
    positiveSoft: 'rgba(79, 192, 141, 0.16)',
    caution: '#E0A63C',
    cautionSoft: 'rgba(224, 166, 60, 0.16)',
    critical: '#F0655A',
    criticalSoft: 'rgba(240, 101, 90, 0.16)',

    scrim: 'rgba(0, 0, 0, 0.55)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

/** Radio de las superficies redondeadas de la app. */
export const Radius = {
  sm: 12,
  md: 18,
  lg: 26,
  pill: 999,
} as const;
