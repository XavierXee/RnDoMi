import { test } from "node:test";
import assert from "node:assert/strict";
import { createMax } from "./max-sandbox.mjs";

function runSteps(freeze, steps) {
  const max = createMax();
  max.load("src/core/_state.js");
  Object.assign(max.state, { freeze, phraseLength: 4, beatRate: 1, phrase: [null, null, null, null] });
  const main = max.load("src/core/_main.js");
  for (let i = 0; i < steps; i++) main.bang();
  return max.sent.filter((m) => m.receiver === "GENERATE_PHRASE").length;
}

test("a new phrase is generated after the last step", () => {
  assert.equal(runSteps(false, 9), 2);
});

test("freeze keeps looping the current phrase", () => {
  assert.equal(runSteps(true, 9), 0);
});
