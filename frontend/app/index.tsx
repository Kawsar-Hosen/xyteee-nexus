import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { useAuth } from "@/src/context/AuthContext";
import { NexusMark } from "@/src/components/NexusMark";

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [holdDone, setHoldDone] = useState(false);

  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.88)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 45,
        useNativeDriver: true,
      }),
    ]).start();

    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.045,
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    pulseAnimation.start();

    const timer = setTimeout(() => setHoldDone(true), 1600);

    return () => {
      clearTimeout(timer);
      pulseAnimation.stop();
    };
  }, [opacity, scale, pulse]);

  useEffect(() => {
    if (loading || !holdDone) return;

    Animated.timing(opacity, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      if (user) router.replace("/(app)/feed");
      else router.replace("/(auth)/welcome");
    });
  }, [loading, holdDone, user, router, opacity]);

  return (
    <View style={styles.root}>
      <Animated.View
        style={[
          styles.brand,
          {
            opacity,
            transform: [{ scale }, { scale: pulse }],
          },
        ]}
      >
        <NexusMark size={112} />

        <Text style={styles.xyteee}>XYTEEE</Text>
        <Text style={styles.nexus}>NEXUS</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#070709",
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    alignItems: "center",
    justifyContent: "center",
  },
  xyteee: {
    marginTop: 24,
    color: "#F4F1EA",
    fontSize: 32,
    fontWeight: "600",
    letterSpacing: 8,
  },
  nexus: {
    marginTop: 8,
    color: "#B07A3A",
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 7,
  },
});
