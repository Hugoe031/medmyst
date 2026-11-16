import { hasNativeRewarded, showNativeRewarded } from "./core/rewarded.js";

const FALLBACK_SECONDS = 5;

export function adsAvailable() {
  return hasNativeRewarded();
}

export async function requestRewardedHint() {
  if (hasNativeRewarded()) {
    return showNativeRewarded();
  }
  return showFallbackAd();
}

function showFallbackAd() {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "ad-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Rewarded hint");

    const card = document.createElement("div");
    card.className = "ad-card";

    const badge = document.createElement("span");
    badge.className = "ad-badge";
    badge.textContent = "Ad placeholder";

    const title = document.createElement("h2");
    title.textContent = "Watch to earn a hint";

    const copy = document.createElement("p");
    copy.className = "ad-copy";
    copy.textContent =
      "The Android build plays a rewarded AdMob video here. This preview uses a short timer instead.";

    const countdown = document.createElement("p");
    countdown.className = "ad-countdown";

    const close = document.createElement("button");
    close.type = "button";
    close.className = "btn btn-ghost";
    close.textContent = "Close";

    let remaining = FALLBACK_SECONDS;
    const paint = () => {
      countdown.textContent = `Hint unlocks in ${remaining}s`;
    };
    paint();

    const finish = (earned) => {
      clearInterval(timer);
      overlay.remove();
      document.removeEventListener("keydown", onKey);
      resolve(earned);
    };

    const timer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        finish(true);
        return;
      }
      paint();
    }, 1000);

    const onKey = (event) => {
      if (event.key === "Escape") {
        finish(false);
      }
    };

    close.addEventListener("click", () => finish(false));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        finish(false);
      }
    });
    document.addEventListener("keydown", onKey);

    card.append(badge, title, copy, countdown, close);
    overlay.append(card);
    document.body.append(overlay);
    close.focus();
  });
}
