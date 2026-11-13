import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/**
 * Icono de ajustes dibujado con vistas nativas: tres barras de distinto
 * largo. Evita depender de una fuente de iconos y mantiene el trazo fino
 * del resto de la interfaz.
 */
export function TuneIcon({ size = 18 }: { size?: number }) {
  const theme = useTheme();
  const barHeight = Math.max(1.5, size * 0.09);

  return (
    <View style={[styles.container, { height: size, width: size }]}>
      <View
        style={[styles.bar, { width: size * 0.92, height: barHeight, backgroundColor: theme.text }]}
      />
      <View
        style={[styles.bar, { width: size * 0.6, height: barHeight, backgroundColor: theme.text }]}
      />
      <View
        style={[styles.bar, { width: size * 0.78, height: barHeight, backgroundColor: theme.text }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  bar: {
    borderRadius: 2,
  },
});
