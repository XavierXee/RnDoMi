import { test } from "node:test";
import assert from "node:assert/strict";
import { createMax } from "./max-sandbox.mjs";

const note = (extra = {}) => ({ relativePitch: 0, pitch: 60, velocity: 100, duration: 100, ...extra });

function setup(overrides = {}) {
  const max = createMax();
  max.load("src/core/_state.js");
  Object.assign(max.state, { phraseLength: 4, phrase: [note(), null, note(), null] }, overrides);
  const cc = max.load("src/core/_cc.js");
  const out = () => max.sent.filter((m) => m.receiver === "CC_OUT").map((m) => m.args);
  return { max, cc, state: max.state, out };
}

function play(cc, state, steps) {
  for (let i = 0; i < steps; i++) {
    const step = i % state.phraseLength;
    cc.onStep(step, state.phrase[step] ? 1 : 0);
  }
}

test("every slot is off by default, so nothing is sent", () => {
  const { cc, state, out } = setup();
  play(cc, state, 8);
  assert.equal(out().length, 0);
});

test("default CC numbers are distinct and start at 20", () => {
  const { state } = setup();
  const numbers = [1, 2, 3, 4].flatMap((n) => [state[`env${n}Cc`], state[`rndCc${n}Number`]]);
  assert.equal(new Set(numbers).size, 8);
  assert.equal(Math.min(...numbers), 20);
});

test("envelope shapes complete one cycle over the phrase", () => {
  const { cc } = setup();
  const sample = (shape) => [0, 0.25, 0.5, 0.75].map((p) => cc.shapeValue(shape, p));
  assert.deepEqual(sample(1), [0, 0.5, 1, 0.5]);
  assert.deepEqual(sample(2), [0, 0.25, 0.5, 0.75]);
  assert.deepEqual(sample(3), [1, 0.75, 0.5, 0.25]);
  assert.deepEqual(sample(4), [1, 1, 0, 0]);
  assert.ok(Math.abs(cc.shapeValue(0, 0.25) - 1) < 1e-9);
});

test("an envelope sends a control change on every step, scaled to its range", () => {
  const { cc, state, out } = setup({ env1On: true, env1Shape: 2, env1Cc: 74, env1Min: 10, env1Max: 50 });
  play(cc, state, 4);
  assert.deepEqual(out(), [[0xb0, 74, 10], [0xb0, 74, 20], [0xb0, 74, 30], [0xb0, 74, 40]]);
});

test("unchanged envelope values are not resent within a cycle", () => {
  const { cc, state, out } = setup({ env1On: true, env1Shape: 4 });
  play(cc, state, 4);
  assert.deepEqual(out().map((a) => a[2]), [127, 1]);
  play(cc, state, 1);
  assert.equal(out().length, 3);
});

test("random CCs are sent only on played notes, within range", () => {
  const { cc, state, out } = setup({ rndCc2On: true, rndCc2Number: 30, rndCc2Min: 40, rndCc2Max: 60 });
  cc.onStep(0, 1);
  cc.onStep(1, 0);
  cc.onStep(2, 0);
  assert.equal(out().length, 1);
  const [status, number, value] = out()[0];
  assert.equal(status, 0xb0);
  assert.equal(number, 30);
  assert.ok(value >= 40 && value <= 60);
});

test("a frozen phrase repeats the same random values", () => {
  const { cc, state, out } = setup({ rndCc1On: true });
  play(cc, state, 8);
  const values = out().map((a) => a[2]);
  assert.deepEqual(values.slice(0, 2), values.slice(2, 4));
});

test("random values follow range changes without being re-rolled", () => {
  const { cc, state, out } = setup({ rndCc1On: true, phrase: [note({ ccRandom: [0.5, 0, 0, 0] })] , phraseLength: 1 });
  cc.onStep(0, 1);
  state.rndCc1Max = 1;
  cc.onStep(0, 1);
  assert.deepEqual(out().map((a) => a[2]), [64, 1]);
});

test("generated notes carry their random CC values", () => {
  const max = createMax();
  max.load("src/core/_state.js");
  const gen = max.load("src/core/_generatePhrase.js");
  gen.generatePhrase();
  const notes = max.state.phrase.filter(Boolean);
  assert.ok(notes.length > 0);
  for (const n of notes) assert.equal(n.ccRandom.length, 4);
});

test("each master switch silences its own slots", () => {
  const envOff = setup({ envOn: false, env1On: true, rndCc1On: true });
  play(envOff.cc, envOff.state, 4);
  assert.ok(envOff.out().length > 0);
  assert.ok(envOff.out().every((a) => a[1] === envOff.state.rndCc1Number));
  const rndOff = setup({ rndCcOn: false, env1On: true, rndCc1On: true });
  play(rndOff.cc, rndOff.state, 4);
  assert.ok(rndOff.out().every((a) => a[1] === rndOff.state.env1Cc));
});

test("new shapes reverse, curve and stay within 0-1", () => {
  const { cc, state } = setup();
  const index = (name) => state.envelopeShapes.indexOf(name);
  assert.deepEqual([0, 0.25, 0.5, 0.75].map((p) => cc.shapeValue(index("reverseSquare"), p)), [0, 0, 1, 1]);
  assert.ok(Math.abs(cc.shapeValue(index("reverseSine"), 0.25)) < 1e-9);
  for (const name of ["logUp", "expUp"]) {
    assert.ok(Math.abs(cc.shapeValue(index(name), 0)) < 1e-9, name);
    assert.ok(Math.abs(cc.shapeValue(index(name), 1) - 1) < 1e-9, name);
  }
  assert.ok(cc.shapeValue(index("logUp"), 0.25) > 0.25);
  assert.ok(cc.shapeValue(index("expUp"), 0.25) < 0.25);
  assert.ok(Math.abs(cc.shapeValue(index("logDown"), 0.25) - cc.shapeValue(index("logUp"), 0.75)) < 1e-9);
  assert.ok(Math.abs(cc.shapeValue(index("expDown"), 0) - 1) < 1e-9);
  for (let i = 0; i < state.envelopeShapes.length; i++) {
    for (let p = 0; p < 1; p += 0.05) {
      const v = cc.shapeValue(i, p);
      assert.ok(v >= -1e-9 && v <= 1 + 1e-9, `${state.envelopeShapes[i]} at ${p}`);
    }
  }
});

test("the main loop asks for CCs before playing the note", () => {
  const max = createMax();
  max.load("src/core/_state.js");
  Object.assign(max.state, { phraseLength: 2, beatRate: 1, phrase: [note(), null] });
  const main = max.load("src/core/_main.js");
  main.bang();
  main.bang();
  const order = max.sent.map((m) => m.receiver).filter((r) => r === "CC_STEP" || r === "PLAY_NOTE");
  assert.deepEqual(order, ["CC_STEP", "PLAY_NOTE", "CC_STEP"]);
  const steps = max.sent.filter((m) => m.receiver === "CC_STEP").map((m) => m.args.slice(1));
  assert.deepEqual(steps, [[0, 1], [1, 0]]);
});

test("a played note with random slots on signals that random CCs were sent", () => {
  const { cc, max } = setup({ rndCc1On: true });
  const signals = () => max.sent.filter((m) => m.receiver === "RANDOM_CC_SENT").length;
  cc.onStep(0, 1);
  assert.equal(signals(), 1);
  cc.onStep(1, 0);
  assert.equal(signals(), 1);
});

test("no signal when every random slot is off", () => {
  const { cc, max } = setup({ env1On: true });
  cc.onStep(0, 1);
  assert.equal(max.sent.filter((m) => m.receiver === "RANDOM_CC_SENT").length, 0);
});
