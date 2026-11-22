import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_REMINDER_TIME,
  REMINDER_ID,
  cancelDailyReminder,
  isNativeNotifications,
  nextReminderDate,
  normalizeReminderTime,
  reminderCopy,
  requestReminderPermission,
  scheduleDailyReminder
} from "../src/core/notifications.js";
import { emptyProfile, readProfile, writeProfile } from "../src/core/storage.js";

function fakePlugin({ permission = "granted", scheduleError = false } = {}) {
  const calls = [];
  return {
    calls,
    async requestPermissions() {
      calls.push(["permissions"]);
      return { display: permission };
    },
    async cancel(args) {
      calls.push(["cancel", args]);
    },
    async schedule(args) {
      calls.push(["schedule", args]);
      if (scheduleError) throw new Error("nope");
    }
  };
}

const profile = (overrides = {}) => ({
  streak: 4,
  ...overrides,
  settings: {
    reminders: true,
    reminderTime: "07:30",
    ...overrides.settings
  }
});

test("normalizeReminderTime rejects invalid values", () => {
  assert.equal(normalizeReminderTime("7:30"), "07:30");
  assert.equal(normalizeReminderTime("23:59"), "23:59");
  assert.equal(normalizeReminderTime("24:00"), DEFAULT_REMINDER_TIME);
  assert.equal(normalizeReminderTime("09:99"), DEFAULT_REMINDER_TIME);
  assert.equal(normalizeReminderTime("tomorrow"), DEFAULT_REMINDER_TIME);
  assert.equal(normalizeReminderTime(null), DEFAULT_REMINDER_TIME);
});

test("reminderCopy adapts to queue and streak state", () => {
  assert.deepEqual(reminderCopy({ dueCount: 2, streak: 5 }), {
    title: "A missed case is ready",
    body: "2 cases waiting for review."
  });
  assert.deepEqual(reminderCopy({ completedToday: true, streak: 5 }), {
    title: "Streak safe — nice work",
    body: "You're at 5 days. New cases tomorrow."
  });
  assert.match(reminderCopy().body, /Five quick clinical cases/);
});

test("nextReminderDate picks today or tomorrow in local time", () => {
  const now = new Date(2026, 10, 22, 8, 0, 0);
  const laterToday = nextReminderDate("09:15", now);
  assert.equal(laterToday.getFullYear(), 2026);
  assert.equal(laterToday.getMonth(), 10);
  assert.equal(laterToday.getDate(), 22);
  assert.equal(laterToday.getHours(), 9);
  assert.equal(laterToday.getMinutes(), 15);

  const tomorrow = nextReminderDate("07:00", now);
  assert.equal(tomorrow.getDate(), 23);
  assert.equal(tomorrow.getHours(), 7);
});

test("native detection requires both the bridge and the plugin", () => {
  assert.equal(isNativeNotifications({}), false);
  assert.equal(isNativeNotifications({ Capacitor: { isNativePlatform: () => true } }), false);
  assert.equal(isNativeNotifications({
    Capacitor: { isNativePlatform: () => true, Plugins: { LocalNotifications: {} } }
  }), true);
});

test("requestReminderPermission normalizes the plugin response", async () => {
  assert.equal(await requestReminderPermission(fakePlugin()), "granted");
  assert.equal(await requestReminderPermission(fakePlugin({ permission: "denied" })), "denied");
  assert.equal(await requestReminderPermission(null), "unsupported");
});

test("disabled reminders cancel any existing schedule without prompting", async () => {
  const plugin = fakePlugin();
  const status = await scheduleDailyReminder(profile({ settings: { reminders: false } }), {
    plugin,
    native: true
  });
  assert.equal(status, "disabled");
  assert.deepEqual(plugin.calls.map((call) => call[0]), ["cancel"]);
});

test("unsupported platforms cancel any existing schedule", async () => {
  const plugin = fakePlugin();
  const status = await scheduleDailyReminder(profile(), { plugin, native: false });
  assert.equal(status, "unsupported");
  assert.deepEqual(plugin.calls.map((call) => call[0]), ["cancel"]);
});

test("a denied permission cancels the reminder and never schedules", async () => {
  const plugin = fakePlugin({ permission: "denied" });
  const status = await scheduleDailyReminder(profile(), { plugin, native: true });
  assert.equal(status, "denied");
  assert.deepEqual(plugin.calls.map((call) => call[0]), ["permissions", "cancel"]);
});

test("an enabled reminder is replaced with a fresh daily schedule", async () => {
  const plugin = fakePlugin();
  const now = new Date(2026, 10, 22, 8, 0, 0);
  const status = await scheduleDailyReminder(profile({ streak: 6 }), {
    plugin,
    native: true,
    now,
    dueCount: 1
  });

  assert.equal(status, "scheduled");
  assert.deepEqual(plugin.calls.map((call) => call[0]), ["permissions", "cancel", "schedule"]);
  assert.deepEqual(plugin.calls[0][1], undefined);
  assert.deepEqual(plugin.calls[1][1], { ids: [REMINDER_ID] });

  const scheduled = plugin.calls[2][1].notifications[0];
  assert.equal(scheduled.id, REMINDER_ID);
  assert.equal(scheduled.title, "A missed case is ready");
  assert.equal(scheduled.body, "1 case waiting for review.");
  assert.equal(scheduled.schedule.at.getHours(), 7);
  assert.equal(scheduled.schedule.at.getMinutes(), 30);
  assert.equal(scheduled.schedule.repeats, true);
  assert.equal(scheduled.schedule.every, "day");
});

test("scheduling errors are reported instead of thrown", async () => {
  const status = await scheduleDailyReminder(profile(), {
    plugin: fakePlugin({ scheduleError: true }),
    native: true
  });
  assert.equal(status, "error");
});

test("cancelDailyReminder is safe when the plugin is missing", async () => {
  assert.equal(await cancelDailyReminder(null), false);
});

test("reminder settings have safe defaults and survive storage", () => {
  const restored = readProfile({ getItem: () => null });
  assert.equal(restored.settings.reminders, false);
  assert.equal(restored.settings.music, false);
  assert.equal(restored.settings.musicVolume, 30);
  assert.equal(restored.settings.reminderTime, "09:00");

  const memory = new Map();
  const storage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value)
  };
  const saved = emptyProfile();
  saved.settings = {
    ...saved.settings,
    music: true,
    musicVolume: 22,
    reminders: true,
    reminderTime: "6:05",
    reminderPrompted: true
  };
  writeProfile(storage, saved);
  const roundTripped = readProfile(storage);
  assert.equal(roundTripped.settings.music, true);
  assert.equal(roundTripped.settings.musicVolume, 22);
  assert.equal(roundTripped.settings.reminders, true);
  assert.equal(roundTripped.settings.reminderTime, "06:05");
  assert.equal(roundTripped.settings.reminderPrompted, true);
});
