import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { apiBaseUrl, fetchHealth } from "../api/client";
import type { HealthResponse, ProviderHealth } from "../types";
import { palette, radius, space, type } from "../theme/theme";

type Status =
  | { phase: "loading" }
  | { phase: "ready"; data: HealthResponse }
  | { phase: "error"; message: string };

/**
 * Phase 1 scaffold screen. Confirms the app ↔ server connection and shows each
 * provider adapter's real mode (stub vs live). Stands in for the conversation
 * screen, which becomes the emotional centerpiece in later phases.
 */
export function HealthScreen() {
  const [status, setStatus] = useState<Status>({ phase: "loading" });

  const load = useCallback(async () => {
    setStatus({ phase: "loading" });
    try {
      const data = await fetchHealth();
      setStatus({ phase: "ready", data });
    } catch (err) {
      setStatus({
        phase: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      accessibilityLabel="Lola system status"
    >
      <Text style={styles.kicker}>LOLA</Text>
      <Text style={styles.hero}>Get speaking it{"\n"}with your family.</Text>
      <Text style={styles.sub}>
        Heritage-language conversation practice. This screen confirms the app is
        talking to its tutor server.
      </Text>

      {status.phase === "loading" && (
        <View style={styles.center}>
          <ActivityIndicator color={palette.primary} />
          <Text style={styles.muted}>Reaching the tutor server…</Text>
        </View>
      )}

      {status.phase === "error" && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Can’t reach the server yet</Text>
          <Text style={styles.muted}>{status.message}</Text>
          <Text style={styles.hint}>
            Start it with <Text style={styles.code}>npm run dev:server</Text>, then
            point <Text style={styles.code}>EXPO_PUBLIC_API_URL</Text> at it.
          </Text>
          <Text style={styles.hint}>Trying: {apiBaseUrl}</Text>
          <PrimaryButton label="Try again" onPress={load} />
        </View>
      )}

      {status.phase === "ready" && (
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor:
                    status.data.status === "ok" ? palette.success : palette.warning,
                },
              ]}
            />
            <Text style={styles.cardTitle}>
              {status.data.service} · v{status.data.version} · {status.data.status}
            </Text>
          </View>

          <Text style={styles.sectionLabel}>
            Practising {status.data.language.targetLabel} ·{" "}
            {status.data.language.registers.join(" / ")}
          </Text>

          {status.data.providers.map((p) => (
            <ProviderRow key={p.kind} provider={p} />
          ))}

          <PrimaryButton label="Refresh" onPress={load} />
        </View>
      )}
    </ScrollView>
  );
}

function ProviderRow({ provider }: { provider: ProviderHealth }) {
  const live = provider.mode === "live";
  return (
    <View style={styles.providerRow}>
      <Text style={styles.providerKind}>{provider.kind.toUpperCase()}</Text>
      <Text style={styles.providerName}>{provider.name}</Text>
      <View
        style={[
          styles.badge,
          { backgroundColor: live ? palette.primaryTint : palette.goldTint },
        ]}
      >
        <Text style={[styles.badgeText, { color: live ? palette.primaryDeep : palette.gold }]}>
          {provider.mode}
        </Text>
      </View>
    </View>
  );
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.canvas },
  content: { padding: space.xl, paddingTop: space.xxxl, gap: space.md },
  kicker: {
    ...type.label,
    color: palette.gold,
    letterSpacing: 3,
  },
  hero: { ...type.hero, color: palette.ink },
  sub: { ...type.body, color: palette.inkSoft, marginTop: space.xs },
  center: { alignItems: "center", gap: space.sm, paddingVertical: space.xxl },
  muted: { ...type.body, color: palette.inkSoft },
  hint: { ...type.caption, color: palette.inkFaint, marginTop: space.xs },
  code: { fontFamily: "monospace", color: palette.primaryDeep },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: space.xl,
    gap: space.md,
    marginTop: space.lg,
    shadowColor: palette.ink,
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  dot: { width: 10, height: 10, borderRadius: radius.pill },
  cardTitle: { ...type.heading, color: palette.ink, flexShrink: 1 },
  sectionLabel: { ...type.label, color: palette.inkSoft },
  providerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.surfaceSunk,
  },
  providerKind: { ...type.label, color: palette.inkFaint, width: 44 },
  providerName: { ...type.body, color: palette.ink, flex: 1 },
  badge: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
  },
  badgeText: { ...type.caption, fontWeight: "700" },
  button: {
    backgroundColor: palette.primary,
    borderRadius: radius.md,
    paddingVertical: space.md,
    alignItems: "center",
    marginTop: space.sm,
  },
  buttonPressed: { backgroundColor: palette.primaryDeep },
  buttonText: { ...type.label, color: palette.surface },
});
