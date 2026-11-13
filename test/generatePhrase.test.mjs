import { test } from "node:test";
import assert from "node:assert/strict";
import { createMax } from "./max-sandbox.mjs";

function setup(overrides = {}, seed = 1) {
  const max = createMax({ seed });
  max.load("src/core/_state.js");
  Object.assign(max.state, overrides);
  const gen = max.load("src/core/_generatePhrase.js");
  return { max, gen, state: max.state };
}

test("phrase has one slot per step", () => {
  const { gen, state } = setup({ phraseLength: 16 });
  gen.generatePhrase();
  assert.equal(state.phrase.length, 16);
});

test("notes stay inside scale, root and octave range", () => {
  const { gen, state } = setup({ root: 60, scaleName: "major", octaveMin: -1, octavesMax: 1, chance: 1 });
  gen.generatePhrase();
  const scale = state.noteLists.major;
  for (const note of state.phrase) {
    assert.ok(scale.includes(note.relativePitch));
    const octave = (note.pitch - 60 - note.relativePitch) / 12;
    assert.ok(Number.isInteger(octave) && octave >= -1 && octave <= 1, `pitch ${note.pitch}`);
  }
});

test("velocity and duration stay inside their ranges", () => {
  const { gen, state } = setup({ velocityMin: 40, velocityMax: 90, durationMin: 100, durationMax: 200, chance: 1 });
  gen.generatePhrase();
  for (const note of state.phrase) {
    assert.ok(note.velocity >= 40 && note.velocity <= 90);
    assert.ok(note.duration >= 100 && note.duration <= 200);
  }
});

test("chance 1 fills every step", () => {
  const { gen, state } = setup({ chance: 1 });
  gen.generatePhrase();
  assert.ok(state.phrase.every(Boolean));
});

test("rhythm is kept across phrases while freezeRhythm is on", () => {
  const { gen, state } = setup({ freezeRhythm: true });
  gen.generatePhrase();
  const rhythm = state.rhythm;
  gen.generatePhrase();
  assert.equal(state.rhythm, rhythm);
});

test("same seed gives the same phrase", () => {
  const a = setup({}, 42);
  const b = setup({}, 42);
  a.gen.generatePhrase();
  b.gen.generatePhrase();
  assert.equal(JSON.stringify(a.state.phrase), JSON.stringify(b.state.phrase));
});

test("generatePhrase notifies UI and state saver", () => {
  const { max, gen } = setup();
  gen.generatePhrase();
  assert.deepEqual(max.sent.map((m) => m.receiver), ["PHRASE_GENERATED", "SAVE_STATE"]);
});

test("regenerating rhythm keeps phrase length", () => {
  const { gen, state } = setup({ freezeRhythm: false, phraseLength: 8 });
  gen.generatePhrase();
  gen.generatePhrase();
  assert.equal(state.phrase.length, 8);
});

test("bang generates a phrase", () => {
  const { max, gen, state } = setup({ phraseLength: 8 });
  gen.bang();
  assert.equal(state.phrase.length, 8);
  assert.ok(max.sent.some((m) => m.receiver === "PHRASE_GENERATED"));
});

test("each phrase gets its own seed, and a seed rebuilds the same phrase", () => {
  const { gen, state } = setup({ freezeRhythm: false });
  gen.generatePhrase();
  const seed = state.seed;
  const first = JSON.stringify(state.phrase);
  gen.generatePhrase();
  assert.notEqual(state.seed, seed);
  gen.generatePhrase(seed);
  assert.equal(JSON.stringify(state.phrase), first);
});

test("per-note CC and drift values depend only on the seed and step", () => {
  const { gen, state } = setup({ freezeRhythm: false });
  gen.generatePhrase(1234);
  const i = state.phrase.findIndex(Boolean);
  const expected = gen.noteRandoms(1234, i);
  assert.equal(JSON.stringify(state.phrase[i].ccRandom), JSON.stringify(expected.ccRandom));
  assert.equal(state.phrase[i].driftRandom, expected.driftRandom);
});

test("an explicit new phrase renews the rhythm even while it is frozen", () => {
  const { gen, state } = setup({ freezeRhythm: true });
  gen.generatePhrase();
  const rhythm = JSON.stringify(state.rhythm);
  gen.generatePhrase();
  assert.equal(JSON.stringify(state.rhythm), rhythm);
  gen.newPhrase();
  assert.notEqual(JSON.stringify(state.rhythm), rhythm);
});
