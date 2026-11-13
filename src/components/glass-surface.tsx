import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

function detectLiquidGlass(): boolean {
  try {
    return isLiquidGlassAvailable();
  } catch {
    // El módulo nativo no está disponible (por ejemplo, una versión anterior
    // de Expo Go): se usa la superficie translúcida de respaldo.
    return false;
  }
}

const supportsLiquidGlass = detectLiquidGlass();

export type GlassSurfaceProps = ViewProps & PropsWithChildren;

/**
 * Superficie translúcida.
 *
 * En iOS 26+ usa el material real de "Liquid Glass"; en el resto de las
 * plataformas cae en una superficie translúcida con borde hairline para que
 * el diseño se mantenga consistente.
 */
export function GlassSurface({ style, children, ...rest }: GlassSurfaceProps) {
  const theme = useTheme();

  if (supportsLiquidGlass) {
    return (
      <GlassView glassEffectStyle="regular" style={style} {...rest}>
        {children}
      </GlassView>
    );
  }

  return (
    <View
      style={[style, styles.fallback, { backgroundColor: theme.glassSurface, borderColor: theme.hairline }]}
      {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});
