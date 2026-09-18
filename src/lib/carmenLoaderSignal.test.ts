import assert from "node:assert/strict";
import test from "node:test";
import {
  __resetCarmenLoaderSignalForTests,
  cancelCarmenFadeOutGhosts,
  carmenSceneJustEnded,
  getCarmenLoaderSnapshot,
  registerCarmenFadeOutCanceler,
  registerCarmenScene,
  registerCarmenWait,
  shouldFadeRouteContent,
  wouldLegacyEagerSpawnGhost,
} from "./carmenLoaderSignal.ts";

test.beforeEach(() => {
  __resetCarmenLoaderSignalForTests();
});

test.afterEach(() => {
  __resetCarmenLoaderSignalForTests();
});

/**
 * Reproduce Suspense fallback → page CarmenLoadingScreen hand-off.
 * Pre-fix: ghost stays while the continued scene mounts (jump/flicker).
 * Post-fix: registering the page scene cancels the ghost.
 */
test("scene hand-off cancels the fade-out ghost", () => {
  const releaseSuspense = registerCarmenScene();
  let ghostAlive = true;
  registerCarmenFadeOutCanceler(() => {
    ghostAlive = false;
  });

  releaseSuspense();
  // Pre-fix eager path would spawn here (idle snapshot during the gap).
  assert.equal(wouldLegacyEagerSpawnGhost(), true);
  assert.equal(ghostAlive, true);
  assert.equal(carmenSceneJustEnded(), true);

  const releasePage = registerCarmenScene();
  assert.equal(ghostAlive, false);
  assert.equal(getCarmenLoaderSnapshot().scenes, 1);
  releasePage();
});

test("scene→content dissolve keeps the ghost (nothing cancels it)", () => {
  const release = registerCarmenScene();
  let ghostAlive = true;
  registerCarmenFadeOutCanceler(() => {
    ghostAlive = false;
  });
  release();
  assert.equal(ghostAlive, true);
  assert.equal(cancelCarmenFadeOutGhosts(), 1);
  assert.equal(ghostAlive, false);
});

test("wait registration also cancels a pending ghost", () => {
  const release = registerCarmenScene();
  let ghostAlive = true;
  registerCarmenFadeOutCanceler(() => {
    ghostAlive = false;
  });
  release();
  const wait = registerCarmenWait();
  assert.equal(ghostAlive, false);
  wait();
});

test("content fade must not run while Carmen is covering the route", () => {
  assert.equal(shouldFadeRouteContent(), true);

  const wait = registerCarmenWait();
  assert.equal(shouldFadeRouteContent(), false);
  wait();

  const scene = registerCarmenScene();
  assert.equal(shouldFadeRouteContent(), false);
  scene();
  assert.equal(shouldFadeRouteContent(), true);
});

test("continued hand-off window stays open after a scene ends", () => {
  const release = registerCarmenScene();
  release();
  assert.equal(carmenSceneJustEnded(), true);
  assert.equal(carmenSceneJustEnded(0), false);
});

test("wait then scene escalation keeps a single loading moment", () => {
  const releaseWait = registerCarmenWait();
  assert.deepEqual(getCarmenLoaderSnapshot(), { waiting: 1, scenes: 0 });
  releaseWait();
  const releaseScene = registerCarmenScene();
  assert.deepEqual(getCarmenLoaderSnapshot(), { waiting: 0, scenes: 1 });
  releaseScene();
  assert.deepEqual(getCarmenLoaderSnapshot(), { waiting: 0, scenes: 0 });
});
