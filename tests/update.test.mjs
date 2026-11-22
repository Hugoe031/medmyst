import assert from "node:assert/strict";
import test from "node:test";
import { setupUpdateBanner } from "../src/core/update.js";

function emitter(extra = {}) {
  const listeners = new Map();
  return {
    ...extra,
    addEventListener(type, fn) {
      listeners.set(type, [...(listeners.get(type) ?? []), fn]);
    },
    emit(type) {
      (listeners.get(type) ?? []).forEach((fn) => fn({}));
    }
  };
}

function harness({ controlled = true, registration = undefined, registerError = false } = {}) {
  const serviceWorker = emitter({ controller: controlled ? {} : null });
  const banner = { hidden: true };
  const reloadButton = emitter();
  const dismissButton = emitter();
  let reloads = 0;

  setupUpdateBanner({
    serviceWorker,
    banner,
    reloadButton,
    dismissButton,
    register: registerError
      ? () => Promise.reject(new Error("offline"))
      : () => Promise.resolve(registration),
    reload: () => {
      reloads += 1;
    }
  });

  return { serviceWorker, banner, reloadButton, dismissButton, get reloads() { return reloads; } };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test("first load does not show the update banner", async () => {
  const worker = emitter({ state: "installing" });
  const h = harness({
    controlled: false,
    registration: emitter({ installing: worker, active: {} })
  });
  await settle();

  worker.state = "installed";
  worker.emit("statechange");
  assert.equal(h.banner.hidden, true);
});

test("an installing worker shows the banner once it reaches installed", async () => {
  const worker = emitter({ state: "installing" });
  const h = harness({
    registration: emitter({ installing: worker, active: {} })
  });
  await settle();

  worker.state = "installed";
  worker.emit("statechange");
  assert.equal(h.banner.hidden, false);

  // Repeat notifications must not stack.
  worker.emit("statechange");
  h.serviceWorker.emit("controllerchange");
  assert.equal(h.banner.hidden, false);
});

test("controllerchange prompts when the page was already controlled", async () => {
  const h = harness({ registration: emitter({ active: {} }) });
  await settle();
  h.serviceWorker.emit("controllerchange");
  assert.equal(h.banner.hidden, false);
});

test("a replaced active worker prompts without updatefound", async () => {
  const oldController = {};
  const serviceWorker = emitter({ controller: oldController });
  const banner = { hidden: true };
  setupUpdateBanner({
    serviceWorker,
    banner,
    register: () => Promise.resolve(emitter({ active: {}, installing: null })),
    reload: () => {}
  });
  await settle();
  assert.equal(banner.hidden, false);
});

test("reload and dismiss hide the banner; reload calls the callback", async () => {
  const h = harness({ registration: emitter({ active: {} }) });
  await settle();
  h.serviceWorker.emit("controllerchange");
  assert.equal(h.banner.hidden, false);

  h.dismissButton.emit("click");
  assert.equal(h.banner.hidden, true);
  assert.equal(h.reloads, 0);

  h.serviceWorker.emit("controllerchange");
  h.reloadButton.emit("click");
  assert.equal(h.banner.hidden, true);
  assert.equal(h.reloads, 1);
});

test("a failed registration is swallowed", async () => {
  const h = harness({ registerError: true });
  await settle();
  h.serviceWorker.emit("controllerchange");
  assert.equal(h.banner.hidden, false);
});
