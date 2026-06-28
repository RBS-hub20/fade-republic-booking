import { StatusBar } from "expo-status-bar";
import { SafeAreaView, StyleSheet } from "react-native";
import { ConversationScreen } from "./src/screens/ConversationScreen";
import { palette } from "./src/theme/theme";

export default function App() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ConversationScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // The conversation screen is the centerpiece — warm indigo "gabi" night.
  safe: { flex: 1, backgroundColor: palette.gabi },
});
