import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { Audio } from "expo-av";
import {
  apiBaseUrl,
  createSession,
  NoSpeechError,
  sendMessage,
  sendVoiceTurn,
} from "../api/client";
import {
  playBase64Audio,
  requestMicPermission,
  startRecording,
  stopRecording,
} from "../audio/voice";
import { VoiceButton, type VoicePhase } from "../components/VoiceButton";
import type {
  Coaching,
  LearnerLevel,
  PhonemeScore,
  PhonemeStatus,
  PronunciationReport,
  Session,
} from "../types";
import { palette, radius, space, type } from "../theme/theme";

interface Turn {
  id: string;
  role: "learner" | "tutor";
  text: string;
  coaching?: Coaching | null;
  pronunciation?: PronunciationReport | null;
}

type Phase =
  | { kind: "connecting" }
  | { kind: "ready"; session: Session }
  | { kind: "error"; message: string };

/**
 * The signature screen: the act of speaking with your family. Phase 2 is
 * text-first — the live waveform / voice presence arrives in Phase 3. The tutor
 * reply and the coaching are rendered as two distinct surfaces.
 */
export function ConversationScreen() {
  const [phase, setPhase] = useState<Phase>({ kind: "connecting" });
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [level, setLevel] = useState<LearnerLevel>("building");
  const [voicePhase, setVoicePhase] = useState<VoicePhase>("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const [working, setWorking] = useState<string[]>([]);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const scrollDown = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const connect = useCallback(async () => {
    setPhase({ kind: "connecting" });
    try {
      const session = await createSession();
      setPhase({ kind: "ready", session });
      setLevel(session.learnerState.level);
    } catch (err) {
      setPhase({
        kind: "error",
        message: err instanceof Error ? err.message : "Couldn't reach the tutor.",
      });
    }
  }, []);

  useEffect(() => {
    void connect();
  }, [connect]);

  const onSend = useCallback(async () => {
    if (phase.kind !== "ready") return;
    const text = draft.trim();
    if (!text || thinking) return;

    setDraft("");
    const learnerTurn: Turn = { id: `l-${Date.now()}`, role: "learner", text };
    setTurns((prev) => [...prev, learnerTurn]);
    setThinking(true);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));

    try {
      const res = await sendMessage(phase.session.id, text);
      setLevel(res.level);
      setTurns((prev) => [
        ...prev,
        { id: res.utterance.id, role: "tutor", text: res.reply, coaching: res.coaching },
      ]);
    } catch {
      setTurns((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "tutor",
          text: "Naku, nawalan tayo ng koneksyon. Subukan nating muli? (We lost the connection — try again?)",
        },
      ]);
    } finally {
      setThinking(false);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  }, [phase, draft, thinking]);

  const onMicPress = useCallback(async () => {
    if (phase.kind !== "ready") return;
    setNotice(null);

    // Tap while recording → stop and run the spoken turn.
    if (voicePhase === "recording") {
      const recording = recordingRef.current;
      recordingRef.current = null;
      if (!recording) {
        setVoicePhase("idle");
        return;
      }
      setVoicePhase("thinking");
      scrollDown();
      try {
        const audio = await stopRecording(recording);
        const res = await sendVoiceTurn(phase.session.id, audio.base64, audio.mimeType);
        setLevel(res.level);
        if (res.pronunciation && res.pronunciation.weakPhonemes.length > 0) {
          setWorking(res.pronunciation.weakPhonemes);
        }
        setTurns((prev) => [
          ...prev,
          { id: `vl-${res.utterance.id}`, role: "learner", text: res.transcript },
          {
            id: res.utterance.id,
            role: "tutor",
            text: res.reply,
            coaching: res.coaching,
            pronunciation: res.pronunciation,
          },
        ]);
        scrollDown();
        setVoicePhase("speaking");
        await playBase64Audio(res.audioBase64);
      } catch (err) {
        if (err instanceof NoSpeechError) {
          setNotice("I couldn’t hear any words — try again, a little closer to the mic.");
        } else {
          setNotice("Something went wrong with that turn. Try again?");
        }
      } finally {
        setVoicePhase("idle");
        scrollDown();
      }
      return;
    }

    // Tap while idle → start recording.
    if (voicePhase === "idle") {
      const granted = await requestMicPermission();
      if (!granted) {
        setNotice("Lola needs microphone access to hear you. Enable it in Settings.");
        return;
      }
      try {
        recordingRef.current = await startRecording();
        setVoicePhase("recording");
      } catch {
        setNotice("Couldn’t start recording. Check microphone permissions.");
        setVoicePhase("idle");
      }
    }
  }, [phase, voicePhase, scrollDown]);

  const voiceBusy = voicePhase !== "idle";

  if (phase.kind === "connecting") {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.onGabiSoft} />
        <Text style={styles.connectingText}>Reaching Lola…</Text>
      </View>
    );
  }

  if (phase.kind === "error") {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Can’t reach the tutor yet</Text>
        <Text style={styles.connectingText}>{phase.message}</Text>
        <Text style={styles.hint}>Start the server, then point the app at {apiBaseUrl}</Text>
        <Pressable onPress={connect} style={styles.retry} accessibilityRole="button">
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const { session } = phase;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.scene}>{session.scenario.title}</Text>
        <Text style={styles.sceneSub}>{session.scenario.description}</Text>
        <View style={styles.headerChips}>
          <View style={styles.levelChip}>
            <Text style={styles.levelText}>{level}</Text>
          </View>
          {working.length > 0 && (
            <Text style={styles.working}>
              working on <Text style={styles.workingPhonemes}>{working.join(" · ")}</Text>
            </Text>
          )}
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.transcript}
        contentContainerStyle={styles.transcriptContent}
        keyboardShouldPersistTaps="handled"
      >
        {turns.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Say hello to your lola.</Text>
            <Text style={styles.emptyBody}>
              Type anything in Tagalog — or Taglish. She’s just happy you’re here.
              Try “Kumusta po kayo?”
            </Text>
          </View>
        )}

        {turns.map((turn) =>
          turn.role === "learner" ? (
            <LearnerBubble key={turn.id} text={turn.text} />
          ) : (
            <TutorTurn
              key={turn.id}
              text={turn.text}
              coaching={turn.coaching}
              pronunciation={turn.pronunciation}
            />
          ),
        )}

        {(thinking || voicePhase === "thinking") && <ThinkingRow />}
      </ScrollView>

      <View style={styles.dock}>
        <VoiceButton phase={voicePhase} onPress={onMicPress} />
        {notice && (
          <Text style={styles.notice} accessibilityLiveRegion="polite">
            {notice}
          </Text>
        )}
      </View>

      <View style={styles.inputBar}>
        <TextInput
          style={[styles.input, voiceBusy && styles.inputDisabled]}
          value={draft}
          onChangeText={setDraft}
          editable={!voiceBusy}
          placeholder="…or type instead"
          placeholderTextColor={palette.onGabiSoft}
          multiline
          onSubmitEditing={onSend}
          accessibilityLabel="Your message to Lola"
        />
        <Pressable
          onPress={onSend}
          disabled={thinking || voiceBusy || draft.trim().length === 0}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.send,
            (thinking || voiceBusy || draft.trim().length === 0) && styles.sendDisabled,
            pressed && styles.sendPressed,
          ]}
        >
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function LearnerBubble({ text }: { text: string }) {
  return (
    <View style={styles.learnerRow}>
      <View style={styles.learnerBubble}>
        <Text style={styles.learnerText}>{text}</Text>
      </View>
    </View>
  );
}

function TutorTurn({
  text,
  coaching,
  pronunciation,
}: {
  text: string;
  coaching?: Coaching | null;
  pronunciation?: PronunciationReport | null;
}) {
  return (
    <View style={styles.tutorRow}>
      <View style={styles.tutorBubble}>
        <Text style={styles.tutorText}>{text}</Text>
      </View>
      {pronunciation && <PronunciationCard report={pronunciation} />}
      {coaching && <CoachingCard coaching={coaching} />}
    </View>
  );
}

const PHONEME_COLOR: Record<PhonemeStatus, string> = {
  good: palette.listen,
  shaky: palette.gold,
  off: palette.puso,
  missed: palette.danger,
  extra: palette.inkFaint,
};

function PronunciationCard({ report }: { report: PronunciationReport }) {
  // Show the sounds worth attention; if it was clean, celebrate briefly.
  const flagged = report.phonemes.filter((p) => p.status !== "good");
  const pct = Math.round(report.overall * 100);

  return (
    <View style={styles.pron} accessibilityLabel="Pronunciation feedback">
      <View style={styles.pronHeaderRow}>
        <Text style={styles.pronHeader}>pronunciation</Text>
        <Text style={styles.pronScore}>{pct}%</Text>
      </View>

      {flagged.length === 0 ? (
        <Text style={styles.pronClean}>Beautifully clear — every sound landed.</Text>
      ) : (
        <View style={styles.chips}>
          {flagged.map((p, i) => (
            <PhonemeChip key={i} phoneme={p} />
          ))}
        </View>
      )}

      {report.tips.map((tip, i) => (
        <Text key={i} style={styles.pronTip}>
          {tip.replace(/\*/g, "")}
        </Text>
      ))}
    </View>
  );
}

function PhonemeChip({ phoneme }: { phoneme: PhonemeScore }) {
  return (
    <View style={[styles.chip, { borderColor: PHONEME_COLOR[phoneme.status] }]}>
      <Text style={[styles.chipText, { color: PHONEME_COLOR[phoneme.status] }]}>
        {phoneme.phoneme}
      </Text>
      <Text style={styles.chipStatus}>{phoneme.status}</Text>
    </View>
  );
}

function CoachingCard({ coaching }: { coaching: Coaching }) {
  const hasContent =
    coaching.corrections.length > 0 ||
    coaching.pronunciation ||
    coaching.register ||
    coaching.newPhrase ||
    coaching.encouragement;
  if (!hasContent) return null;

  return (
    <View style={styles.coaching} accessibilityLabel="Gentle feedback from Lola">
      <Text style={styles.coachingHeader}>gentle feedback</Text>

      {coaching.corrections.map((c, i) => (
        <View key={i} style={styles.coachItem}>
          <Text style={styles.coachBetter}>{c.better}</Text>
          {!!c.note && <Text style={styles.coachNote}>{c.note}</Text>}
        </View>
      ))}

      {coaching.pronunciation && (
        <CoachLine label="Sound" value={coaching.pronunciation} />
      )}
      {coaching.register && <CoachLine label="Register" value={coaching.register} />}
      {coaching.newPhrase && (
        <CoachLine
          label="Try this"
          value={`${coaching.newPhrase.phrase} — ${coaching.newPhrase.meaning}`}
        />
      )}
      {coaching.encouragement && (
        <Text style={styles.encouragement}>{coaching.encouragement}</Text>
      )}
    </View>
  );
}

function CoachLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.coachItem}>
      <Text style={styles.coachLabel}>{label}</Text>
      <Text style={styles.coachNote}>{value}</Text>
    </View>
  );
}

function ThinkingRow() {
  return (
    <View style={styles.tutorRow}>
      <View style={[styles.tutorBubble, styles.thinkingBubble]}>
        <Text style={styles.thinkingText}>Lola is thinking…</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.gabi },
  center: {
    flex: 1,
    backgroundColor: palette.gabi,
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    padding: space.xl,
  },
  connectingText: { ...type.body, color: palette.onGabiSoft, textAlign: "center" },
  errorTitle: { ...type.heading, color: palette.onGabi },
  hint: { ...type.caption, color: palette.onGabiSoft, textAlign: "center", marginTop: space.sm },
  retry: {
    marginTop: space.lg,
    backgroundColor: palette.gold,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderRadius: radius.pill,
  },
  retryText: { ...type.label, color: palette.gabi },

  header: {
    paddingHorizontal: space.xl,
    paddingTop: space.xxl,
    paddingBottom: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.gabiSoft,
  },
  scene: { ...type.title, color: palette.onGabi },
  sceneSub: { ...type.body, color: palette.onGabiSoft, marginTop: space.xs },
  headerChips: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginTop: space.md,
  },
  levelChip: {
    backgroundColor: palette.gabiSoft,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
  },
  levelText: { ...type.caption, color: palette.gold, fontWeight: "700" },
  working: { ...type.caption, color: palette.onGabiSoft },
  workingPhonemes: { color: palette.puso, fontWeight: "700" },

  transcript: { flex: 1 },
  transcriptContent: { padding: space.lg, gap: space.lg },

  empty: { paddingVertical: space.xxxl, paddingHorizontal: space.md, gap: space.sm },
  emptyTitle: { ...type.heading, color: palette.onGabi },
  emptyBody: { ...type.body, color: palette.onGabiSoft },

  learnerRow: { alignItems: "flex-end" },
  learnerBubble: {
    maxWidth: "82%",
    backgroundColor: palette.primary,
    borderRadius: radius.lg,
    borderBottomRightRadius: radius.sm,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  learnerText: { ...type.body, color: palette.surface },

  tutorRow: { alignItems: "flex-start", gap: space.sm, maxWidth: "88%" },
  tutorBubble: {
    backgroundColor: palette.onGabi,
    borderRadius: radius.lg,
    borderBottomLeftRadius: radius.sm,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  tutorText: { ...type.bodyLg, color: palette.ink },
  thinkingBubble: { backgroundColor: palette.gabiSoft },
  thinkingText: { ...type.body, color: palette.onGabiSoft, fontStyle: "italic" },

  pron: {
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.sm,
    borderLeftWidth: 3,
    borderLeftColor: palette.listen,
  },
  pronHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pronHeader: {
    ...type.caption,
    color: palette.listen,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  pronScore: { ...type.label, color: palette.ink, fontWeight: "700" },
  pronClean: { ...type.caption, color: palette.inkSoft },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 4,
  },
  chipText: { ...type.label, fontWeight: "700" },
  chipStatus: { ...type.caption, color: palette.inkFaint },
  pronTip: { ...type.caption, color: palette.inkSoft },
  coaching: {
    backgroundColor: palette.goldTint,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.sm,
    borderLeftWidth: 3,
    borderLeftColor: palette.gold,
  },
  coachingHeader: {
    ...type.caption,
    color: palette.gold,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  coachItem: { gap: 2 },
  coachLabel: { ...type.caption, color: palette.inkSoft, fontWeight: "700" },
  coachBetter: { ...type.label, color: palette.ink },
  coachNote: { ...type.caption, color: palette.inkSoft },
  encouragement: { ...type.body, color: palette.primaryDeep, fontStyle: "italic" },

  dock: {
    alignItems: "center",
    paddingTop: space.md,
    paddingHorizontal: space.xl,
    gap: space.sm,
  },
  notice: { ...type.caption, color: palette.puso, textAlign: "center" },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.gabiSoft,
    backgroundColor: palette.gabi,
  },
  inputDisabled: { opacity: 0.5 },
  input: {
    flex: 1,
    ...type.body,
    color: palette.onGabi,
    backgroundColor: palette.gabiSoft,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.md,
    maxHeight: 120,
  },
  send: {
    backgroundColor: palette.gold,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
  },
  sendDisabled: { opacity: 0.4 },
  sendPressed: { opacity: 0.85 },
  sendText: { ...type.label, color: palette.gabi },
});
