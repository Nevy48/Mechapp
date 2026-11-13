import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { SplashOverlay } from '@/components/splash-overlay';
import { Colors } from '@/constants/theme';
import { TankProvider } from '@/providers/tank-provider';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <TankProvider>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.background },
          }}
        />
        <SplashOverlay />
      </TankProvider>
    </ThemeProvider>
  );
}
