import { test } from "node:test";
import assert from "node:assert/strict";
import { createMax } from "./max-sandbox.mjs";

function setup() {
  const max = createMax();
  const stateScript = max.load("src/core/_state.js");
  return { max, stateScript, state: max.state };
}

test("setParam updates state and notifies", () => {
  const { max, stateScript, state } = setup();
  stateScript.setParam("velocityMax", 100);
  assert.equal(state.velocityMax, 100);
  assert.deepEqual(max.sent.at(-1), { receiver: "STATE_CHANGED", args: ["onStateChanged", "velocityMax"] });
});

test("setParam ignores unknown keys", () => {
  const { stateScript, state } = setup();
  stateScript.setParam("nope", 1);
  assert.equal(state.nope, undefined);
});

test("scaleName accepts a menu index or a name", () => {
  const { stateScript, state } = setup();
  stateScript.setParam("scaleName", 0);
  assert.equal(state.scaleName, "major");
  stateScript.setParam("scaleName", "dorian");
  assert.equal(state.scaleName, "dorian");
  stateScript.setParam("scaleName", "unknown");
  assert.equal(state.scaleName, "dorian");
});

test("freeze is coerced to boolean", () => {
  const { stateScript, state } = setup();
  stateScript.setParam("freeze", 1);
  assert.equal(state.freeze, true);
});

test("changing phraseLength forces a new rhythm", () => {
  const max = createMax();
  const stateScript = max.load("src/core/_state.js");
  const gen = max.load("src/core/_generatePhrase.js");
  gen.generatePhrase();
  stateScript.setParam("phraseLength", 8);
  gen.generatePhrase();
  assert.equal(max.state.phrase.length, 8);
});

test("custom is selectable from the scale menu", () => {
  const max = createMax();
  const stateScript = max.load("src/core/_state.js");
  const index = Object.keys(max.state.noteLists).indexOf("custom");
  assert.equal(index, Object.keys(max.state.noteLists).length - 1);
  stateScript.setParam("scaleName", index);
  assert.equal(max.state.scaleName, "custom");
});
