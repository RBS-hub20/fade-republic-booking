import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { palette, radius, type } from "../theme/theme";

export type VoicePhase = "idle" | "recording" | "thinking" | "speaking";

const LABEL: Record<VoicePhase, string> = {
  idle: "Hold a thought, then tap to speak",
  recording: "Lola is listening…",
  thinking: "Lola is thinking…",
  speaking: "Lola is speaking…",
};

const COLOR: Record<VoicePhase, string> = {
  idle: palette.gold,
  recording: palette.puso, // the speaking moment — warm rose, used here only
  thinking: palette.onGabiSoft,
  speaking: palette.listen,
};

/**
 * The act of speaking, made the emotional centerpiece. A single warm orb: tap to
 * start/stop recording. It pulses while listening (and while Lola speaks),
 * unless the learner prefers reduced motion.
 */
export function VoiceButton({
  phase,
  onPress,
}: {
  phase: VoicePhase;
  onPress: () => void;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => sub.remove();
  }, []);

  const animating = phase === "recording" || phase === "speaking";

  useEffect(() => {
    if (animating && !reduceMotion) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1,
            duration: 900,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 0,
            duration: 900,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    pulse.setValue(0);
    return undefined;
  }, [animating, reduceMotion, pulse]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });
  const busy = phase === "thinking";

  return (
    <View style={styles.wrap}>
      <View style={styles.orbWrap}>
        {animating && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ring,
              { backgroundColor: COLOR[phase], transform: [{ scale: ringScale }], opacity: ringOpacity },
            ]}
          />
        )}
        <Pressable
          onPress={onPress}
          disabled={busy}
          accessibilityRole="button"
          accessibilityState={{ busy, selected: phase === "recording" }}
          accessibilityLabel={LABEL[phase]}
          style={({ pressed }) => [
            styles.orb,
            { backgroundColor: COLOR[phase], opacity: busy ? 0.7 : pressed ? 0.9 : 1 },
          ]}
        >
          <Text style={styles.glyph}>{glyphFor(phase)}</Text>
        </Pressable>
      </View>
      <Text style={styles.label}>{LABEL[phase]}</Text>
    </View>
  );
}

function glyphFor(phase: VoicePhase): string {
  switch (phase) {
    case "recording":
      return "■"; // tap to stop
    case "thinking":
      return "…";
    case "speaking":
      return "♪";
    default:
      return "🎙";
  }
}

const ORB = 84;

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 10 },
  orbWrap: { width: ORB * 1.6, height: ORB * 1.6, alignItems: "center", justifyContent: "center" },
  ring: {
    position: "absolute",
    width: ORB,
    height: ORB,
    borderRadius: radius.pill,
  },
  orb: {
    width: ORB,
    height: ORB,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  glyph: { fontSize: 30, color: palette.gabi },
  label: { ...type.label, color: palette.onGabiSoft },
});
