import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Modal,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInUp } from "react-native-reanimated";

import { useTheme } from "@/src/context/ThemeContext";
import { NxText } from "@/src/components/NxText";
import { fonts, radii, spacing } from "@/src/theme";
import {
  klipyTrending,
  klipySearch,
  klipyCategories,
  klipyPreview,
  klipyStickerTrending,
  klipyStickerSearch,
  klipyStickerPreview,
  type KlipyGif,
  type KlipyCategory,
} from "@/src/api/klipy";

const GRID_GAP = 6;
const GRID_PAD = spacing.md;

export type MediaTab = "gif" | "sticker";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (item: KlipyGif, tab: MediaTab) => void;
};

export function MediaPicker({ visible, onClose, onSelect }: Props) {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const sheetMaxHeight = Math.min(height * 0.68, 560);

  const [tab, setTab] = useState<MediaTab>("gif");
  const [gifs, setGifs] = useState<KlipyGif[]>([]);
  const [categories, setCategories] = useState<KlipyCategory[]>([]);
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const requestSeq = useRef(0);

  const isSticker = tab === "sticker";
  const effectiveTerm = category ?? term;

  const loadFirst = useCallback(
    async (q: string) => {
      const seq = ++requestSeq.current;
      setLoading(true);
      setError(false);
      setGifs([]);
      try {
        const res = isSticker
          ? q
            ? await klipyStickerSearch(q, 1)
            : await klipyStickerTrending(1)
          : q
            ? await klipySearch(q, 1)
            : await klipyTrending(1);
        if (seq !== requestSeq.current) return;
        setGifs(res.items);
        setPage(res.page);
        setHasNext(res.hasNext);
      } catch {
        if (seq === requestSeq.current) setError(true);
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    },
    [isSticker]
  );

  // Debounced search term.
  useEffect(() => {
    const t = setTimeout(() => {
      const q = query.trim();
      setTerm(q);
      if (category !== null && q !== category) setCategory(null);
    }, 350);
    return () => clearTimeout(t);
  }, [query, category]);

  // (Re)load when opened, tab, term or category changes.
  useEffect(() => {
    if (!visible) return;
    loadFirst(effectiveTerm);
  }, [visible, tab, effectiveTerm, loadFirst]);

  // Reset to trending when closed, so reopening starts fresh.
  useEffect(() => {
    if (visible) return;
    setQuery("");
    setTerm("");
    setCategory(null);
    setGifs([]);
    setError(false);
  }, [visible]);

  // Load gif categories once per open (stickers have no categories).
  useEffect(() => {
    if (!visible || isSticker || categories.length > 0) return;
    klipyCategories()
      .then(setCategories)
      .catch(() => {});
  }, [visible, isSticker, categories.length]);

  const loadMore = useCallback(async () => {
    if (!visible || loading || loadingMore || !hasNext || error) return;
    setLoadingMore(true);
    try {
      const res = isSticker
        ? effectiveTerm
          ? await klipyStickerSearch(effectiveTerm, page + 1)
          : await klipyStickerTrending(page + 1)
        : effectiveTerm
          ? await klipySearch(effectiveTerm, page + 1)
          : await klipyTrending(page + 1);
      setGifs((prev) => [...prev, ...res.items]);
      setPage(res.page);
      setHasNext(res.hasNext);
    } catch {
      // Keep scrolling silently; the next onEndReached will retry.
    } finally {
      setLoadingMore(false);
    }
  }, [visible, loading, loadingMore, hasNext, error, effectiveTerm, page, isSticker]);

  const handleCategory = (cat: KlipyCategory) => {
    setQuery(cat.query);
    setCategory(cat.query);
    Keyboard.dismiss();
  };

  const handleSelect = (item: KlipyGif) => {
    Keyboard.dismiss();
    onSelect(item, tab);
    onClose();
  };

  const switchTab = (next: MediaTab) => {
    if (next === tab) return;
    requestSeq.current++;
    setTab(next);
    setQuery("");
    setTerm("");
    setCategory(null);
    setGifs([]);
    setPage(1);
    setHasNext(false);
    setError(false);
  };

  // Grid: 4 per row on every screen.
  const columns = 4;
  const cellSize = (width - GRID_PAD * 2 - GRID_GAP * (columns - 1)) / columns;

  const renderItem = ({ item }: { item: KlipyGif }) => {
    const preview = isSticker ? klipyStickerPreview(item) : klipyPreview(item);
    return (
      <Pressable
        testID={`${tab}-item-${item.slug}`}
        onPress={() => handleSelect(item)}
        style={[
          styles.cell,
          { width: cellSize, height: cellSize, backgroundColor: colors.surfaceHigh },
        ]}
      >
        {preview ? (
          <ExpoImage source={{ uri: preview.url }} style={styles.cellImg} contentFit="cover" />
        ) : null}
      </Pressable>
    );
  };

  const footer =
    loading || loadingMore ? (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    ) : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
          {/* Backdrop is a sibling of the sheet so taps inside the sheet
              (search input, GIF cells) never bubble to a close handler. */}
          <Pressable testID="media-backdrop" style={StyleSheet.absoluteFill} onPress={onClose} />
          <Animated.View
            entering={FadeInUp.duration(220)}
            style={[
              styles.sheet,
              { backgroundColor: colors.backgroundElevated, borderColor: colors.border, maxHeight: sheetMaxHeight },
            ]}
          >
            {/* Header with tab pills */}
            <View style={styles.header}>
              <View style={styles.tabs}>
                <Pressable
                  testID="media-tab-gif"
                  onPress={() => switchTab("gif")}
                  style={[
                    styles.tab,
                    { backgroundColor: tab === "gif" ? colors.primary : colors.surface, borderColor: tab === "gif" ? colors.primary : colors.border },
                  ]}
                >
                  <NxText style={{ fontSize: 13, fontFamily: fonts.bodySemi, color: tab === "gif" ? colors.onPrimary : colors.foreground }}>
                    GIF
                  </NxText>
                </Pressable>
                <Pressable
                  testID="media-tab-sticker"
                  onPress={() => switchTab("sticker")}
                  style={[
                    styles.tab,
                    { backgroundColor: tab === "sticker" ? colors.primary : colors.surface, borderColor: tab === "sticker" ? colors.primary : colors.border },
                  ]}
                >
                  <NxText style={{ fontSize: 13, fontFamily: fonts.bodySemi, color: tab === "sticker" ? colors.onPrimary : colors.foreground }}>
                    Stickers
                  </NxText>
                </Pressable>
              </View>
              <Pressable testID="media-close" onPress={onClose} hitSlop={8} style={[styles.closeBtn, { backgroundColor: colors.surfaceHigh }]}>
                <Feather name="x" size={18} color={colors.mutedFg} />
              </Pressable>
            </View>

            {/* Search bar */}
            <View
              style={[
                styles.search,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Feather name="search" size={16} color={colors.mutedFg} />
              <TextInput
                testID="media-search"
                value={query}
                onChangeText={setQuery}
                placeholder={isSticker ? "Search stickers" : "Search GIFs"}
                placeholderTextColor={colors.mutedFg}
                returnKeyType="search"
                autoCorrect={false}
                style={[styles.searchInput, { color: colors.foreground }]}
              />
              {query.length > 0 ? (
                <Pressable onPress={() => { setQuery(""); setCategory(null); }} hitSlop={8}>
                  <Feather name="x-circle" size={16} color={colors.mutedFg} />
                </Pressable>
              ) : null}
            </View>

            {/* Category chips (GIF only) */}
            {!isSticker && categories.length > 0 ? (
              <FlatList
                horizontal
                data={categories}
                keyExtractor={(c) => c.query}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}
                style={styles.chipsRow}
                renderItem={({ item }) => {
                  const active = effectiveTerm === item.query;
                  return (
                    <Pressable
                      testID={`media-cat-${item.query}`}
                      onPress={() => handleCategory(item)}
                      style={[
                        styles.chip,
                        { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border },
                      ]}
                    >
                      <NxText
                        style={{
                          fontSize: 13,
                          fontFamily: fonts.bodySemi,
                          color: active ? colors.onPrimary : colors.foreground,
                        }}
                      >
                        {item.category}
                      </NxText>
                    </Pressable>
                  );
                }}
              />
            ) : null}

            {/* Grid */}
            <View style={{ flex: 1 }}>
              {error ? (
                <View style={styles.gridState}>
                  <Feather name="wifi-off" size={24} color={colors.mutedFg} />
                  <NxText variant="bodySm" style={{ color: colors.mutedFg, marginTop: 8, textAlign: "center" }}>
                    Could not load {isSticker ? "stickers" : "GIFs"}.
                  </NxText>
                  <Pressable
                    testID="media-retry"
                    onPress={() => loadFirst(effectiveTerm)}
                    style={[styles.retryBtn, { backgroundColor: colors.primary }]}
                  >
                    <NxText style={{ color: colors.onPrimary, fontFamily: fonts.bodySemi, fontSize: 13 }}>Try again</NxText>
                  </Pressable>
                </View>
              ) : loading ? (
                <View style={styles.gridState}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : gifs.length === 0 ? (
                <View style={styles.gridState}>
                  <Feather name="image" size={24} color={colors.mutedFg} />
                  <NxText variant="bodySm" style={{ color: colors.mutedFg, marginTop: 8, textAlign: "center" }}>
                    No {isSticker ? "stickers" : "GIFs"} found for “{effectiveTerm}”.
                  </NxText>
                </View>
              ) : (
                <FlatList
                  testID="media-grid"
                  data={gifs}
                  renderItem={renderItem}
                  keyExtractor={(g) => String(g.id)}
                  numColumns={4}
                  columnWrapperStyle={{ gap: GRID_GAP }}
                  contentContainerStyle={{ paddingHorizontal: GRID_PAD, gap: GRID_GAP, paddingTop: 4, paddingBottom: spacing.lg }}
                  showsVerticalScrollIndicator={false}
                  onEndReachedThreshold={0.4}
                  onEndReached={loadMore}
                  ListFooterComponent={footer}
                  keyboardShouldPersistTaps="handled"
                />
              )}
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
    paddingBottom: Platform.OS === "ios" ? 28 : spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  tabs: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  tab: {
    height: 34,
    paddingHorizontal: 16,
    borderRadius: 9999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.lg,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontFamily: "Outfit",
    fontSize: 15,
    paddingVertical: 0,
  },
  chipsRow: {
    flexGrow: 0,
  },
  chips: {
    paddingHorizontal: spacing.lg,
    paddingTop: 8,
    paddingBottom: 8,
    gap: spacing.sm,
  },
  chip: {
    height: 40,
    minHeight: 40,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9999,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  cell: {
    borderRadius: 10,
    overflow: "hidden",
  },
  cellImg: {
    width: "100%",
    height: "100%",
  },
  footer: {
    paddingVertical: 16,
    alignItems: "center",
  },
  gridState: {
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: spacing.xl,
    paddingTop: 12,
    paddingBottom: 24,
  },
  retryBtn: {
    marginTop: spacing.md,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radii.pill,
  },
});
