import { expect, test } from "@playwright/test";

const PROFILE_KEY = "medmyst.v1";
const SESSION_KEY = "medmyst.session";

async function freshPage(page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator("#screen-home")).toBeVisible();
}

function readProfile(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), PROFILE_KEY);
}

function readSession(page) {
  return page.evaluate((key) => localStorage.getItem(key), SESSION_KEY);
}

// The settings switches are visually hidden, custom-styled checkboxes.
async function setCheckbox(page, id, checked) {
  await page.locator(`#${id}`).evaluate((input, value) => {
    input.checked = value;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, checked);
}

async function playDailyRound(page) {
  for (let index = 0; index < 5; index += 1) {
    await page.locator("#options .option:not(.is-eliminated)").first().click();
    await expect(page.locator("#next-btn")).toBeVisible();
    await page.locator("#next-btn").click();
  }
  await expect(page.locator("#screen-result")).toBeVisible();
}

async function answerCurrentQuestion(page, correct) {
  const clicked = await page.evaluate(async (wantCorrect) => {
    const { questions } = await import("/src/data/questions.js");
    const prompt = document.getElementById("question-text").textContent;
    const question = questions.find((item) => item.question === prompt);
    if (!question) return false;

    const buttons = [...document.querySelectorAll("#options .option:not(.is-eliminated)")];
    const target = wantCorrect
      ? buttons.find((button) => button.dataset.option === question.answer)
      : buttons.find((button) => button.dataset.option !== question.answer);
    if (!target) return false;
    target.click();
    return true;
  }, correct);
  expect(clicked).toBe(true);
}

// Word Hunt is played by tracing each target word through the letter grid.
// The geometry here mirrors the validated grid builder used by the app.
async function solveHuntCases(page) {
  for (let caseIndex = 0; caseIndex < 6; caseIndex += 1) {
    if (await page.locator("#screen-result").isVisible()) break;

    for (let attempt = 0; attempt < 14; attempt += 1) {
      if (await page.locator("#hunt-next").isVisible()) break;

      const found = await page.evaluate(() => {
        const words = [...document.querySelectorAll("#hunt-bank li")].filter(
          (item) => item.className === ""
        );
        if (words.length === 0) return false;

        const grid = new Map();
        let size = 0;
        document.querySelectorAll("#hunt-grid .hunt-cell").forEach((cell) => {
          const row = Number(cell.dataset.row);
          const col = Number(cell.dataset.col);
          grid.set(`${row},${col}`, cell);
          size = Math.max(size, row + 1, col + 1);
        });

        const directions = [
          [0, 1], [1, 0], [1, 1], [1, -1],
          [0, -1], [-1, 0], [-1, -1], [-1, 1]
        ];
        const word = words[0].dataset.word;
        for (let row = 0; row < size; row += 1) {
          for (let col = 0; col < size; col += 1) {
            for (const [dr, dc] of directions) {
              const endRow = row + dr * (word.length - 1);
              const endCol = col + dc * (word.length - 1);
              if (endRow < 0 || endCol < 0 || endRow >= size || endCol >= size) continue;

              const letters = [];
              for (let i = 0; i < word.length; i += 1) {
                letters.push(grid.get(`${row + dr * i},${col + dc * i}`)?.textContent ?? "?");
              }
              if (letters.join("") !== word) continue;

              grid.get(`${row},${col}`).click();
              grid.get(`${endRow},${endCol}`).click();
              return true;
            }
          }
        }
        return false;
      });

      if (!found) break;
      await page.waitForTimeout(60);
    }

    if (!(await page.locator("#hunt-next").isVisible())) break;
    await page.locator("#hunt-next").click();
    await page.waitForTimeout(100);
  }
}

test("the update banner exists but stays hidden on a fresh load", async ({ page }) => {
  await freshPage(page);
  await expect(page.locator("#update-banner")).toBeHidden();
  await expect(page.locator("#update-reload")).toBeAttached();
  await expect(page.locator("#update-dismiss")).toBeAttached();
});

test("the update banner shows and dismisses against the real DOM", async ({ page }) => {
  await freshPage(page);
  const result = await page.evaluate(async () => {
    const { setupUpdateBanner } = await import("/src/core/update.js");
    const listeners = {};
    const serviceWorker = {
      controller: {},
      addEventListener(type, fn) {
        (listeners[type] ??= []).push(fn);
      }
    };
    const banner = document.getElementById("update-banner");
    let reloaded = false;
    setupUpdateBanner({
      serviceWorker,
      banner,
      reloadButton: document.getElementById("update-reload"),
      dismissButton: document.getElementById("update-dismiss"),
      register: () => Promise.resolve(null),
      reload: () => {
        reloaded = true;
      }
    });
    (listeners.controllerchange ?? []).forEach((fn) => fn({}));
    const shown = !banner.hidden;
    document.getElementById("update-dismiss").click();
    return { shown, hiddenAfterDismiss: banner.hidden, reloaded };
  });
  expect(result).toEqual({ shown: true, hiddenAfterDismiss: true, reloaded: false });
});

test("Missed Cases explains itself when the queue is empty", async ({ page }) => {
  await freshPage(page);
  await expect(page.locator("#missed-meta")).toHaveText("No cases saved yet");
  await expect(page.locator("#missed-count")).toBeHidden();

  await page.locator("#missed-btn").click();
  await expect(page.locator("#screen-home")).toBeVisible();
  await expect(page.locator("#toasts")).toContainText("All caught up");
});

test("a missed case follows the 1/3/7 review schedule until mastered", async ({ page }) => {
  await freshPage(page);
  await page.locator("#start-btn").click();
  await expect(page.locator("#screen-play")).toBeVisible();

  await answerCurrentQuestion(page, false);
  await page.locator("#next-btn").click();
  for (let index = 0; index < 4; index += 1) {
    await answerCurrentQuestion(page, true);
    await page.locator("#next-btn").click();
  }
  await expect(page.locator("#screen-result")).toBeVisible();

  const today = await page.evaluate(async () => (await import("/src/core/scheduler.js")).dayKey());
  const dayIn = (offset) => page.evaluate(async ({ day, amount }) => (
    await import("/src/core/scheduler.js")
  ).shiftDayKey(day, amount), { day: today, amount: offset });

  let saved = await readProfile(page);
  const missedIds = Object.keys(saved.missed.cases);
  expect(missedIds).toHaveLength(1);
  const missedId = missedIds[0];
  expect(saved.missed.cases[missedId].due).toBe(await dayIn(1));

  // Force each scheduled date to "today" so the whole ladder can be tested.
  async function reviewDueCase() {
    await page.evaluate(({ key, id, day }) => {
      const profile = JSON.parse(localStorage.getItem(key));
      profile.missed.cases[id].due = day;
      localStorage.setItem(key, JSON.stringify(profile));
    }, { key: PROFILE_KEY, id: missedId, day: today });

    await page.reload();
    await expect(page.locator("#missed-meta")).toHaveText("1 case due now");
    await expect(page.locator("#missed-count")).toHaveText("1");
    await page.locator("#missed-btn").click();
    await expect(page.locator("#screen-play")).toBeVisible();
    await expect(page.locator("#mode-chip")).toHaveText("Missed Cases");

    await answerCurrentQuestion(page, true);
    await expect(page.locator("#next-btn")).toHaveText("Results");
    await page.locator("#next-btn").click();
    await expect(page.locator("#result-eyebrow")).toHaveText("Missed Cases");
    await expect(page.locator("#result-streak")).toContainText("Reviews do not change your streak");
  }

  await reviewDueCase();
  saved = await readProfile(page);
  expect(saved.missed.cases[missedId].stage).toBe(1);
  expect(saved.missed.cases[missedId].due).toBe(await dayIn(3));
  expect(saved.missed.reviews).toBe(1);
  expect(saved.missed.recovered).toBe(0);

  await reviewDueCase();
  saved = await readProfile(page);
  expect(saved.missed.cases[missedId].stage).toBe(2);
  expect(saved.missed.cases[missedId].due).toBe(await dayIn(7));
  expect(saved.missed.reviews).toBe(2);

  await reviewDueCase();
  saved = await readProfile(page);
  expect(saved.missed.cases[missedId]).toBeUndefined();
  expect(saved.missed.mistakes).toBe(1);
  expect(saved.missed.reviews).toBe(3);
  expect(saved.missed.recovered).toBe(1);
  expect(saved.stats.leaderboards.missed).toHaveLength(3);
}, { timeout: 60_000 });

test("a daily round records the profile and reaches the result screen", async ({ page }) => {
  await freshPage(page);
  await page.locator("#start-btn").click();
  await expect(page.locator("#screen-play")).toBeVisible();
  await expect(page.locator("#mode-chip")).toBeHidden();

  await playDailyRound(page);
  await expect(page.locator("#result-score")).toHaveText(/^\d\/5$/);

  const saved = await readProfile(page);
  expect(Object.keys(saved.history)).toHaveLength(1);
  expect(saved.stats.rounds).toBe(1);
  expect(saved.stats.leaderboards.daily).toHaveLength(1);
});

test("quitting Word Hunt clears the resumable session", async ({ page }) => {
  await freshPage(page);
  await page.locator("#hunt-btn").click();
  await expect(page.locator("#screen-hunt")).toBeVisible();
  expect(await readSession(page)).not.toBeNull();

  await page.locator("#hunt-quit").click();
  await expect(page.locator("#screen-home")).toBeVisible();
  expect(await readSession(page)).toBeNull();

  await page.reload();
  await expect(page.locator("#screen-home")).toBeVisible();
  await expect(page.locator("#screen-hunt")).toBeHidden();
});

test("quitting Time Attack stops the timer and records nothing", async ({ page }) => {
  await freshPage(page);
  await page.locator("#time-attack-btn").click();
  await expect(page.locator("#screen-time-attack")).toBeVisible();

  const before = await readProfile(page);
  await page.locator("#attack-quit").click();
  await expect(page.locator("#screen-home")).toBeVisible();
  expect(await readProfile(page)).toEqual(before);

  // Outlive a timer tick: the interval must have been cleared on quit.
  await page.waitForTimeout(1_200);
  await expect(page.locator("#screen-result")).toBeHidden();
  await expect(page.locator("#screen-home")).toBeVisible();
});

test("a finished Time Attack is recorded exactly once", async ({ page }) => {
  await freshPage(page);
  const before = await readProfile(page);
  await page.locator("#time-attack-btn").click();
  await expect(page.locator("#screen-time-attack")).toBeVisible();

  let clicks = 0;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await page.locator("#screen-result").isVisible()) break;
    const clicked = await page.evaluate(async () => {
      const { questions } = await import("/src/data/questions.js");
      const prompt = document.getElementById("attack-question").textContent;
      const answer = questions.find((item) => item.question === prompt)?.answer;
      const wrong = [...document.querySelectorAll("#attack-options button")].find(
        (button) => button.textContent !== answer
      );
      if (!wrong) return false;
      wrong.click();
      return true;
    });
    if (!clicked) break;
    clicks += 1;
    await page.waitForTimeout(40);
  }

  await expect(page.locator("#screen-result")).toBeVisible();
  await expect(page.locator("#attack-timer")).toHaveText(/^\d+$/);
  expect(clicks).toBeGreaterThan(0);

  const saved = await readProfile(page);
  expect(saved.stats.leaderboards.attack).toHaveLength(1);
  expect(saved.stats.rounds).toBe((before?.stats?.rounds ?? 0) + 1);
  expect(saved.stats.answered).toBe((before?.stats?.answered ?? 0) + clicks);

  // The timer was cleared, so waiting cannot award a second result.
  await page.waitForTimeout(1_200);
  expect((await readProfile(page)).stats.rounds).toBe(saved.stats.rounds);
});

test("audio and haptic settings survive a reload", async ({ page }) => {
  await freshPage(page);
  await page.locator("#settings-btn").click();
  await expect(page.locator("#screen-settings")).toBeVisible();
  await setCheckbox(page, "ambience-toggle", true);
  await setCheckbox(page, "music-toggle", true);
  await page.locator("#vol-success").evaluate((input) => {
    input.value = "80";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.locator("#vol-music").evaluate((input) => {
    input.value = "25";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.locator("#haptic-strength").selectOption("light");

  const saved = await readProfile(page);
  expect(saved.settings.ambience).toBe(true);
  expect(saved.settings.music).toBe(true);
  expect(saved.settings.volSuccess).toBe(80);
  expect(saved.settings.musicVolume).toBe(25);
  expect(saved.settings.haptics).toBe("light");

  await page.reload();
  await page.locator("#settings-btn").click();
  await expect(page.locator("#ambience-toggle")).toBeChecked();
  await expect(page.locator("#music-toggle")).toBeChecked();
  await expect(page.locator("#vol-success")).toHaveValue("80");
  await expect(page.locator("#vol-music")).toHaveValue("25");
  await expect(page.locator("#haptic-strength")).toHaveValue("light");
});

test("blocked autoplay retries on the first tap when music is enabled", async ({ page }) => {
  await page.addInitScript(() => {
    window.__musicAttempts = [];
    window.__autoplayBlocked = true;
    const originalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...args) {
      if (!this.src.includes("music-synthwave.mp3")) return originalPlay.apply(this, args);
      if (window.__autoplayBlocked) {
        window.__musicAttempts.push("blocked");
        return Promise.reject(Object.assign(new Error("blocked"), { name: "NotAllowedError" }));
      }
      const result = originalPlay.apply(this, args);
      result?.then(
        () => window.__musicAttempts.push("ok"),
        () => window.__musicAttempts.push("failed")
      );
      return result;
    };
    document.addEventListener("pointerdown", () => { window.__autoplayBlocked = false; }, true);
  });

  await freshPage(page);
  await page.locator("#settings-btn").click();
  await setCheckbox(page, "music-toggle", true);
  await page.reload();

  await expect.poll(() => page.evaluate(() => window.__musicAttempts)).toContain("blocked");
  await page.locator("#start-btn").click();
  await expect.poll(() => page.evaluate(() => window.__musicAttempts)).toContain("ok");
  expect((await readProfile(page)).settings.music).toBe(true);
});

test("reminders stay opt-in and explain web limitations", async ({ page }) => {
  await freshPage(page);
  await expect(page.locator("#reminder-prompt")).toBeHidden();

  await page.locator("#settings-btn").click();
  await expect(page.locator("#reminders-toggle")).not.toBeChecked();
  await expect(page.locator("#reminder-status")).toContainText("installed app");

  await setCheckbox(page, "reminders-toggle", true);
  await page.locator("#reminder-time").fill("07:15");
  await page.locator("#reminder-time").dispatchEvent("change");
  await expect.poll(async () => (await readProfile(page)).settings.reminders).toBe(true);
  expect((await readProfile(page)).settings.reminderTime).toBe("07:15");

  await page.reload();
  await expect(page.locator("#reminder-prompt")).toBeHidden();
});

test("screenshot mode survives a reload", async ({ page }) => {
  await freshPage(page);
  await page.locator("#settings-btn").click();
  await setCheckbox(page, "screenshot-mode", true);
  await page.reload();
  await expect(page.locator("body")).toHaveClass(/screenshot-mode/);
  expect((await readProfile(page)).settings.screenshotMode).toBe(true);
});

test("a finished Word Hunt is only recorded once", async ({ page }) => {
  await freshPage(page);
  await page.locator("#hunt-btn").click();
  await expect(page.locator("#screen-hunt")).toBeVisible();
  await solveHuntCases(page);
  await expect(page.locator("#screen-result")).toBeVisible();

  const saved = await readProfile(page);
  expect(saved.hunt.rounds).toBe(1);
  expect(saved.stats.leaderboards.hunt).toHaveLength(1);

  // Hammer the hidden Next button: the completion guard must reject repeats.
  await page.evaluate(() => {
    const next = document.getElementById("hunt-next");
    for (let i = 0; i < 5; i += 1) next.click();
  });
  await page.waitForTimeout(100);
  expect((await readProfile(page)).hunt.rounds).toBe(1);
});
