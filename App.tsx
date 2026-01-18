import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TextInput,
  Modal,
  Dimensions,
  Alert,
  Platform,
} from "react-native";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import MapView, { Circle, Marker } from "./MapComponents";
import {
  MapPin,
  Plus,
  Bell,
  Search,
  Settings,
  Trash2,
  CheckCircle,
  ChevronRight,
  Navigation,
  X,
} from "lucide-react-native";
import {
  ReminderTask,
  getTasks,
  saveTask,
  deleteTask,
  updateTask,
} from "./storage";
import { LOCATION_GEOFENCE_TASK } from "./backgroundTasks";

// Register background tasks in index.ts or top level
if (Platform.OS !== "web") {
  require("./backgroundTasks");
}

const { width, height } = Dimensions.get("window");

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function App() {
  const [tasks, setTasks] = useState<ReminderTask[]>([]);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isPickingLocation, setIsPickingLocation] = useState(false);

  // New Task State
  const [newTitle, setNewTitle] = useState("");
  const [newNote, setNewNote] = useState("");
  const [tempLocation, setTempLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [radius, setRadius] = useState(200);

  useEffect(() => {
    loadTasks();
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS === "web") return;

    const { status: foregroundStatus } =
      await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus === "granted") {
      const { status: backgroundStatus } =
        await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Background location is needed for geofencing reminders.",
        );
      }
    }

    const { status: notificationStatus } =
      await Notifications.requestPermissionsAsync();
    if (notificationStatus !== "granted") {
      Alert.alert(
        "Permission Denied",
        "Notifications are needed to alert you.",
      );
    }
  };

  const loadTasks = async () => {
    const storedTasks = await getTasks();
    setTasks(storedTasks);

    // Synchronize geofences
    syncGeofences(storedTasks);
  };

  const syncGeofences = async (tasksList: ReminderTask[]) => {
    if (Platform.OS === "web") return;
    const isRegistered = await TaskManager.isTaskRegisteredAsync(
      LOCATION_GEOFENCE_TASK,
    );

    const activeTasks = tasksList.filter((t) => !t.triggered);

    if (activeTasks.length > 0) {
      const regions = activeTasks.map((t) => ({
        identifier: t.id,
        latitude: t.location.latitude,
        longitude: t.location.longitude,
        radius: t.radius,
        notifyOnEntry: true,
        notifyOnExit: false,
      }));

      try {
        await Location.startGeofencingAsync(LOCATION_GEOFENCE_TASK, regions);
        console.log("Geofencing started for", regions.length, "regions");
      } catch (e) {
        console.error("Failed to start geofencing", e);
      }
    } else {
      if (isRegistered) {
        await Location.stopGeofencingAsync(LOCATION_GEOFENCE_TASK);
      }
    }
  };

  const handleAddTask = async () => {
    if (!newTitle || !tempLocation) {
      Alert.alert(
        "Missing Info",
        "Please provide a title and select a location.",
      );
      return;
    }

    const newTask: ReminderTask = {
      id: Math.random().toString(36).substr(2, 9),
      title: newTitle,
      note: newNote,
      location: tempLocation,
      radius: radius,
      triggered: false,
    };

    await saveTask(newTask);
    setTasks((prev) => [...prev, newTask]);
    setIsAddingTask(false);
    setNewTitle("");
    setNewNote("");
    setTempLocation(null);
    setRadius(200);

    // Sync geofences
    syncGeofences([...tasks, newTask]);
  };

  const handleDelete = async (id: string) => {
    await deleteTask(id);
    const updated = tasks.filter((t) => t.id !== id);
    setTasks(updated);
    syncGeofences(updated);
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <MapPin size={64} color="#00c2ab" strokeWidth={1} />
      </View>
      <Text style={styles.emptyTitle}>Your map is quiet</Text>
      <Text style={styles.emptySubtitle}>
        Pin a task to a place and we'll alert you exactly when you arrive.
      </Text>
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => setIsAddingTask(true)}
      >
        <Text style={styles.primaryButtonText}>Add Location Reminder</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Active Reminders</Text>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconButton}>
              <Search size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton}>
              <Settings size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        {tasks.filter((t) => !t.triggered).length > 0 && (
          <Text style={styles.headerSubtitle}>
            {tasks.filter((t) => !t.triggered).length} PROXIMITY TRIGGERS ACTIVE
          </Text>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {tasks.length === 0
          ? renderEmptyState()
          : tasks.map((task) => (
              <View
                key={task.id}
                style={[styles.card, task.triggered && styles.cardTriggered]}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardInfo}>
                    <View style={styles.cardIconBox}>
                      <Bell size={20} color="#00c2ab" />
                    </View>
                    <View>
                      <Text style={styles.cardTitle}>{task.title}</Text>
                      <Text style={styles.cardLocationName}>
                        {task.triggered
                          ? "Completed"
                          : `Within ${task.radius}m`}
                      </Text>
                    </View>
                  </View>
                  {!task.triggered && (
                    <View style={styles.radiusBadge}>
                      <View style={styles.radiusDot} />
                      <Text style={styles.radiusText}>{task.radius}m</Text>
                    </View>
                  )}
                </View>
                {task.note ? (
                  <Text style={styles.cardNote}>{task.note}</Text>
                ) : null}
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(task.id)}
                >
                  <Trash2 size={16} color="#ef4444" />
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            ))}
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setIsAddingTask(true)}
      >
        <Plus size={32} color="#18181b" />
      </TouchableOpacity>

      {/* Add Task Modal */}
      <Modal visible={isAddingTask} animationType="slide" transparent={false}>
        <SafeAreaView
          style={[styles.container, { backgroundColor: "#18181b" }]}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setIsAddingTask(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Task</Text>
            <View style={{ width: 60 }} />
          </View>

          <View style={styles.formContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>TASK TITLE</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Pick up dry cleaning"
                placeholderTextColor="#4b5563"
                value={newTitle}
                onChangeText={setNewTitle}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>NOTES / DESCRIPTION</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Add more details here..."
                placeholderTextColor="#4b5563"
                multiline
                value={newNote}
                onChangeText={setNewNote}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>REMIND ME AT</Text>
              <TouchableOpacity
                style={styles.locationPicker}
                onPress={() => setIsPickingLocation(true)}
              >
                <View style={styles.locationPreview}>
                  <MapPin size={24} color="#00c2ab" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.locationText}>
                    {tempLocation ? "Location Set" : "Select Location"}
                  </Text>
                  <Text style={styles.locationSubtext}>
                    {tempLocation
                      ? `${tempLocation.latitude.toFixed(4)}, ${tempLocation.longitude.toFixed(4)}`
                      : "Tap to pick on map"}
                  </Text>
                </View>
                <ChevronRight size={20} color="#4b5563" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>RADIUS: {radius}m</Text>
              <View style={styles.radiusControls}>
                {[100, 200, 500, 1000].map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[
                      styles.radiusBtn,
                      radius === r && styles.radiusBtnActive,
                    ]}
                    onPress={() => setRadius(r)}
                  >
                    <Text
                      style={[
                        styles.radiusBtnText,
                        radius === r && styles.radiusBtnTextActive,
                      ]}
                    >
                      {r}m
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={{ flex: 1 }} />

            <TouchableOpacity style={styles.saveBtn} onPress={handleAddTask}>
              <CheckCircle size={20} color="#18181b" />
              <Text style={styles.saveBtnText}>Save Reminder</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {/* Location Picker Modal */}
        <Modal visible={isPickingLocation} animationType="fade">
          <View style={{ flex: 1 }}>
            <MapView
              style={{ flex: 1 }}
              initialRegion={
                {
                  latitude: 37.78825,
                  longitude: -122.4324,
                  latitudeDelta: 0.0922,
                  longitudeDelta: 0.0421,
                } as any
              }
              showsUserLocation
              onPress={(e) => setTempLocation(e.nativeEvent.coordinate)}
            >
              {tempLocation && (
                <>
                  <Marker coordinate={tempLocation} />
                  <Circle
                    center={tempLocation}
                    radius={radius}
                    fillColor="rgba(0, 194, 171, 0.2)"
                    strokeColor="#00c2ab"
                  />
                </>
              )}
            </MapView>

            <View style={styles.mapOverlayHeader}>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => setIsPickingLocation(false)}
              >
                <X size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.mapTitle}>Pick Location</Text>
            </View>

            <View style={styles.mapFooter}>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={() => setIsPickingLocation(false)}
              >
                <Text style={styles.confirmBtnText}>Confirm Location</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#18181b", // background-dark
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 10,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    fontFamily: Platform.OS === "ios" ? "Space Grotesk" : "sans-serif",
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#00c2ab",
    letterSpacing: 2,
    marginTop: 8,
  },
  headerIcons: {
    flexDirection: "row",
    gap: 8,
  },
  iconButton: {
    padding: 8,
    borderRadius: 99,
    backgroundColor: "#24242b",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: "#24242b",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  cardTriggered: {
    opacity: 0.6,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardInfo: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  cardIconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "rgba(0, 194, 171, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  cardLocationName: {
    fontSize: 14,
    color: "#94a3b8",
    marginTop: 2,
  },
  radiusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    backgroundColor: "rgba(0, 194, 171, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(0, 194, 171, 0.3)",
  },
  radiusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#00c2ab",
  },
  radiusText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#00c2ab",
  },
  cardNote: {
    fontSize: 14,
    color: "#94a3b8",
    marginTop: 12,
    lineHeight: 20,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
    alignSelf: "flex-start",
  },
  deleteBtnText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#ef4444",
  },
  fab: {
    position: "absolute",
    bottom: 30,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#00c2ab",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#00c2ab",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 100,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: "rgba(0, 194, 171, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 40,
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 12,
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#94a3b8",
    textAlign: "center",
    marginBottom: 40,
    lineHeight: 24,
  },
  primaryButton: {
    backgroundColor: "#00c2ab",
    paddingHorizontal: 32,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#18181b",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    height: 64,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  cancelText: {
    color: "#00c2ab",
    fontSize: 17,
  },
  modalTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  formContent: {
    flex: 1,
    padding: 24,
  },
  inputGroup: {
    marginBottom: 32,
  },
  label: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#64748b",
    letterSpacing: 2,
    marginBottom: 12,
    marginLeft: 4,
  },
  input: {
    backgroundColor: "#24242b",
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: "#fff",
    fontWeight: "600",
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: "top",
    fontSize: 16,
    fontWeight: "400",
  },
  locationPicker: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#24242b",
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  locationPreview: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: "#18181b",
    justifyContent: "center",
    alignItems: "center",
  },
  locationText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
  },
  locationSubtext: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 2,
  },
  radiusControls: {
    flexDirection: "row",
    gap: 10,
  },
  radiusBtn: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#24242b",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  radiusBtnActive: {
    borderColor: "#00c2ab",
    backgroundColor: "rgba(0, 194, 171, 0.1)",
  },
  radiusBtnText: {
    color: "#64748b",
    fontWeight: "bold",
  },
  radiusBtnTextActive: {
    color: "#00c2ab",
  },
  saveBtn: {
    backgroundColor: "#00c2ab",
    height: 64,
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginBottom: 40,
  },
  saveBtnText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#18181b",
  },
  mapOverlayHeader: {
    position: "absolute",
    top: 60,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(24, 24, 27, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    textShadowColor: "black",
    textShadowRadius: 4,
  },
  mapFooter: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
  },
  confirmBtn: {
    backgroundColor: "#00c2ab",
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  confirmBtnText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#18181b",
  },
});
