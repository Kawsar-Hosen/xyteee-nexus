/**
 * Admin – User Detail page.
 * Shows user info and lets the admin assign / remove verification badges.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Modal,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ProfileFrame } from "@/src/components/ProfileFrame";
import { AchievementBadge } from "@/src/components/AchievementBadge";

import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { NxText } from "@/src/components/NxText";
import { Avatar } from "@/src/components/Avatar";
import { VerifiedBadge } from "@/src/components/VerifiedBadge";
import {
  BADGE_COLORS,
  BADGE_ICONS,
  BADGE_ICON_LABELS,
  FRAME_IDS,
  FRAME_STYLES,
  FRAME_THEMES,
  ACHIEVEMENT_IDS,
  ACHIEVEMENTS,
  PROFILE_ANIMATIONS,
  PROFILE_ANIMATION_IDS,
  ANIMATION_GROUPS,
  ANIMATION_SPEEDS,
  ANIMATION_SPEED_IDS,
  ANIMATION_INTENSITIES,
  ANIMATION_INTENSITY_IDS,
} from "@/src/components/premium";
import { fonts, radii, spacing } from "@/src/theme";

const MODERATION_REASONS = [
  { code: "spam_abuse", label: "Spam or abusive activity" },
  { code: "harassment", label: "Harassment or harmful behavior" },
  { code: "community_violation", label: "Violation of Nexus community rules" },
] as const;

type ModerationAction = "suspend" | "ban";

export default function AdminUserDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { token } = useAuth();
  const router = useRouter();

  const [u, setU] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [moderationAction, setModerationAction] = useState<ModerationAction | null>(null);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [moderationBusy, setModerationBusy] = useState(false);
  const [appeals, setAppeals] = useState<any[]>([]);
  const [appealBusy, setAppealBusy] = useState(false);

  const [premium, setPremium] = useState<any>(null);
  const [premiumBusy, setPremiumBusy] = useState(false);
  const [premiumErr, setPremiumErr] = useState<string | null>(null);
  const [pBadge, setPBadge] = useState<string | null>(null);
  const [pIcon, setPIcon] = useState<string>("check-decagram");
  const [pTemp, setPTemp] = useState(false);
  const [pDuration, setPDuration] = useState<number>(7);
  const [pFrame, setPFrame] = useState<string | null>(null);
  const [pAch, setPAch] = useState<string | null>(null);
  const [pAnim, setPAnim] = useState<string>("glow");
  const [pSpeed, setPSpeed] = useState<"slow" | "normal" | "fast">("normal");
  const [pIntensity, setPIntensity] = useState<"low" | "medium" | "high">("medium");
  const [pAnimTemp, setPAnimTemp] = useState(false);
  const [pAnimDuration, setPAnimDuration] = useState<number>(7);

  const load = useCallback(async () => {
    if (!token || !id) return;
    try {
      const [userResult, appealResult] = await Promise.all([
        api<{ user: any }>(`/admin/users/${id}`, { token }),
        api<{ appeals: any[] }>(`/admin/users/${id}/appeals`, { token }),
      ]);
      setU(userResult.user);
      setAppeals(appealResult.appeals || []);
    } catch {
      Alert.alert("Error", "Could not load user.");
      router.back();
    }
  }, [token, id]);

  const loadPremium = useCallback(async () => {
    if (!token || !id) return;
    try {
      const r = await api<{ premium: any }>(`/admin/users/${id}/premium`, { token });
      setPremium(r.premium);
      setPBadge(r.premium.badge_type || null);
      setPIcon(r.premium.badge_icon || "check-decagram");
      setPTemp(!!r.premium.badge_expires_at);
      setPFrame(r.premium.profile_frame || null);
      setPAch(r.premium.achievement_level || null);
      setPAnim(r.premium.profile_animation || "glow");
      setPSpeed(r.premium.profile_animation_speed || "normal");
      setPIntensity(r.premium.profile_animation_intensity || "medium");
      const animExp = r.premium.profile_animation_expires_at;
      setPAnimTemp(!!animExp);
      if (animExp) {
        const days = Math.ceil((new Date(animExp).getTime() - Date.now()) / 86400000);
        setPAnimDuration(Math.max(1, Math.min(365, Number.isFinite(days) ? days : 7)));
      }
      setPremiumErr(null);
    } catch (e: any) {
      setPremiumErr(e?.message || "Could not load premium settings.");
    }
  }, [token, id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadPremium(); }, [loadPremium]);

  const savePremium = async () => {
    if (!token || !id) return;
    setPremiumBusy(true);
    try {
      let expiresAt: string | null = null;
      if (pBadge && pTemp) {
        const exp = new Date();
        exp.setDate(exp.getDate() + pDuration);
        expiresAt = exp.toISOString();
      }
      let animExpiresAt: string | null = null;
      if (pAnim && pAnim !== "off" && pAnimTemp) {
        const exp = new Date();
        exp.setDate(exp.getDate() + pAnimDuration);
        animExpiresAt = exp.toISOString();
      }
      await api(`/admin/users/${id}/premium`, {
        method: "PUT",
        body: {
          badge_type: pBadge,
          badge_icon: pBadge ? pIcon : null,
          badge_expires_at: expiresAt,
          profile_frame: pFrame,
          achievement_level: pAch,
          profile_animation: pAnim,
          profile_animation_speed: pAnim === "off" ? null : pSpeed,
          profile_animation_intensity: pAnim === "off" ? null : pIntensity,
          profile_animation_expires_at: animExpiresAt,
        },
        token,
      });
      setPremiumErr(null);
      await loadPremium();
      await load();
      Alert.alert("Success", "Premium settings updated.");
    } catch (e: any) {
      setPremiumErr(e?.message || "Failed to save premium settings.");
      Alert.alert("Error", e?.message || "Failed to save premium settings.");
    } finally {
      setPremiumBusy(false);
    }
  };

  const removePremium = async () => {
    if (!token || !id) return;
    setPremiumBusy(true);
    try {
      await api(`/admin/users/${id}/premium`, {
        method: "PUT",
        body: {
          badge_type: null,
          badge_icon: null,
          badge_expires_at: null,
          profile_frame: null,
          achievement_level: null,
          profile_animation: null,
          profile_animation_speed: null,
          profile_animation_intensity: null,
          profile_animation_expires_at: null,
        },
        token,
      });
      await loadPremium();
      await load();
      Alert.alert("Success", "All premium settings removed.");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to remove premium settings.");
    } finally {
      setPremiumBusy(false);
    }
  };

  const applyModeration = async () => {
    if (!token || !id || !moderationAction || !selectedReason) return;

    setModerationBusy(true);
    try {
      await api(`/admin/users/${id}/${moderationAction}`, {
        method: "PUT",
        body: { reason_code: selectedReason },
        token,
      });
      setModerationAction(null);
      setSelectedReason(null);
      await load();
      Alert.alert(
        "Success",
        moderationAction === "ban"
          ? "User has been banned."
          : "User has been suspended."
      );
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Moderation action failed.");
    } finally {
      setModerationBusy(false);
    }
  };

  const rejectAppeal = async (appealId: string) => {
    if (!token || !appealId || appealBusy) return;

    setAppealBusy(true);
    try {
      await api(`/admin/appeals/${appealId}/reject`, {
        method: "PUT",
        token,
      });
      await load();
      Alert.alert(
        "Appeal Rejected",
        "The appeal has been rejected. The user may submit another appeal if they still have an appeal remaining."
      );
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not reject appeal.");
    } finally {
      setAppealBusy(false);
    }
  };

  const restoreUser = async () => {
    if (!token || !id) return;

    setModerationBusy(true);
    try {
      await api(`/admin/users/${id}/restore`, {
        method: "PUT",
        token,
      });
      await load();
      Alert.alert("Success", "User account has been restored.");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not restore account.");
    } finally {
      setModerationBusy(false);
    }
  };

  if (!u) {
    return (
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Back */}
        <View style={{ flexDirection: "row", alignItems: "center", padding: spacing.lg }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: spacing.md }}>
            <Feather name="chevron-left" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <NxText variant="title">User Detail</NxText>
        </View>

        {/* Profile card */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Avatar
            uri={u.profile_picture}
            name={u.display_name}
            size={64}
            online={u.online}
            onlineStatus={u.online_status || "online"}
          />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <NxText variant="title" style={{ flexShrink: 1 }}>{u.display_name}</NxText>
              <VerifiedBadge badgeType={u.badge_type} size={16} />
            </View>
            <NxText variant="bodySm" style={{ color: colors.mutedFg }}>@{u.username}</NxText>
            <NxText variant="caption" style={{ color: colors.mutedFg, marginTop: 2 }}>{u.email}</NxText>
          </View>
        </View>

        {/* User stats */}
        <View style={[styles.infoRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <InfoCell label="User ID" value={u.user_id} />
          <InfoCell label="Joined" value={u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"} />
          <InfoCell label="Status" value={u.online ? "Online" : "Offline"} />
        </View>

        {/* Premium & Profile Frame Management */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <View style={styles.premiumHeading}>
            <View style={[styles.premiumHeadingIcon, { backgroundColor: colors.primary + "1e" }]}>
              <Feather name="award" size={17} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <NxText variant="titleSm">Premium & Profile Frame</NxText>
              <NxText variant="caption" style={{ color: colors.mutedFg, marginTop: 2 }}>
                Badges, custom icons, animated frames & achievement levels.
              </NxText>
            </View>
          </View>

          {premiumErr ? (
            <View style={[styles.premiumNotice, { backgroundColor: colors.danger + "12", borderColor: colors.danger }]}>
              <Feather name="alert-triangle" size={15} color={colors.danger} />
              <NxText style={[styles.premiumNoticeText, { color: colors.danger }]} numberOfLines={4}>
                {premiumErr}
              </NxText>
            </View>
          ) : null}

          {/* Live preview */}
          <View
            style={[
              styles.previewCard,
              {
                position: "sticky",
                top: spacing.sm,
                zIndex: 50,
                backgroundColor: colors.surface,
                borderColor: colors.border,
                shadowColor: "#000",
                shadowOpacity: 0.15,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
                elevation: 4,
              },
            ]}
          >
            <View style={styles.previewLeft}>
              <Avatar
                uri={u.profile_picture}
                name={u.display_name}
                size={44}
                frame={pFrame}
                achievement={pAch}
                animation={pAnim}
                animationSpeed={pSpeed}
                animationIntensity={pIntensity}
              />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <NxText variant="titleSm" style={{ flexShrink: 1 }}>{u.display_name}</NxText>
                {pBadge ? (
                  <VerifiedBadge
                    badgeType={pBadge}
                    badgeIcon={pIcon}
                    badgeExpiresAt={pTemp ? new Date(Date.now() + pDuration * 86400000).toISOString() : undefined}
                    size={16}
                  />
                ) : null}
              </View>
              <NxText variant="bodySm" style={{ color: colors.mutedFg }}>@{u.username}</NxText>
              <NxText variant="caption" style={{ color: colors.mutedFg, marginTop: 2 }}>
                Live preview
              </NxText>
            </View>
          </View>

          {/* Badge type */}
          <NxText style={[styles.premiumLabel, { color: colors.foreground }]}>Badge / Verification</NxText>
          <View style={styles.optionRow}>
            {[
              { value: null, label: "None", color: colors.mutedFg },
              { value: "blue", label: "Blue", color: BADGE_COLORS.blue },
              { value: "gold", label: "Gold", color: BADGE_COLORS.gold },
              { value: "gray", label: "Gray", color: BADGE_COLORS.gray },
            ].map((opt) => {
              const active = pBadge === opt.value;
              return (
                <TouchableOpacity
                  key={opt.label}
                  activeOpacity={0.75}
                  onPress={() => setPBadge(opt.value)}
                  style={[
                    styles.optionPill,
                    {
                      backgroundColor: active ? opt.color + "26" : colors.surface,
                      borderColor: active ? opt.color : colors.border,
                    },
                  ]}
                >
                  {opt.value ? <VerifiedBadge badgeType={opt.value} size={16} /> : null}
                  <NxText
                    style={{
                      marginLeft: opt.value ? 6 : 0,
                      fontSize: 12,
                      fontFamily: fonts.bodySemi,
                      color: active ? opt.color : colors.foreground,
                    }}
                  >
                    {opt.label}
                  </NxText>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Custom badge icon */}
          {pBadge ? (
            <>
              <NxText style={[styles.premiumLabel, { color: colors.foreground }]}>Badge Icon</NxText>
              <View style={styles.iconGrid}>
                {Object.entries(BADGE_ICONS).map(([name]) => {
                  const active = pIcon === name;
                  const color = BADGE_COLORS[pBadge] || colors.primary;
                  return (
                    <TouchableOpacity
                      key={name}
                      activeOpacity={0.75}
                      onPress={() => setPIcon(name)}
                      style={[
                        styles.iconCell,
                        {
                          backgroundColor: active ? color + "22" : colors.surface,
                          borderColor: active ? color : colors.border,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons name={name as any} size={20} color={active ? color : colors.mutedFg} />
                      <NxText
                        numberOfLines={1}
                        style={{
                          marginTop: 4,
                          fontSize: 9,
                          fontFamily: fonts.bodyMedium,
                          color: active ? color : colors.mutedFg,
                          textAlign: "center",
                        }}
                      >
                        {BADGE_ICON_LABELS[name] || name}
                      </NxText>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Permanent / temporary */}
              <View style={styles.durationRow}>
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => setPTemp(false)}
                  style={[
                    styles.durationPill,
                    {
                      backgroundColor: !pTemp ? colors.primary + "22" : colors.surface,
                      borderColor: !pTemp ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Feather name="lock" size={13} color={!pTemp ? colors.primary : colors.mutedFg} />
                  <NxText style={{ fontSize: 12, fontFamily: fonts.bodySemi, color: !pTemp ? colors.primary : colors.foreground, marginLeft: 5 }}>
                    Permanent
                  </NxText>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => setPTemp(true)}
                  style={[
                    styles.durationPill,
                    {
                      backgroundColor: pTemp ? colors.primary + "22" : colors.surface,
                      borderColor: pTemp ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Feather name="clock" size={13} color={pTemp ? colors.primary : colors.mutedFg} />
                  <NxText style={{ fontSize: 12, fontFamily: fonts.bodySemi, color: pTemp ? colors.primary : colors.foreground, marginLeft: 5 }}>
                    Temporary
                  </NxText>
                </TouchableOpacity>
              </View>

              {pTemp ? (
                <View style={styles.optionRow}>
                  {[1, 7, 30, 90, 365].map((days) => {
                    const active = pDuration === days;
                    return (
                      <TouchableOpacity
                        key={days}
                        activeOpacity={0.75}
                        onPress={() => setPDuration(days)}
                        style={[
                          styles.optionPill,
                          {
                            backgroundColor: active ? colors.primary + "22" : colors.surface,
                            borderColor: active ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <NxText
                          style={{
                            fontSize: 12,
                            fontFamily: fonts.bodySemi,
                            color: active ? colors.primary : colors.foreground,
                          }}
                        >
                          {days === 365 ? "1y" : `${days}d`}
                        </NxText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}
            </>
          ) : null}

          {/* Profile frame */}
          <NxText style={[styles.premiumLabel, { color: colors.foreground }]}>Profile Frame</NxText>
          <NxText variant="caption" style={{ color: colors.mutedFg, marginBottom: 8 }}>
            {FRAME_IDS.length} premium frames across {FRAME_THEMES.length} themes
          </NxText>
          <View style={styles.frameRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setPFrame(null)}
              style={[
                styles.frameOption,
                {
                  backgroundColor: colors.surface,
                  borderColor: pFrame === null ? colors.primary : colors.border,
                },
              ]}
            >
              <View style={[styles.frameNoneCircle, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Feather name="x" size={16} color={colors.mutedFg} />
              </View>
              <NxText style={{ fontSize: 10, color: pFrame === null ? colors.primary : colors.mutedFg, marginTop: 6, fontFamily: fonts.bodySemi }}>
                None
              </NxText>
            </TouchableOpacity>
            {FRAME_THEMES.map((theme) => (
              <React.Fragment key={theme}>
                <View style={styles.frameGroupLabelRow}>
                  <NxText style={[styles.frameGroupLabel, { color: colors.mutedFg }]}>{theme}</NxText>
                </View>
                {FRAME_IDS.filter((fid) => FRAME_STYLES[fid].theme === theme).map((fid) => {
                  const active = pFrame === fid;
                  const cfg = FRAME_STYLES[fid];
                  return (
                    <TouchableOpacity
                      key={fid}
                      activeOpacity={0.8}
                      onPress={() => setPFrame(fid)}
                      style={[
                        styles.frameOption,
                    {
                      backgroundColor: colors.surface,
                      borderColor: active ? cfg.colors[1] : colors.border,
                    },
                  ]}
                >
                  <View style={styles.frameCircle}>
                    <ProfileFrame size={40} hole={29} frame={fid} animation="off" />
                  </View>
                  <NxText
                    style={{
                      fontSize: 10,
                      color: active ? cfg.colors[1] : colors.mutedFg,
                      marginTop: 6,
                      fontFamily: fonts.bodySemi,
                    }}
                  >
                    {cfg.label}
                  </NxText>
                </TouchableOpacity>
              );
            })}
              </React.Fragment>
            ))}
          </View>

          {/* Frame animation */}
          <NxText style={[styles.premiumLabel, { color: colors.foreground }]}>Frame Animation</NxText>
          <View style={styles.animGrid}>
            {(() => {
              const offActive = pAnim === "off";
              const offA = PROFILE_ANIMATIONS.off;
              return (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setPAnim("off")}
                  style={[
                    styles.animCard,
                    {
                      backgroundColor: offActive ? colors.primary + "18" : colors.surface,
                      borderColor: offActive ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <MaterialCommunityIcons name={offA.icon as any} size={18} color={offActive ? colors.primary : colors.mutedFg} />
                  <NxText style={{ marginTop: 6, fontSize: 11, fontFamily: fonts.bodySemi, color: offActive ? colors.primary : colors.foreground }}>
                    {offA.label}
                  </NxText>
                  <NxText numberOfLines={2} style={{ marginTop: 2, fontSize: 9, lineHeight: 12, color: colors.mutedFg, textAlign: "center" }}>
                    {offA.description}
                  </NxText>
                </TouchableOpacity>
              );
            })()}
            {ANIMATION_GROUPS.map((group) => (
              <React.Fragment key={group}>
                <View style={styles.animGroupLabelRow}>
                  <NxText style={[styles.animGroupLabel, { color: colors.mutedFg }]}>{group}</NxText>
                </View>
                {PROFILE_ANIMATION_IDS.filter((aid) => PROFILE_ANIMATIONS[aid].group === group).map((aid) => {
                  const active = pAnim === aid;
                  const a = PROFILE_ANIMATIONS[aid];
                  return (
                    <TouchableOpacity
                      key={aid}
                      activeOpacity={0.8}
                      onPress={() => setPAnim(aid)}
                      style={[
                        styles.animCard,
                        {
                          backgroundColor: active ? colors.primary + "18" : colors.surface,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={a.icon as any}
                        size={18}
                        color={active ? colors.primary : colors.mutedFg}
                      />
                      <NxText
                        style={{
                          marginTop: 6,
                          fontSize: 11,
                          fontFamily: fonts.bodySemi,
                          color: active ? colors.primary : colors.foreground,
                        }}
                      >
                        {a.label}
                      </NxText>
                      <NxText
                        numberOfLines={2}
                        style={{
                          marginTop: 2,
                          fontSize: 9,
                          lineHeight: 12,
                          color: colors.mutedFg,
                          textAlign: "center",
                        }}
                      >
                        {a.description}
                      </NxText>
                    </TouchableOpacity>
                  );
                })}
              </React.Fragment>
            ))}
          </View>

          {/* Speed + intensity + duration */}
          <NxText style={[styles.premiumLabel, { color: colors.foreground }]}>Animation Speed</NxText>
          <View style={styles.optionRow}>
            {ANIMATION_SPEED_IDS.map((spd) => {
              const active = pSpeed === spd;
              return (
                <TouchableOpacity
                  key={spd}
                  activeOpacity={0.75}
                  onPress={() => setPSpeed(spd)}
                  style={[
                    styles.optionPill,
                    { backgroundColor: colors.surface, borderColor: active ? colors.primary : colors.border },
                  ]}
                >
                  <NxText style={{ fontSize: 12, fontFamily: fonts.bodySemi, color: active ? colors.primary : colors.foreground }}>
                    {ANIMATION_SPEEDS[spd].label}
                  </NxText>
                </TouchableOpacity>
              );
            })}
          </View>

          <NxText style={[styles.premiumLabel, { color: colors.foreground }]}>Animation Intensity</NxText>
          <View style={styles.optionRow}>
            {ANIMATION_INTENSITY_IDS.map((itn) => {
              const active = pIntensity === itn;
              return (
                <TouchableOpacity
                  key={itn}
                  activeOpacity={0.75}
                  onPress={() => setPIntensity(itn)}
                  style={[
                    styles.optionPill,
                    { backgroundColor: colors.surface, borderColor: active ? colors.primary : colors.border },
                  ]}
                >
                  <NxText style={{ fontSize: 12, fontFamily: fonts.bodySemi, color: active ? colors.primary : colors.foreground }}>
                    {ANIMATION_INTENSITIES[itn].label}
                  </NxText>
                </TouchableOpacity>
              );
            })}
          </View>

          <NxText style={[styles.premiumLabel, { color: colors.foreground }]}>Animation Duration</NxText>
          <View style={styles.optionRow}>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => setPAnimTemp(false)}
              style={[styles.optionPill, { backgroundColor: colors.surface, borderColor: !pAnimTemp ? colors.primary : colors.border }]}
            >
              <NxText style={{ fontSize: 12, fontFamily: fonts.bodySemi, color: !pAnimTemp ? colors.primary : colors.foreground }}>
                Permanent
              </NxText>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => setPAnimTemp(true)}
              style={[styles.optionPill, { backgroundColor: colors.surface, borderColor: pAnimTemp ? colors.primary : colors.border }]}
            >
              <NxText style={{ fontSize: 12, fontFamily: fonts.bodySemi, color: pAnimTemp ? colors.primary : colors.foreground }}>
                Temporary
              </NxText>
            </TouchableOpacity>
          </View>
          {pAnimTemp ? (
            <View style={[styles.animDurationRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TouchableOpacity activeOpacity={0.7} onPress={() => setPAnimDuration(Math.max(1, pAnimDuration - 1))} style={[styles.durationBtn, { backgroundColor: colors.background }]}>
                <Feather name="minus" size={16} color={colors.foreground} />
              </TouchableOpacity>
              <NxText style={{ fontSize: 14, fontFamily: fonts.bodySemi, color: colors.foreground }}>
                {pAnimDuration} {pAnimDuration === 1 ? "day" : "days"}
              </NxText>
              <TouchableOpacity activeOpacity={0.7} onPress={() => setPAnimDuration(Math.min(365, pAnimDuration + 1))} style={[styles.durationBtn, { backgroundColor: colors.background }]}>
                <Feather name="plus" size={16} color={colors.foreground} />
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Achievement level */}
          <NxText style={[styles.premiumLabel, { color: colors.foreground }]}>Achievement Level</NxText>
          <View style={styles.optionRow}>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => setPAch(null)}
              style={[
                styles.optionPill,
                {
                  backgroundColor: colors.surface,
                  borderColor: pAch === null ? colors.primary : colors.border,
                },
              ]}
            >
              <NxText style={{ fontSize: 12, fontFamily: fonts.bodySemi, color: pAch === null ? colors.primary : colors.foreground }}>
                None
              </NxText>
            </TouchableOpacity>
            {ACHIEVEMENT_IDS.map((aid) => {
              const active = pAch === aid;
              const cfg = ACHIEVEMENTS[aid];
              return (
                <TouchableOpacity
                  key={aid}
                  activeOpacity={0.75}
                  onPress={() => setPAch(aid)}
                  style={[
                    styles.optionPill,
                    {
                      backgroundColor: active ? cfg.color + "26" : colors.surface,
                      borderColor: active ? cfg.color : colors.border,
                    },
                  ]}
                >
                  <AchievementBadge level={aid} size={22} glow={false} />
                  <NxText
                    style={{
                      marginLeft: 5,
                      fontSize: 12,
                      fontFamily: fonts.bodySemi,
                      color: active ? cfg.color : colors.foreground,
                    }}
                  >
                    {cfg.label}
                  </NxText>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Actions */}
          <View style={styles.premiumActions}>
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={premiumBusy}
              onPress={savePremium}
              style={[styles.premiumSave, { backgroundColor: colors.primary }]}
            >
              {premiumBusy ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <>
                  <Feather name="save" size={15} color={colors.onPrimary} />
                  <NxText style={[styles.premiumSaveText, { color: colors.onPrimary }]}>Save Premium</NxText>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={premiumBusy}
              onPress={removePremium}
              style={[styles.premiumRemove, { backgroundColor: colors.danger + "18", borderColor: colors.danger }]}
            >
              <Feather name="trash-2" size={15} color={colors.danger} />
              <NxText style={[styles.premiumRemoveText, { color: colors.danger }]}>Remove All</NxText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Account moderation */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <NxText variant="titleSm" style={{ marginBottom: spacing.sm }}>
            Account Moderation
          </NxText>

          <View style={[styles.moderationCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.moderationStatusRow}>
              <View style={{ flex: 1 }}>
                <NxText variant="caption" style={{ color: colors.mutedFg }}>
                  Current Status
                </NxText>
                <NxText
                  variant="titleSm"
                  style={{
                    marginTop: 3,
                    textTransform: "capitalize",
                    color:
                      u.moderation_status === "banned" || u.moderation_status === "suspended"
                        ? colors.danger
                        : colors.foreground,
                  }}
                >
                  {u.moderation_status || "active"}
                </NxText>
              </View>

              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor:
                      u.moderation_status === "banned" || u.moderation_status === "suspended"
                        ? colors.danger
                        : colors.primary,
                  },
                ]}
              />
            </View>

            {u.moderation_reason ? (
              <View style={[styles.reasonBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <NxText variant="caption" style={{ color: colors.mutedFg }}>
                  Reason
                </NxText>
                <NxText variant="bodySm" style={{ marginTop: 4, color: colors.foreground }}>
                  {u.moderation_reason}
                </NxText>
              </View>
            ) : null}

            {u.moderation_status === "banned" || u.moderation_status === "suspended" ? (
              <TouchableOpacity
                disabled={moderationBusy}
                onPress={restoreUser}
                style={[styles.moderationButton, { backgroundColor: colors.primary }]}
              >
                {moderationBusy ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="rotate-ccw" size={16} color="#FFFFFF" />
                    <NxText style={styles.moderationButtonText}>Restore Account</NxText>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.moderationActions}>
                <TouchableOpacity
                  disabled={moderationBusy}
                  onPress={() => {
                    setSelectedReason(null);
                    setModerationAction("suspend");
                  }}
                  style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <Feather name="pause-circle" size={17} color={colors.foreground} />
                  <NxText style={{ marginLeft: 7, fontFamily: fonts.bodySemi }}>
                    Suspend
                  </NxText>
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={moderationBusy}
                  onPress={() => {
                    setSelectedReason(null);
                    setModerationAction("ban");
                  }}
                  style={[styles.actionButton, { backgroundColor: colors.danger + "18", borderColor: colors.danger }]}
                >
                  <Feather name="slash" size={17} color={colors.danger} />
                  <NxText style={{ marginLeft: 7, fontFamily: fonts.bodySemi, color: colors.danger }}>
                    Ban
                  </NxText>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* User appeals */}
        {appeals.length > 0 ? (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
            <NxText variant="titleSm" style={{ marginBottom: spacing.sm }}>
              Account Appeals
            </NxText>

            {appeals.map((appeal, index) => (
              <View
                key={appeal.appeal_id}
                style={{
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: radii.lg,
                  padding: spacing.lg,
                  marginBottom: spacing.md,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <NxText variant="titleSm">
                      Appeal #{appeals.length - index}
                    </NxText>
                    <NxText
                      variant="caption"
                      style={{ color: colors.mutedFg, marginTop: 3 }}
                    >
                      {appeal.created_at
                        ? new Date(appeal.created_at).toLocaleString()
                        : "—"}
                    </NxText>
                  </View>

                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: radii.pill,
                      backgroundColor:
                        appeal.status === "pending"
                          ? colors.primary + "18"
                          : appeal.status === "approved"
                          ? colors.primary + "18"
                          : colors.danger + "18",
                    }}
                  >
                    <NxText
                      style={{
                        fontSize: 11,
                        fontFamily: fonts.bodySemi,
                        textTransform: "capitalize",
                        color:
                          appeal.status === "rejected"
                            ? colors.danger
                            : colors.primary,
                      }}
                    >
                      {appeal.status}
                    </NxText>
                  </View>
                </View>

                <View
                  style={{
                    height: StyleSheet.hairlineWidth,
                    backgroundColor: colors.border,
                    marginVertical: spacing.md,
                  }}
                />

                <NxText variant="caption" style={{ color: colors.mutedFg }}>
                  User Message
                </NxText>
                <NxText
                  variant="body"
                  style={{ marginTop: 6, lineHeight: 22 }}
                >
                  {appeal.message || "No message provided."}
                </NxText>

                {appeal.status === "pending" ? (
                  <TouchableOpacity
                    disabled={appealBusy}
                    onPress={() =>
                      Alert.alert(
                        "Reject Appeal?",
                        "The user will be allowed to submit another appeal only if they have an appeal remaining.",
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Reject Appeal",
                            style: "destructive",
                            onPress: () => rejectAppeal(appeal.appeal_id),
                          },
                        ]
                      )
                    }
                    style={{
                      height: 48,
                      borderRadius: radii.pill,
                      alignItems: "center",
                      justifyContent: "center",
                      marginTop: spacing.lg,
                      backgroundColor: colors.danger + "18",
                      borderColor: colors.danger,
                      borderWidth: 1,
                    }}
                  >
                    {appealBusy ? (
                      <ActivityIndicator size="small" color={colors.danger} />
                    ) : (
                      <NxText
                        style={{
                          color: colors.danger,
                          fontFamily: fonts.bodySemi,
                        }}
                      >
                        Reject Appeal
                      </NxText>
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        <Modal
          visible={moderationAction !== null}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!moderationBusy) {
              setModerationAction(null);
              setSelectedReason(null);
            }
          }}
        >
          <View style={styles.modalOverlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => {
                if (!moderationBusy) {
                  setModerationAction(null);
                  setSelectedReason(null);
                }
              }}
            />

            <View style={[styles.reasonModal, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <NxText variant="title">
                    {moderationAction === "ban" ? "Ban User" : "Suspend User"}
                  </NxText>
                  <NxText variant="bodySm" style={{ color: colors.mutedFg, marginTop: 4 }}>
                    Choose one reason for this action.
                  </NxText>
                </View>

                <TouchableOpacity
                  disabled={moderationBusy}
                  onPress={() => {
                    setModerationAction(null);
                    setSelectedReason(null);
                  }}
                >
                  <Feather name="x" size={22} color={colors.mutedFg} />
                </TouchableOpacity>
              </View>

              <View style={{ marginTop: spacing.md }}>
                {MODERATION_REASONS.map((reason) => {
                  const selected = selectedReason === reason.code;

                  return (
                    <TouchableOpacity
                      key={reason.code}
                      disabled={moderationBusy}
                      onPress={() => setSelectedReason(reason.code)}
                      style={[
                        styles.reasonOption,
                        {
                          backgroundColor: selected ? colors.primary + "18" : colors.background,
                          borderColor: selected ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.radioOuter,
                          { borderColor: selected ? colors.primary : colors.mutedFg },
                        ]}
                      >
                        {selected ? (
                          <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />
                        ) : null}
                      </View>

                      <NxText
                        variant="bodySm"
                        style={{
                          flex: 1,
                          marginLeft: 12,
                          color: selected ? colors.primary : colors.foreground,
                        }}
                      >
                        {reason.label}
                      </NxText>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                disabled={!selectedReason || moderationBusy}
                onPress={applyModeration}
                style={[
                  styles.confirmModerationButton,
                  {
                    backgroundColor:
                      !selectedReason || moderationBusy
                        ? colors.border
                        : moderationAction === "ban"
                          ? colors.danger
                          : colors.primary,
                  },
                ]}
              >
                {moderationBusy ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <NxText style={styles.moderationButtonText}>
                    Confirm {moderationAction === "ban" ? "Ban" : "Suspension"}
                  </NxText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <NxText variant="titleSm" style={{ fontSize: 12 }}>{value}</NxText>
      <NxText variant="caption" style={{ color: colors.mutedFg, marginTop: 2 }}>{label}</NxText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  infoRow: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  premiumHeading: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  premiumHeadingIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  premiumNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  premiumNoticeText: {
    flex: 1,
    fontSize: 12,
    fontFamily: fonts.body,
    lineHeight: 17,
  },
  previewCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  previewLeft: {
    marginRight: spacing.md,
  },
  premiumLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionPill: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  iconGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  iconCell: {
    width: 54,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  durationRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: spacing.md,
  },
  durationPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  frameRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  frameOption: {
    width: "23%",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  frameNoneCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  frameGroupLabelRow: {
    width: "100%",
    marginTop: 10,
    marginBottom: 2,
  },
  frameGroupLabel: {
    fontSize: 11,
    letterSpacing: 0.5,
    fontFamily: fonts.bodySemi,
    textTransform: "uppercase",
  },
  frameCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  animGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  animCard: {
    width: "31%",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  animGroupLabelRow: {
    width: "100%",
    marginTop: 10,
    marginBottom: 2,
  },
  animGroupLabel: {
    fontSize: 11,
    letterSpacing: 0.5,
    fontFamily: fonts.bodySemi,
    textTransform: "uppercase",
  },
  animDurationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
  },
  durationBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  premiumActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: spacing.xl,
  },
  premiumSave: {
    flex: 1,
    minHeight: 46,
    borderRadius: radii.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  premiumSaveText: {
    marginLeft: 7,
    fontFamily: fonts.bodySemi,
  },
  premiumRemove: {
    flex: 1,
    minHeight: 46,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  premiumRemoveText: {
    marginLeft: 7,
    fontFamily: fonts.bodySemi,
  },
  badgeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  badgeOption: {
    width: "30%",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    minHeight: 80,
  },
  moderationCard: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  moderationStatusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  reasonBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  moderationActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: spacing.lg,
  },
  actionButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  moderationButton: {
    minHeight: 46,
    marginTop: spacing.lg,
    borderRadius: radii.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  moderationButtonText: {
    marginLeft: 7,
    color: "#FFFFFF",
    fontFamily: fonts.bodySemi,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  reasonModal: {
    padding: spacing.lg,
    paddingBottom: 32,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  reasonOption: {
    minHeight: 58,
    marginBottom: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  confirmModerationButton: {
    minHeight: 48,
    marginTop: spacing.sm,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
