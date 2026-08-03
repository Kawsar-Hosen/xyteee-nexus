import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  Linking,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/src/context/ThemeContext";
import { NxText } from "@/src/components/NxText";
import { fonts, radii } from "@/src/theme";
import { api } from "@/src/api/client";

const CARD_W = 236;

type Preview = {
  url: string;
  domain: string;
  title?: string | null;
  description?: string | null;
  image?: string | null;
  favicon?: string | null;
};

const cache = new Map<string, Preview | "loading">();

function safeDomain(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function openUrl(url: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.open(url, "_blank");
  } else {
    Linking.openURL(url).catch(() => {});
  }
}

export function LinkPreview({
  url,
  token,
  bg,
  fg,
  muted,
}: {
  url: string;
  token?: string | null;
  bg: string;
  fg: string;
  muted: string;
}) {
  const { colors } = useTheme();
  const [data, setData] = useState<Preview | null>(() => {
    const c = cache.get(url);
    return c && c !== "loading" ? c : null;
  });
  const [loading, setLoading] = useState(() => !data);

  useEffect(() => {
    let alive = true;
    const cached = cache.get(url);
    if (cached && cached !== "loading") {
      setData(cached);
      setLoading(false);
      return;
    }

    if (!cached) cache.set(url, "loading");

    api<Preview>("/link/preview", { token, query: { url } })
      .then((d) => {
        const normalized: Preview = {
          url: d.url || url,
          domain: d.domain || safeDomain(url),
          title: d.title,
          description: d.description,
          image: d.image,
          favicon: d.favicon,
        };
        cache.set(url, normalized);
        if (alive) {
          setData(normalized);
          setLoading(false);
        }
      })
      .catch(() => {
        const fallback: Preview = {
          url,
          domain: safeDomain(url),
          title: null,
          description: null,
          image: null,
          favicon: null,
        };
        cache.set(url, fallback);
        if (alive) {
          setData(fallback);
          setLoading(false);
        }
      });

    return () => {
      alive = false;
    };
  }, [url, token]);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => openUrl(url)}
      style={[
        styles.card,
        { backgroundColor: bg, borderColor: muted + "44" },
      ]}
    >
      {loading ? (
        <View style={[styles.loadingBox, { borderColor: muted + "44" }]}>
          <ActivityIndicator size="small" color={fg} />
          <NxText style={[styles.loadingText, { color: muted }]}>
            Fetching preview…
          </NxText>
        </View>
      ) : (
        <>
          {data?.image ? (
            <Image
              source={{ uri: data.image }}
              resizeMode="cover"
              style={styles.cover}
            />
          ) : null}

          <View style={styles.body}>
            <View style={styles.domainRow}>
              {data?.favicon ? (
                <Image
                  source={{ uri: data.favicon }}
                  style={[styles.favicon, { borderColor: muted + "55" }]}
                />
              ) : (
                <Feather name="globe" size={12} color={muted} />
              )}
              <NxText numberOfLines={1} style={[styles.domain, { color: muted }]}>
                {data?.domain || safeDomain(url)}
              </NxText>
            </View>

            <NxText numberOfLines={2} style={[styles.title, { color: fg }]}>
              {data?.title || safeDomain(url)}
            </NxText>

            {data?.description ? (
              <NxText numberOfLines={2} style={[styles.desc, { color: muted }]}>
                {data.description}
              </NxText>
            ) : null}

            <View style={[styles.footer, { borderTopColor: muted + "44" }]}>
              <Feather name="external-link" size={11} color={muted} />
              <NxText style={[styles.openText, { color: muted }]}>
                Open in browser
              </NxText>
            </View>
          </View>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
  loadingBox: {
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  loadingText: {
    fontSize: 12,
    marginTop: 8,
  },
  cover: {
    width: CARD_W,
    height: 120,
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  body: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  domainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  favicon: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  domain: {
    flex: 1,
    fontSize: 11,
    fontFamily: fonts.bodyMedium,
  },
  title: {
    fontSize: 13.5,
    fontFamily: fonts.bodySemi,
    lineHeight: 18,
    marginTop: 5,
  },
  desc: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 9,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  openText: {
    fontSize: 11,
    fontFamily: fonts.bodySemi,
  },
});
