import { useEffect, useState } from "react";
import { View, StyleSheet, Image } from "react-native";
import { useRouter } from "expo-router";

import { useAuth } from "@/src/context/AuthContext";

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [holdDone, setHoldDone] = useState(false);

  // Show the Emergent splash image for a moment even after auth finishes loading.
  useEffect(() => {
    const t = setTimeout(() => setHoldDone(true), 1400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (loading || !holdDone) return;
    if (user) router.replace("/(app)/feed");
    else router.replace("/(auth)/welcome");
  }, [loading, holdDone, user, router]);

  return (
    <View style={styles.root}>
      <Image
        source={require("../assets/images/splash-image.png")}
        style={styles.image}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#070709", alignItems: "center", justifyContent: "center" },
  image: { width: "100%", height: "100%" },
});
