export const REWARDED_PROD_UNIT = "ca-app-pub-9621993493673737/3973696068";

// Google's always-valid test unit. AdMob rejects a production unit ID in a
// debug build ("Publisher misconfiguration"), which currently breaks every
// rewarded hint. Use TEST_UNIT in debug builds and switch to
// REWARDED_PROD_UNIT only after the app is live in the store.
export const REWARDED_TEST_UNIT = "ca-app-pub-3940256099942544/6300978116";

export async function initializeAdMob() {
  const ads = globalThis.Capacitor?.Plugins?.AdMob;
  if (!ads) return;

  try {
    await ads.initialize();

    // Request Consent (UMP)
    let consentInfo = await ads.requestConsentInfo();
    if (consentInfo.isConsentFormAvailable && consentInfo.status === "REQUIRED") {
      await ads.showConsentForm();
    }

    // iOS Tracking Authorization
    if (typeof ads.trackingAuthorizationStatus === 'function') {
      const trackingInfo = await ads.trackingAuthorizationStatus();
      if (trackingInfo.status === 'notDetermined' && typeof ads.requestTrackingAuthorization === 'function') {
        await ads.requestTrackingAuthorization();
      }
    }
  } catch (e) {
    // Don't crash the app; rewarded hints fall back to the offline placeholder.
    console.error("AdMob Init Failed", e);
  }
}

export async function showPrivacyOptions() {
  const ads = globalThis.Capacitor?.Plugins?.AdMob;
  if (!ads || typeof ads.showPrivacyOptionsForm !== "function") {
    return false;
  }
  try {
    await ads.showPrivacyOptionsForm();
    return true;
  } catch {
    return false;
  }
}

export function hasNativeRewarded() {
  const ads = globalThis.Capacitor?.Plugins?.AdMob;
  return Boolean(ads && typeof ads.showRewardVideoAd === "function");
}

export function nativeAds() {
  return globalThis.Capacitor?.Plugins?.AdMob ?? null;
}

export async function showNativeRewarded(adId = REWARDED_PROD_UNIT) {
  const ads = globalThis.Capacitor?.Plugins?.AdMob;
  if (!ads) return false;
  
  try {
    await ads.prepareRewardVideoAd({ adId });
    const result = await ads.showRewardVideoAd();
    const type = result?.type ?? result?.reward?.type;
    return type === "rewarded" || type === "reward";
  } catch {
    return false;
  }
}
