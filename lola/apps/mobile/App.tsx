import { StatusBar } from "expo-status-bar";
import { SafeAreaView, StyleSheet } from "react-native";
import { HealthScreen } from "./src/screens/HealthScreen";
import { palette } from "./src/theme/theme";

export default function App() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <HealthScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas },
});
