// Opt-in daily reminder for the installed app.
//
// The web/PWA build has no reliable background scheduling, so reminders are
// native-only. Everything here is defensive: a denied permission, a missing
// plugin, or an unsupported platform simply leaves the rest of the game alone.

export const REMINDER_ID = 1042;
export const DEFAULT_REMINDER_TIME = "09:00";

export function normalizeReminderTime(value) {
  if (typeof value !== "string") return DEFAULT_REMINDER_TIME;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return DEFAULT_REMINDER_TIME;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return DEFAULT_REMINDER_TIME;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function getNotificationsPlugin(global = globalThis) {
  return global.Capacitor?.Plugins?.LocalNotifications ?? null;
}

export function isNativeNotifications(global = globalThis) {
  return Boolean(global.Capacitor?.isNativePlatform?.() && getNotificationsPlugin(global));
}

export function reminderCopy({ dueCount = 0, streak = 0, completedToday = false } = {}) {
  if (dueCount > 0) {
    return {
      title: "A missed case is ready",
      body: `${dueCount} case${dueCount === 1 ? "" : "s"} waiting for review.`
    };
  }
  if (completedToday) {
    return {
      title: "Streak safe — nice work",
      body: streak > 0 ? `You're at ${streak} days. New cases tomorrow.` : "New cases arrive tomorrow."
    };
  }
  return {
    title: "Today's cases are ready",
    body: streak > 0 ? `Keep your ${streak}-day streak alive.` : "Five quick clinical cases await."
  };
}

export function nextReminderDate(time = DEFAULT_REMINDER_TIME, now = new Date()) {
  const [hours, minutes] = normalizeReminderTime(time).split(":").map(Number);
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

export async function requestReminderPermission(plugin = getNotificationsPlugin()) {
  if (!plugin?.requestPermissions) return "unsupported";
  try {
    const status = await plugin.requestPermissions();
    return status?.display === "granted" || status === "granted" ? "granted" : "denied";
  } catch {
    return "denied";
  }
}

export async function cancelDailyReminder(plugin = getNotificationsPlugin()) {
  if (!plugin?.cancel) return false;
  try {
    // The native plugin expects { notifications: [{ id }] }; passing `ids`
    // makes its Android implementation dereference a null array and crash.
    await plugin.cancel({ notifications: [{ id: REMINDER_ID }] });
    return true;
  } catch {
    return false;
  }
}

export async function scheduleDailyReminder(
  profile,
  {
    plugin = getNotificationsPlugin(),
    native = isNativeNotifications(),
    now = new Date(),
    dueCount = 0,
    completedToday = false
  } = {}
) {
  if (!native || !plugin?.schedule) {
    await cancelDailyReminder(plugin);
    return "unsupported";
  }

  const settings = profile?.settings ?? {};
  if (!settings.reminders) {
    await cancelDailyReminder(plugin);
    return "disabled";
  }

  const permission = await requestReminderPermission(plugin);
  if (permission !== "granted") {
    await cancelDailyReminder(plugin);
    return permission;
  }

  const copy = reminderCopy({
    dueCount,
    streak: Number(profile?.streak) || 0,
    completedToday
  });

  try {
    await cancelDailyReminder(plugin);
    await plugin.schedule({
      notifications: [{
        id: REMINDER_ID,
        title: copy.title,
        body: copy.body,
        schedule: {
          at: nextReminderDate(settings.reminderTime, now),
          repeats: true,
          every: "day",
          allowWhileIdle: true
        }
      }]
    });
    return "scheduled";
  } catch {
    return "error";
  }
}

export async function syncDailyReminder(profile, options = {}) {
  return scheduleDailyReminder(profile, options);
}
