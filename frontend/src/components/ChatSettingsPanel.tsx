import React, { useState } from "react";
import {
  View,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Image,
  TextInput,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import Animated, {
  FadeInDown,
  FadeInUp,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { NxText } from "@/src/components/NxText";
import { Avatar } from "@/src/components/Avatar";
import { VerifiedBadge } from "@/src/components/VerifiedBadge";
import { fonts, radii, spacing } from "@/src/theme";
import {
  CHAT_THEMES,
  CHAT_WALLPAPERS,
  ChatThemeKey,
  ChatWallpaperKey,
  useChatSettings,
} from "@/src/hooks/useChatSettings";

function SwitchRow({
  icon,
  title,
  sub,
  value,
  onValueChange,
  tint,
}: {
  icon: any;
  title: string;
  sub?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  tint?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.settingRow, { borderColor: colors.border }]}>
      <View style={[styles.settingIcon, { backgroundColor: tint ? tint + "22" : colors.accent }]}>
        <Feather name={icon} size={17} color={tint || colors.foreground} />
      </View>
      <View style={{ flex: 1, marginLeft: 14 }}>
        <NxText style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.foreground }}>{title}</NxText>
        {sub ? <NxText variant="caption" style={{ marginTop: 2 }}>{sub}</NxText> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.accent, true: tint || colors.primary }}
        thumbColor={colors.surfaceHigh}
        ios_backgroundColor={colors.accent}
      />
    </View>
  );
}

function ActionRow({
  icon,
  title,
  sub,
  onPress,
  danger,
}: {
  icon: any;
  title: string;
  sub?: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const { colors } = useTheme();
  const c = danger ? colors.danger : colors.foreground;
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.settingRow, { borderColor: colors.border }]}
    >
      <View style={[styles.settingIcon, { backgroundColor: danger ? colors.danger + "1F" : colors.accent }]}>
        <Feather name={icon} size={17} color={c} />
      </View>
      <View style={{ flex: 1, marginLeft: 14 }}>
        <NxText style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: c }}>{title}</NxText>
        {sub ? <NxText variant="caption" style={{ marginTop: 2 }}>{sub}</NxText> : null}
      </View>
      <Feather name="chevron-right" size={18} color={danger ? colors.danger + "66" : colors.mutedFg} />
    </TouchableOpacity>
  );
}

export function ChatSettingsPanel({
  visible,
  onClose,
  conversationId,
  other,
  messages,
  onSearch,
  onClearChat,
  onDeleteConversation,
  onBlock,
}: {
  visible: boolean;
  onClose: () => void;
  conversationId: string;
  other?: any;
  messages: any[];
  onSearch: () => void;
  onClearChat: () => void;
  onDeleteConversation: () => void;
  onBlock: () => void;
}) {
  const { colors } = useTheme();
  const router = useRouter();
  const { settings, set, loaded } = useChatSettings(conversationId);
  const { width } = useWindowDimensions();
  const [section, setSection] = useState<"main" | "photos" | "videos" | "report">("main");
  const [reportCategory, setReportCategory] = useState<string | null>(null);
  const [reportDesc, setReportDesc] = useState("");
  const [reportSending, setReportSending] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const isNarrow = width < 380;
  const photos = messages.filter((m) => m.kind === "image" && m.media && !m.deleted_for_everyone);
  const videos = messages.filter((m) => m.kind === "video" && m.media && !m.deleted_for_everyone);

  const activeTheme: ChatThemeKey = settings.theme;
  const activeWallpaper: ChatWallpaperKey = settings.wallpaper;

  const statusText = other?.online
    ? other.online_status === "idle"
      ? "Idle"
      : other.online_status === "dnd"
        ? "Do Not Disturb"
        : "Online"
    : other?.last_seen
      ? `Last seen recently`
      : "Offline";

  const openProfile = () => {
    if (other?.user_id) router.push(`/user/${other.user_id}`);
  };

  const openSearch = () => {
    onClose();
    onSearch();
  };

  const renderMediaPreview = (key: "photos" | "videos") => {
    const items = key === "photos" ? photos : videos;
    return (
      <View style={{ flex: 1 }}>
        <GridSection
          title={key === "photos" ? "Shared Photos" : "Shared Videos"}
          icon={key === "photos" ? "image" : "video"}
          items={items.map((m) => m.media!)}
          empty={key === "photos" ? "No shared photos yet" : "No shared videos yet"}
        />
      </View>
    );
  };

  const goBack = () => {
    if (section === "main") onClose();
    else setSection("main");
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        {/* ── Header ── */}
        <Animated.View
          entering={FadeInDown.duration(300)}
          style={[styles.topBar, { borderBottomColor: colors.border, backgroundColor: colors.glass }]}
        >
          <TouchableOpacity testID="chat-settings-back" onPress={goBack} style={styles.topBtn}>
            <Feather name={section === "main" ? "x" : "chevron-left"} size={24} color={colors.foreground} />
          </TouchableOpacity>
          <NxText style={[styles.topTitle, { color: colors.foreground }]}>
            {section === "main" ? "Chat Settings" : sectionLabel(section)}
          </NxText>
          <View style={styles.topBtn} />
        </Animated.View>

        {!loaded ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : section === "report" ? (
          <ReportForm
            other={other}
            conversationId={conversationId}
            onClose={onClose}
            onBack={() => setSection("main")}
          />
        ) : section === "photos" || section === "videos" ? (
          renderMediaPreview(section)
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 60 }}
          >
            {/* ── Profile orbit ── */}
            <Animated.View entering={FadeInUp.duration(400)}>
              <View style={[styles.orbitWrap, { backgroundColor: colors.background }]}>
                <View
                  style={[
                    styles.orbitHalo,
                    {
                      borderColor: colors.primary + "40",
                      backgroundColor: colors.primary + "0D",
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.orbitHaloInner,
                      { borderColor: colors.primary + "55", backgroundColor: colors.primary + "14" },
                    ]}
                  >
                    <Avatar
                      uri={other?.profile_picture}
                      name={other?.display_name}
                      size={isNarrow ? 84 : 96}
                      frame={other?.profile_frame}
                      achievement={other?.achievement_level}
                      animation={other?.profile_animation}
                      animationSpeed={other?.profile_animation_speed}
                      animationIntensity={other?.profile_animation_intensity}
                      online={other?.online}
                      onlineStatus={other?.online_status || "online"}
                    />
                  </View>
                </View>
                <View style={styles.orbitNameRow}>
                  <NxText
                    style={{
                      fontFamily: "PlayfairDisplay-Bold",
                      fontSize: isNarrow ? 24 : 28,
                      lineHeight: 34,
                      color: colors.foreground,
                      textAlign: "center",
                    }}
                    numberOfLines={1}
                  >
                    {other?.display_name || "…"}
                  </NxText>
                  <VerifiedBadge
                    badgeType={other?.badge_type}
                    badgeIcon={other?.badge_icon}
                    badgeExpiresAt={other?.badge_expires_at}
                    size={18}
                  />
                </View>
                {other?.username ? (
                  <NxText style={{ color: colors.mutedFg, textAlign: "center", fontSize: 13, marginTop: 2 }}>
                    @{other.username}
                  </NxText>
                ) : null}
                <View style={[styles.statusChip, { backgroundColor: colors.surfaceHigh, borderColor: colors.border }]}>
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor: other?.online
                          ? other.online_status === "idle"
                            ? "#F0B232"
                            : other.online_status === "dnd"
                              ? "#F23F43"
                              : colors.online
                          : colors.mutedFg,
                      },
                    ]}
                  />
                  <NxText style={{ color: colors.foreground, fontSize: 12.5, fontFamily: fonts.bodyMedium }}>
                    {statusText}
                  </NxText>
                </View>
              </View>
            </Animated.View>

            {/* ── Options ── */}
            <Animated.View entering={FadeInUp.duration(350).delay(90)}>
              <NxText variant="label" style={[styles.sectionLabel, { color: colors.mutedFg }]}>
                Options
              </NxText>
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <ActionRow icon="user" title="Profile" sub={`View @${other?.username || "profile"}`} onPress={openProfile} />
                <ActionRow icon="search" title="Search" sub="Search this chat" onPress={openSearch} />
                <ActionRow icon="image" title="Shared Photos" sub={`${photos.length} photo${photos.length === 1 ? "" : "s"}`} onPress={() => setSection("photos")} />
                <ActionRow icon="video" title="Shared Videos" sub={`${videos.length} video${videos.length === 1 ? "" : "s"}`} onPress={() => setSection("videos")} />
              </View>
            </Animated.View>

            {/* ── Chat Settings ── */}
            <Animated.View entering={FadeInUp.duration(350).delay(120)}>
              <NxText variant="label" style={[styles.sectionLabel, { color: colors.mutedFg }]}>
                Chat Settings
              </NxText>
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <SwitchRow
                  icon="bell-off"
                  title="Mute Notifications"
                  sub="Silence this conversation"
                  value={settings.muted}
                  onValueChange={(v) => set("muted", v)}
                  tint={colors.primary}
                />
                <SwitchRow
                  icon="volume-2"
                  title="Notification Sound"
                  sub="Play a sound for new messages"
                  value={settings.soundEnabled}
                  onValueChange={(v) => set("soundEnabled", v)}
                />
                <SwitchRow
                  icon="eye"
                  title="Read Receipts"
                  sub="Show when messages are read"
                  value={settings.readReceipts}
                  onValueChange={(v) => set("readReceipts", v)}
                />
                <SwitchRow
                  icon="message-square"
                  title="Typing Indicator"
                  sub="Show when the other person is typing"
                  value={settings.typingIndicator}
                  onValueChange={(v) => set("typingIndicator", v)}
                />
                <SwitchRow
                  icon="archive"
                  title="Archive Chat"
                  sub="Move this chat to archive"
                  value={settings.archived}
                  onValueChange={(v) => set("archived", v)}
                />
              </View>
            </Animated.View>

            {/* ── Chat Theme ── */}
            <Animated.View entering={FadeInUp.duration(350).delay(180)}>
              <NxText variant="label" style={[styles.sectionLabel, { color: colors.mutedFg }]}>
                Appearance
              </NxText>
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.settingRow, { borderColor: colors.border }]}>
                  <View style={[styles.settingIcon, { backgroundColor: colors.accent }]}>
                    <Feather name="droplet" size={17} color={colors.foreground} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <NxText style={{ fontFamily: fonts.bodyMedium, fontSize: 15 }}>Chat Theme</NxText>
                  </View>
                </View>
                <View style={styles.swatchRow}>
                  {(Object.keys(CHAT_THEMES) as ChatThemeKey[]).map((key) => {
                    const t = CHAT_THEMES[key];
                    const active = activeTheme === key;
                    return (
                      <TouchableOpacity
                        key={key}
                        testID={`theme-${key}`}
                        onPress={() => set("theme", key)}
                        activeOpacity={0.8}
                        style={{ alignItems: "center", width: isNarrow ? 52 : 56 }}
                      >
                        <View
                          style={[
                            styles.swatch,
                            { backgroundColor: t.sent, borderColor: active ? colors.foreground : "transparent" },
                          ]}
                        >
                          {active ? <Feather name="check" size={16} color={t.sentFg} /> : null}
                        </View>
                        <NxText style={{ marginTop: 5, fontSize: 9.5, textAlign: "center", color: active ? colors.foreground : colors.mutedFg }}>
                          {t.label}
                        </NxText>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={[styles.settingRow, { borderColor: colors.border }]}>
                  <View style={[styles.settingIcon, { backgroundColor: colors.accent }]}>
                    <Feather name="image" size={17} color={colors.foreground} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <NxText style={{ fontFamily: fonts.bodyMedium, fontSize: 15 }}>Chat Wallpaper</NxText>
                  </View>
                </View>
                <View style={styles.swatchRow}>
                  {(Object.keys(CHAT_WALLPAPERS) as ChatWallpaperKey[]).map((key) => {
                    const w = CHAT_WALLPAPERS[key];
                    const active = activeWallpaper === key;
                    return (
                      <TouchableOpacity
                        key={key}
                        testID={`wallpaper-${key}`}
                        onPress={() => set("wallpaper", key)}
                        activeOpacity={0.8}
                        style={{ alignItems: "center", width: isNarrow ? 52 : 56 }}
                      >
                        <View
                          style={[
                            styles.wallSwatch,
                            { backgroundColor: w.bg, borderColor: active ? colors.foreground : colors.borderStrong },
                          ]}
                        >
                          {active ? <Feather name="check" size={16} color="#fff" /> : null}
                        </View>
                        <NxText style={{ marginTop: 5, fontSize: 9.5, textAlign: "center", color: active ? colors.foreground : colors.mutedFg }}>
                          {w.label}
                        </NxText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </Animated.View>

            {/* ── Actions / Danger zone ── */}
            <Animated.View entering={FadeInUp.duration(350).delay(240)}>
              <NxText variant="label" style={[styles.sectionLabel, { color: colors.mutedFg }]}>
                Actions
              </NxText>
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <ActionRow icon="shield" title="Block User" sub={`Block @${other?.username || "user"}`} onPress={onBlock} danger />
                <ActionRow icon="flag" title="Report User" sub="Report this conversation" onPress={() => setSection("report")} danger />
                <ActionRow icon="trash-2" title="Clear Chat" sub="Delete all messages on this device" onPress={onClearChat} danger />
                <ActionRow icon="slash" title="Delete Conversation" sub="Remove this chat entirely" onPress={onDeleteConversation} danger />
              </View>
            </Animated.View>
          </ScrollView>
        )}

        <Animated.View entering={FadeInUp.duration(500).delay(200)} style={[styles.bottomGlow, { backgroundColor: colors.primary + "0A" }]} />
      </View>
    </Modal>
  );
}

function sectionLabel(key: "main" | "photos" | "videos" | "report") {
  switch (key) {
    case "photos": return "Shared Photos";
    case "videos": return "Shared Videos";
    case "report": return "Report User";
    default: return "";
  }
}

function GridSection({
  title,
  icon,
  items,
  empty,
}: {
  title: string;
  icon: any;
  items: string[];
  empty: string;
}) {
  const { colors } = useTheme();
  return (
    <Animated.View entering={FadeInUp.duration(300)} style={{ flex: 1, paddingHorizontal: spacing.lg }}>
      {items.length === 0 ? (
        <View style={{ alignItems: "center", justifyContent: "center", paddingTop: 120 }}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.accent }]}>
            <Feather name={icon} size={28} color={colors.mutedFg} />
          </View>
          <NxText style={{ marginTop: 16, color: colors.mutedFg, textAlign: "center" }}>{empty}</NxText>
        </View>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {items.map((uri, i) => (
            <ImageCell key={i} uri={uri} />
          ))}
        </View>
      )}
    </Animated.View>
  );
}

function ImageCell({ uri }: { uri: string }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const size = (width - spacing.lg * 2 - 16) / 3;
  const [err, setErr] = useState(false);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radii.md,
        backgroundColor: colors.surfaceHigh,
        overflow: "hidden",
      }}
    >
      {err ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Feather name="image" size={18} color={colors.mutedFg} />
        </View>
      ) : (
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          resizeMode="cover"
          onError={() => setErr(true)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 16,
  },
  orbitWrap: {
    alignItems: "center",
    paddingTop: 28,
    paddingHorizontal: spacing.lg,
    paddingBottom: 8,
  },
  orbitHalo: {
    width: 168,
    height: 168,
    borderRadius: 84,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  orbitHaloInner: {
    width: 138,
    height: 138,
    borderRadius: 69,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  orbitNameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    gap: 8,
    maxWidth: "90%",
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 7,
  },
  sectionLabel: {
    paddingHorizontal: spacing.xl,
    paddingTop: 8,
    paddingBottom: 8,
  },
  card: {
    marginHorizontal: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#2A2A35",
    justifyContent: "space-between",
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  wallSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  pinCard: {
    width: "100%",
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  bottomGlow: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
  },
  reportCatWrap: {
    flexDirection: "column",
    gap: 8,
  },
  reportCat: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  reportInput: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 90,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    textAlignVertical: "top",
  },
  reportPrimaryBtn: {
    marginTop: 24,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
});

const REPORT_CATEGORIES = [
  { key: "spam", label: "Spam or scam", icon: "alert-circle" },
  { key: "harassment", label: "Harassment or bullying", icon: "user-x" },
  { key: "hate", label: "Hate speech", icon: "alert-octagon" },
  { key: "nudity", label: "Nudity or sexual content", icon: "eye-off" },
  { key: "violence", label: "Violence or threats", icon: "shield-off" },
  { key: "impersonation", label: "Impersonation / fake account", icon: "copy" },
  { key: "dangerous", label: "Dangerous or illegal activity", icon: "alert-triangle" },
  { key: "other", label: "Something else", icon: "more-horizontal" },
] as const;

function ReportForm({
  other,
  conversationId,
  onClose,
  onBack,
}: {
  other?: any;
  conversationId: string;
  onClose: () => void;
  onBack: () => void;
}) {
  const { colors } = useTheme();
  const { token, user } = useAuth();
  const [category, setCategory] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!category || !user?.user_id) return;
    setSending(true);
    setError(null);
    try {
      await api("/reports", {
        method: "POST",
        token,
        body: {
          reported_id: other?.user_id,
          category,
          description: description.trim(),
          conversation_id: conversationId,
        },
      });
      setDone(true);
    } catch (e: any) {
      setError(e?.message || "Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={{ alignItems: "center", paddingTop: 100, paddingHorizontal: spacing.lg }}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.primary + "1F" }]}>
            <Feather name="check" size={30} color={colors.primary} />
          </View>
          <NxText style={{ marginTop: 18, fontSize: 17, fontFamily: fonts.bodySemi, color: colors.foreground }}>
            Report submitted
          </NxText>
          <NxText style={{ marginTop: 8, textAlign: "center", color: colors.mutedFg, lineHeight: 20 }}>
            Thanks for keeping XYTEEE safe. Our team will review this report.
          </NxText>
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.8}
            style={[styles.reportPrimaryBtn, { backgroundColor: colors.primary }]}
          >
            <NxText style={{ color: "#fff", fontFamily: fonts.bodySemi, fontSize: 15 }}>Done</NxText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 60, paddingHorizontal: spacing.lg, paddingTop: 16 }}
    >
      <NxText style={{ color: colors.mutedFg, lineHeight: 20, marginBottom: 18 }}>
        Report {other?.display_name || "this user"} for violating the community rules. Pick the reason that fits best.
      </NxText>

      <View style={styles.reportCatWrap}>
        {REPORT_CATEGORIES.map((c) => {
          const active = category === c.key;
          return (
            <TouchableOpacity
              key={c.key}
              testID={`report-cat-${c.key}`}
              activeOpacity={0.8}
              onPress={() => setCategory(c.key)}
              style={[
                styles.reportCat,
                {
                  backgroundColor: active ? colors.primary + "1F" : colors.surface,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
            >
              <Feather name={c.icon as any} size={15} color={active ? colors.primary : colors.mutedFg} />
              <NxText
                style={{
                  flex: 1,
                  marginLeft: 10,
                  fontSize: 13.5,
                  color: active ? colors.foreground : colors.mutedFg,
                  fontFamily: active ? fonts.bodyMedium : fonts.body,
                }}
              >
                {c.label}
              </NxText>
              {active ? <Feather name="check-circle" size={16} color={colors.primary} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>

      <NxText variant="label" style={[styles.sectionLabel, { color: colors.mutedFg, marginTop: 20 }]}>
        Add details (optional)
      </NxText>
      <TextInput
        testID="report-description"
        value={description}
        onChangeText={setDescription}
        placeholder="Tell us more about what happened…"
        placeholderTextColor={colors.mutedFg}
        multiline
        style={[
          styles.reportInput,
          { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground },
        ]}
      />

      {error ? <NxText style={{ marginTop: 12, color: colors.danger, fontSize: 13 }}>{error}</NxText> : null}

      <TouchableOpacity
        testID="report-submit"
        activeOpacity={0.8}
        disabled={!category || sending}
        onPress={submit}
        style={[
          styles.reportPrimaryBtn,
          { backgroundColor: !category || sending ? colors.mutedFg + "66" : colors.danger },
        ]}
      >
        {sending ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <NxText style={{ color: "#fff", fontFamily: fonts.bodySemi, fontSize: 15 }}>Submit Report</NxText>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}
