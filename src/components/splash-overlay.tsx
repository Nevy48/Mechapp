import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

/** Tiempo que la marca permanece en pantalla antes de desvanecerse. */
const HOLD_MS = 900;

/**
 * Capa de bienvenida.
 *
 * Cubre el arranque de la app con la marca y se desvanece con un gesto suave,
 * de modo que la pantalla principal aparece sin cortes.
 */
export function SplashOverlay() {
  const theme = useTheme();
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {
      // El splash nativo puede estar ya oculto: no es un error.
    });

    const timer = setTimeout(() => setMounted(false), HOLD_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) return null;

  return (
    <Animated.View
      exiting={FadeOut.duration(320)}
      style={[styles.overlay, { backgroundColor: theme.background }]}>
      <Animated.View entering={FadeInDown.delay(80).duration(620)}>
        <ThemedText type="headline" style={styles.wordmark}>
          Aqua
        </ThemedText>
      </Animated.View>
      <Animated.View entering={FadeIn.delay(420).duration(520)} style={styles.caption}>
        <ThemedText type="caption" themeColor="textTertiary">
          Nivel de agua del tanque
        </ThemedText>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  wordmark: {
    letterSpacing: -0.6,
  },
  caption: {
    marginTop: 6,
  },
});
