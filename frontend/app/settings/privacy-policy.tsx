import React from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/src/context/ThemeContext";
import { NxText } from "@/src/components/NxText";
import { fonts, radii, spacing } from "@/src/theme";

const SECTIONS = [
  {
    icon: "clipboard",
    color: "#5B8CFF",
    title: "Information We Collect",
    text: "When you create an account, we collect your email address, username, and display name. You may also provide a profile picture, cover photo, bio, birthday, website, and status. We automatically collect device information, IP address, and usage data to operate and improve XYTEEE Nexus.",
  },
  {
    icon: "message-square",
    color: "#a78bfa",
    title: "Messages & Conversations",
    text: "Your private chats are protected. Messages and media shared in conversations are accessible only to participants of that conversation. XYTEEE Nexus does not read, sell, or share the content of your private messages with third parties.",
  },
  {
    icon: "camera",
    color: "#f472b6",
    title: "Stories (Reveries)",
    text: "Stories you share are visible to your approved Bonds or the public based on your privacy settings. Stories automatically expire after 24 hours. You can delete any story at any time from your profile.",
  },
  {
    icon: "phone-call",
    color: "#23A55A",
    title: "Voice & Video Calls",
    text: "Voice and video calls are peer-to-peer connections. Call content is transmitted directly between participants and is not stored on our servers. We only store call metadata such as duration and timestamp.",
  },
  {
    icon: "mic",
    color: "#F0B232",
    title: "Voice Messages",
    text: "Voice messages you send are stored securely and shared only within the conversation they were sent in. They are not used for advertising or shared with third parties.",
  },
  {
    icon: "bell",
    color: "#FF6B6B",
    title: "Push Notifications",
    text: "We use push notification tokens to deliver alerts for messages, calls, friend requests, and activity. You can disable notifications at any time from your device settings.",
  },
  {
    icon: "users",
    color: "#5B8CFF",
    title: "Friends (Bonds) & Social",
    text: "Your friend list is visible to you and to users with whom you have mutual connections. You can manage your connections, send or cancel bond requests, and unfriend at any time.",
  },
  {
    icon: "eye",
    color: "#a78bfa",
    title: "Profile & Visibility",
    text: "You control what appears on your profile. When your account is set to private, only approved Bonds can see your stories, profile details, and activity.",
  },
  {
    icon: "shield",
    color: "#23A55A",
    title: "Account Privacy & Security",
    text: "Your password is securely hashed and never stored in plain text. You can enable private account mode to restrict who sees your content.",
  },
  {
    icon: "x-octagon",
    color: "#F23F43",
    title: "Blocking & Reporting",
    text: "Blocked users cannot see your profile, send you messages, or interact with you. If you experience harassment or abuse, use the report feature.",
  },
  {
    icon: "hard-drive",
    color: "#F0B232",
    title: "Data Storage & Retention",
    text: "Your data is stored securely on encrypted servers. Account data is retained as long as your account is active. Upon deletion, data is removed within 30 days.",
  },
  {
    icon: "trash-2",
    color: "#F23F43",
    title: "Account Deletion",
    text: "You can delete your account at any time from Settings. Upon deletion, your profile, messages, stories, and all associated data are permanently removed.",
  },
  {
    icon: "link",
    color: "#5B8CFF",
    title: "Third-Party Services",
    text: "XYTEEE Nexus uses Supabase for data storage and Expo for push notifications. These services are used solely to operate the app. We do not sell your data to advertisers.",
  },
  {
    icon: "refresh-cw",
    color: "#a78bfa",
    title: "Changes to This Policy",
    text: "We may update this Privacy & Policy from time to time. Significant changes will be communicated through in-app notifications.",
  },
];

export default function PrivacyPolicyScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          activeOpacity={0.7}
        >
          <Feather name="chevron-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Feather name="shield" size={16} color={colors.primary} />
          <NxText variant="titleSm">Privacy & Policy</NxText>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Hero Banner */}
        <LinearGradient
          colors={[`${colors.primary}12`, `${colors.primary}04`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { borderColor: colors.border }]}
        >
          <View style={[styles.heroIconWrap, { backgroundColor: `${colors.primary}15` }]}>
            <Feather name="shield" size={32} color={colors.primary} />
          </View>
          <NxText style={[styles.heroTitle, { color: colors.foreground }]}>
            Your privacy matters
          </NxText>
          <NxText style={[styles.heroDesc, { color: colors.mutedFg }]}>
            XYTEEE Nexus is built to give you a safe and private space to connect.
            Learn how your data, conversations, and activity are handled.
          </NxText>
          <View style={[styles.datePill, { backgroundColor: colors.surface }]}>
            <Feather name="clock" size={11} color={colors.mutedFg} />
            <NxText style={[styles.dateText, { color: colors.mutedFg }]}>Effective August 2026</NxText>
          </View>
        </LinearGradient>

        {/* Sections */}
        <View style={styles.sectionLabel}>
          <View style={[styles.sectionDot, { backgroundColor: colors.primary }]} />
          <NxText style={[styles.sectionLabelText, { color: colors.mutedFg }]}>
            {SECTIONS.length} POLICY SECTIONS
          </NxText>
        </View>

        {SECTIONS.map((s, i) => (
          <View key={s.title} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.cardAccent, { backgroundColor: s.color }]} />
            <View style={styles.cardContent}>
              <View style={styles.cardHead}>
                <View style={[styles.cardIcon, { backgroundColor: `${s.color}14` }]}>
                  <Feather name={s.icon as any} size={16} color={s.color} />
                </View>
                <NxText style={[styles.cardTitle, { color: colors.foreground }]}>{s.title}</NxText>
              </View>
              <NxText style={[styles.cardBody, { color: colors.mutedFg }]}>{s.text}</NxText>
            </View>
          </View>
        ))}

        {/* Our Commitment */}
        <View style={[styles.commitCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <LinearGradient
            colors={[`${colors.primary}10`, "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={[styles.commitIcon, { backgroundColor: `${colors.primary}15` }]}>
            <Feather name="heart" size={20} color={colors.primary} />
          </View>
          <NxText style={[styles.commitTitle, { color: colors.foreground }]}>Our Commitment</NxText>
          <NxText style={[styles.commitText, { color: colors.mutedFg }]}>
            We are committed to protecting your privacy and providing a safe space for private communication and meaningful connections on XYTEEE Nexus.
          </NxText>
        </View>

        {/* Contact */}
        <View style={[styles.contactCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.contactIcon, { backgroundColor: `${colors.primary}15` }]}>
            <Feather name="mail" size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <NxText style={[styles.contactTitle, { color: colors.foreground }]}>
              Questions about privacy?
            </NxText>
            <NxText style={[styles.contactEmail, { color: colors.primary }]}>
              contact@xyteee.com
            </NxText>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedFg} style={{ opacity: 0.4 }} />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Feather name="shield" size={12} color={colors.mutedFg} />
          <NxText style={[styles.footerText, { color: colors.mutedFg }]}>XYTEEE NEXUS  ·  Privacy & Policy</NxText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 48,
  },
  hero: {
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: 24,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 20,
    overflow: "hidden",
  },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  heroTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    textAlign: "center",
  },
  heroDesc: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 4,
  },
  datePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  dateText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
  },
  sectionLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 12,
  },
  sectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sectionLabelText: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 1.2,
  },
  card: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: radii.lg,
    marginBottom: 8,
    overflow: "hidden",
  },
  cardAccent: {
    width: 3,
  },
  cardContent: {
    flex: 1,
    padding: 14,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    lineHeight: 19,
    flex: 1,
  },
  cardBody: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 10,
    paddingLeft: 42,
  },
  commitCard: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 18,
    marginTop: 8,
    alignItems: "center",
    overflow: "hidden",
  },
  commitIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  commitTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 16,
    textAlign: "center",
  },
  commitText: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
  },
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 16,
    marginTop: 10,
  },
  contactIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  contactTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
  },
  contactEmail: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    marginTop: 2,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 28,
  },
  footerText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.5,
  },
});
