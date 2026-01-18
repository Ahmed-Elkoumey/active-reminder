import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";
import { LocationGeofencingEventType } from "expo-location";
import { getTasks, updateTask } from "./storage";

export const LOCATION_GEOFENCE_TASK = "LOCATION_GEOFENCE_TASK";

TaskManager.defineTask(
  LOCATION_GEOFENCE_TASK,
  async ({ data: { eventType, region }, error }: any) => {
    if (error) {
      console.error("Background geofencing task error:", error);
      return;
    }

    if (eventType === LocationGeofencingEventType.Enter) {
      console.log("Entered region:", region);

      // Find the task associated with this region
      const tasks = await getTasks();
      const task = tasks.find((t) => t.id === region.identifier);

      if (task && !task.triggered) {
        // Trigger notification
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `📍 Reminder: ${task.title}`,
            body: task.note,
            data: { taskId: task.id },
          },
          trigger: null, // Immediate
        });

        // Mark as triggered to prevent multiple notifications
        await updateTask({ ...task, triggered: true });

        // Note: Ideally, we should also unregister this specific geofence
        // but expo-location unregistering from within TaskManager is tricky.
        // The 'triggered' flag in the local storage helps avoid double alerts.
      }
    }
  },
);
