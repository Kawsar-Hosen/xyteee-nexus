import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { NxText } from "@/src/components/NxText";

type MediaMessage = {
  message_id: string;
  kind: string;
  media?: string | null;
  created_at: string;
};

const GAP = 3;
const SIZE = (Dimensions.get("window").width - GAP * 2) / 3;

function MediaVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (videoPlayer) => {
    videoPlayer.loop = false;
  });

  return (
    <VideoView
      player={player}
      style={styles.media}
      contentFit="cover"
      nativeControls={false}
      pointerEvents="none"
    />
  );
}

function FullscreenVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.play();
  });

  return (
    <VideoView
      player={player}
      style={{ width: "100%", height: "100%" }}
      contentFit="contain"
      nativeControls
    />
  );
}

export default function CircleSharedMediaPage() {
  const { colors } = useTheme();
  const { token } = useAuth();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [media, setMedia] = useState<MediaMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<MediaMessage | null>(null);

  const load = useCallback(async () => {
    if (!token || !id) return;

    try {
      const result = await api<{ messages: MediaMessage[] }>(
        `/circles/${id}/messages`,
        { token }
      );

      setMedia(
        (result.messages || []).filter(
          (item) =>
            (item.kind === "image" || item.kind === "video") &&
            !!item.media
        )
      );
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[
            styles.headerBtn,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>

        <NxText style={[styles.title, { color: colors.foreground }]}>
          Shared media
        </NxText>

        <View style={styles.headerBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={media}
          keyExtractor={(item) => item.message_id}
          numColumns={3}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={{ gap: GAP }}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setSelectedMedia(item)}
              style={styles.mediaItem}
            >
              {item.kind === "image" ? (
                <Image
                  source={{ uri: item.media! }}
                  style={styles.media}
                  resizeMode="cover"
                />
              ) : (
                <>
                  <MediaVideo uri={item.media!} />
                  <View style={styles.videoBadge}>
                    <Feather name="play" size={14} color="#fff" />
                  </View>
                </>
              )}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="image" size={34} color={colors.mutedFg} />
              <NxText style={{ color: colors.mutedFg, marginTop: 10 }}>
                No shared media yet
              </NxText>
            </View>
          }
        />
      )}

      <Modal
        visible={!!selectedMedia}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMedia(null)}
      >
        <View style={styles.viewer}>
          {selectedMedia?.kind === "image" ? (
            <Image
              source={{ uri: selectedMedia.media! }}
              style={styles.viewerMedia}
              resizeMode="contain"
            />
          ) : selectedMedia?.kind === "video" ? (
            <FullscreenVideo uri={selectedMedia.media!} />
          ) : null}

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setSelectedMedia(null)}
            style={styles.closeBtn}
          >
            <Feather name="x" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  mediaItem: {
    width: SIZE,
    height: SIZE,
    position: "relative",
  },
  media: {
    width: "100%",
    height: "100%",
  },
  videoBadge: {
    position: "absolute",
    right: 7,
    top: 7,
  },
  empty: {
    paddingTop: 100,
    alignItems: "center",
  },
  viewer: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  viewerMedia: {
    width: "100%",
    height: "100%",
  },
  closeBtn: {
    position: "absolute",
    top: 50,
    right: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
});
