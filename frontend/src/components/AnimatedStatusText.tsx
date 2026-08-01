import React, { useEffect } from "react";
import { Platform, StyleProp, TextStyle } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

type Props = {
  children: React.ReactNode;
  color: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
};

export function AnimatedStatusText({
  children,
  color,
  style,
  numberOfLines = 2,
}: Props) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.58, { duration: 1300 }),
        withTiming(1, { duration: 1300 })
      ),
      -1,
      false
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.Text
      entering={FadeIn.duration(500)}
      numberOfLines={numberOfLines}
      style={[
        {
          color,
          fontFamily: Platform.OS === "ios" ? "System" : "sans-serif",
          fontSize: 14,
          lineHeight: 19,
          fontStyle: "normal",
          fontWeight: "400",
        },
        style,
        animatedStyle,
      ]}
    >
      {children}
    </Animated.Text>
  );
}
