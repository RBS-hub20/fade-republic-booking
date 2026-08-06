import { Platform } from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";

/**
 * Thin wrapper over expo-av for the spoken loop: record the learner's turn to
 * base64 audio, and play the tutor's reply back. The server holds all API keys;
 * the device only captures and plays audio.
 */

export interface RecordedAudio {
  base64: string;
  mimeType: string;
}

export async function requestMicPermission(): Promise<boolean> {
  const { granted } = await Audio.requestPermissionsAsync();
  return granted;
}

export async function startRecording(): Promise<Audio.Recording> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });
  const recording = new Audio.Recording();
  await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
  await recording.startAsync();
  return recording;
}

/** Stops the recording and returns its bytes as base64 + a mime type. */
export async function stopRecording(recording: Audio.Recording): Promise<RecordedAudio> {
  await recording.stopAndUnloadAsync();
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

  const uri = recording.getURI();
  if (!uri) throw new Error("Recording produced no file");

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  // HIGH_QUALITY records AAC in an .m4a container on iOS/Android; web → webm.
  const mimeType = Platform.OS === "web" ? "audio/webm" : "audio/m4a";
  return { base64, mimeType };
}

/**
 * Plays base64-encoded audio and resolves when playback finishes (or errors).
 * Writes to a cache file first because expo-av plays from a URI.
 */
export async function playBase64Audio(base64: string): Promise<void> {
  const path = `${FileSystem.cacheDirectory ?? ""}lola-reply-${Date.now()}.mp3`;
  await FileSystem.writeAsStringAsync(path, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });

  const { sound } = await Audio.Sound.createAsync({ uri: path });

  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      void sound.unloadAsync().catch(() => undefined);
      void FileSystem.deleteAsync(path, { idempotent: true }).catch(() => undefined);
      resolve();
    };
    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) {
        finish();
        return;
      }
      if (status.didJustFinish) finish();
    });
    void sound.playAsync().catch(finish);
  });
}
