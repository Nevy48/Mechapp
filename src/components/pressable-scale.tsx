import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

export type PressableScaleProps = PressableProps & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Escala al presionar. */
  scaleTo?: number;
  /** Opacidad al presionar. */
  opacityTo?: number;
};

/**
 * Botón con respuesta táctil: una escala leve y un desvaneo de opacidad que
 * vuelven a su posición con un spring suave.
 */
export function PressableScale({
  children,
  style,
  scaleTo = 0.94,
  opacityTo = 0.7,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * (1 - scaleTo) }],
    opacity: 1 - pressed.value * (1 - opacityTo),
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        {...rest}
        onPressIn={(event) => {
          pressed.value = withTiming(1, { duration: 90 });
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          pressed.value = withSpring(0, { damping: 16, stiffness: 240, mass: 0.6 });
          onPressOut?.(event);
        }}>
        {children}
      </Pressable>
    </Animated.View>
  );
}
