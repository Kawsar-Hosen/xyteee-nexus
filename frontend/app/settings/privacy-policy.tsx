import React from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/src/context/ThemeContext";
import { NxText } from "@/src/components/NxText";
import { fonts, radii, spacing } from "@/src/theme";

const SECTIONS = [
  {
    icon: "lock",
    title: "Private Chats",
    text: "Your private chats are not public. Messages and content shared in a private conversation are available only through accounts that are participants in that conversation. Private conversations do not appear on public profiles, in search results, or in public areas of XYTEEE Nexus.",
  },
  {
    icon: "message-circle",
    title: "Your Conversations",
    text: "Other users cannot open or view conversations they are not part of. Access to private conversations is protected by account authentication and conversation membership checks.",
  },
  {
    icon: "shield",
    title: "Account Privacy",
    text: "You control your account privacy. When your account is private, access to protected profile content is limited according to your approved connections and privacy settings.",
  },
  {
    icon: "user-x",
    title: "Blocked Users",
    text: "Blocking helps restrict interactions between accounts. You can review and manage blocked users at any time from Settings.",
  },
  {
    icon: "key",
    title: "Password & Account Security",
    text: "Passwords are protected using secure password hashing and are not displayed publicly. Never share your password, verification codes, or account access information with anyone.",
  },
  {
    icon: "database",
    title: "Personal Information",
    text: "Personal information is used as needed to provide, protect, maintain, and improve XYTEEE Nexus. Information you choose to place on public parts of your profile may be visible to other users according to your privacy settings.",
  },
  {
    icon: "alert-triangle",
    title: "Safety & Reporting",
    text: "If you experience harassment, abuse, spam, or suspicious activity, use the available safety, blocking, and reporting tools. Reports and relevant information may be reviewed when necessary to protect users and enforce platform rules.",
  },
  {
    icon: "trash-2",
    title: "Account & Data",
    text: "You can manage your account from Settings. If you choose to delete your account, associated account data will be handled according to the deletion process and applicable retention requirements of XYTEEE Nexus.",
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
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.iconBtn}
          activeOpacity={0.75}
        >
          <Feather
            name="chevron-left"
            size={26}
            color={colors.foreground}
          />
        </TouchableOpacity>

        <NxText variant="titleSm">Privacy & Policy</NxText>

        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View
          style={[
            styles.hero,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.heroIcon,
              { backgroundColor: colors.surfaceHigh },
            ]}
          >
            <Feather name="shield" size={28} color={colors.primary} />
          </View>

          <NxText
            style={[
              styles.heroTitle,
              { color: colors.foreground },
            ]}
          >
            Your privacy matters
          </NxText>

          <NxText
            style={[
              styles.heroText,
              { color: colors.mutedFg },
            ]}
          >
            XYTEEE Nexus is designed to give you a private and secure space
            to connect with people. This page explains how your account,
            private conversations, personal information, and activity are
            handled.
          </NxText>
        </View>

        {SECTIONS.map((section) => (
          <View
            key={section.title}
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.cardIcon,
                { backgroundColor: colors.surfaceHigh },
              ]}
            >
              <Feather
                name={section.icon as any}
                size={18}
                color={colors.primary}
              />
            </View>

            <View style={styles.cardBody}>
              <NxText
                style={[
                  styles.cardTitle,
                  { color: colors.foreground },
                ]}
              >
                {section.title}
              </NxText>

              <NxText
                style={[
                  styles.cardText,
                  { color: colors.mutedFg },
                ]}
              >
                {section.text}
              </NxText>
            </View>
          </View>
        ))}

        <View
          style={[
            styles.commitment,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Feather name="heart" size={20} color={colors.primary} />

          <View style={{ flex: 1 }}>
            <NxText
              style={[
                styles.commitmentTitle,
                { color: colors.foreground },
              ]}
            >
              Our Commitment
            </NxText>

            <NxText
              style={[
                styles.commitmentText,
                { color: colors.mutedFg },
              ]}
            >
              We are committed to protecting your privacy and providing a
              safer space for private communication and meaningful
              connections.
            </NxText>
          </View>
        </View>

        <NxText
          style={[
            styles.footer,
            { color: colors.mutedFg },
          ]}
        >
          XYTEEE Nexus Privacy & Policy
        </NxText>
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
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 48,
  },
  hero: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 14,
  },
  heroIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  heroTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 20,
    lineHeight: 25,
    textAlign: "center",
  },
  heroText: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 7,
  },
  card: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 13,
    marginBottom: 8,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    lineHeight: 19,
  },
  cardText: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  commitment: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 13,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 18,
    marginTop: 8,
  },
  commitmentTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 15,
    lineHeight: 20,
  },
  commitmentText: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 5,
  },
  footer: {
    fontFamily: fonts.body,
    fontSize: 11,
    textAlign: "center",
    marginTop: 24,
  },
});
