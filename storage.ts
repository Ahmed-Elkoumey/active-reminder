import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@active_reminders_tasks";

export interface ReminderTask {
  id: string;
  title: string;
  note: string;
  location: {
    latitude: number;
    longitude: number;
  };
  radius: number;
  triggered: boolean;
}

export const getTasks = async (): Promise<ReminderTask[]> => {
  try {
    const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch (e) {
    console.error("Error fetching tasks", e);
    return [];
  }
};

export const saveTask = async (task: ReminderTask) => {
  try {
    const tasks = await getTasks();
    const newTasks = [...tasks, task];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newTasks));
  } catch (e) {
    console.error("Error saving task", e);
  }
};

export const updateTask = async (updatedTask: ReminderTask) => {
  try {
    const tasks = await getTasks();
    const newTasks = tasks.map((t) =>
      t.id === updatedTask.id ? updatedTask : t,
    );
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newTasks));
  } catch (e) {
    console.error("Error updating task", e);
  }
};

export const deleteTask = async (taskId: string) => {
  try {
    const tasks = await getTasks();
    const newTasks = tasks.filter((t) => t.id !== taskId);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newTasks));
  } catch (e) {
    console.error("Error deleting task", e);
  }
};
