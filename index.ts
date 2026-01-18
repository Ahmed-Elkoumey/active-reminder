import { registerRootComponent } from "expo";
import { Platform } from "react-native";

import App from "./App";

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
const isWeb =
  typeof document !== "undefined" ||
  (typeof Platform !== "undefined" && Platform.OS === "web");
if (!isWeb) {
  try {
    require("./backgroundTasks");
  } catch (e) {}
}

registerRootComponent(App);
