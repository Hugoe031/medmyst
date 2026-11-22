// Watches the service worker lifecycle and drives the "new version" banner.
// Kept free of app globals so the lifecycle can be unit tested with fakes.

export function setupUpdateBanner({
  serviceWorker,
  banner,
  reloadButton,
  dismissButton,
  register,
  reload = () => globalThis.location.reload()
}) {
  if (!serviceWorker || !banner || !register) return;

  // Only prompt when this page had a controller before: a first-ever load is
  // not an update, even though claim() will fire controllerchange.
  const hadController = Boolean(serviceWorker.controller);
  let notified = false;
  let refreshing = false;

  const show = () => {
    if (notified || !hadController) return;
    notified = true;
    banner.hidden = false;
  };

  serviceWorker.addEventListener?.("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    show();
  });

  reloadButton?.addEventListener?.("click", () => {
    banner.hidden = true;
    reload();
  });
  dismissButton?.addEventListener?.("click", () => {
    banner.hidden = true;
  });

  Promise.resolve()
    .then(register)
    .then((registration) => {
      if (!registration) return;
      registration.addEventListener?.("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener?.("statechange", () => {
          if (worker.state === "installed") show();
        });
      });
      // The worker may have been replaced between page load and registration.
      if (registration.active && hadController && registration.active !== serviceWorker.controller) {
        show();
      }
    })
    .catch(() => {});
}
