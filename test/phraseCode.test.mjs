import { test } from "node:test";
import assert from "node:assert/strict";
import { createMax } from "./max-sandbox.mjs";

const json = (v) => JSON.stringify(v);

function setup({ store = false } = {}) {
  const max = createMax();
  max.load("src/core/_state.js");
  max.connect("SET_PARAM", "src/core/_state.js");
  const gen = max.load("src/core/_generatePhrase.js");
  const objects = {};
  function MaxobjListener(obj, fn) {
    obj.listeners.push(fn);
  }
  const patcher = {
    getnamed(key) {
      if (key !== "phraseCode" || !store) return null;
      objects[key] ||= {
        value: "", listeners: [],
        getvalueof() { return this.value; },
        message(value) { this.value = value; this.listeners.forEach((fn) => fn({ value: [value] })); },
      };
      return objects[key];
    },
  };
  const code = max.load("src/core/_phraseCode.js", { patcher, MaxobjListener });
  return { max, gen, code, state: max.state, objects };
}

function snapshot(state) {
  const keys = ["seed", "root", "scaleName", "octaveMin", "octavesMax", "velocityMin", "velocityMax",
    "durationMin", "durationMax", "phraseLength", "beatRate", "chance", "freezeRhythm"];
  const note = (n) => n && [n.pitch, n.velocity, n.duration, !!n.locked, n.relativePitch, n.ccRandom, n.driftRandom];
  return json({ params: keys.map((k) => state[k]), phrase: state.phrase.slice(0, state.phraseLength).map(note) });
}

test("a phrase code round-trips the phrase and its settings", () => {
  const { gen, code, state } = setup();
  Object.assign(state, { root: 62, scaleName: "dorian", octaveMin: -1, octavesMax: 2, velocityMin: 30, velocityMax: 110,
    durationMin: 80, durationMax: 1500, phraseLength: 12, beatRate: 3, chance: 3, freezeRhythm: false });
  gen.generatePhrase(4242);
  state.phrase[1] = { relativePitch: 5, pitch: 67, velocity: 77, duration: 333, locked: true };
  const before = snapshot(state);
  const text = code.encode();

  Object.assign(state, { root: 50, scaleName: "major", phraseLength: 16, velocityMax: 10, freezeRhythm: true, phrase: [] });
  code.load(text);

  const strip = (snap) => JSON.parse(snap).phrase.map((n) => n && n.slice(0, 5));
  assert.equal(json(JSON.parse(snapshot(state)).params), json(JSON.parse(before).params));
  assert.equal(json(strip(snapshot(state))), json(strip(before)));
});

test("restored notes get back the CC and drift values they were generated with", () => {
  const { gen, code, state } = setup();
  gen.generatePhrase(99);
  const original = json(state.phrase.map((n) => n && [n.ccRandom, n.driftRandom]));
  const text = code.encode();
  state.phrase = [];
  code.load(text);
  assert.equal(json(state.phrase.map((n) => n && [n.ccRandom, n.driftRandom])), original);
});

test("loading a code freezes the phrase and rebuilds the rhythm", () => {
  const { gen, code, state } = setup();
  gen.generatePhrase(7);
  const text = code.encode();
  state.freeze = false;
  code.load(text);
  assert.equal(state.freeze, true);
  assert.equal(state.rhythm.length, state.phraseLength);
  state.rhythm.forEach((r, i) => assert.equal(!!r, !!state.phrase[i]));
});

test("custom scales are carried in the code", () => {
  const { gen, code, state } = setup();
  state.noteLists.custom = [0, 1, 6];
  state.scaleName = "custom";
  gen.generatePhrase(5);
  const text = code.encode();
  state.noteLists.custom = [0];
  state.scaleName = "major";
  code.load(text);
  assert.equal(state.scaleName, "custom");
  assert.equal(json(state.noteLists.custom), "[0,1,6]");
});

test("codes are short and use only URL-safe characters", () => {
  const { gen, code, state } = setup();
  state.phraseLength = 16;
  gen.generatePhrase(1);
  const text = code.encode();
  assert.match(text, /^[A-Za-z0-9_-]+$/);
  assert.ok(text.length < 120, `length ${text.length}`);
});

test("invalid codes are rejected and change nothing", () => {
  const { gen, code, state, max } = setup();
  gen.generatePhrase(3);
  const before = snapshot(state);
  for (const bad of ["", "hello world", "AAAA", "B" + code.encode().slice(1)]) code.load(bad);
  assert.equal(snapshot(state), before);
  assert.ok(max.posts.some((p) => p.includes("not a valid phrase code")));
});

test("the code updates on generation, edits and setting changes", () => {
  const { gen, code, state, max } = setup();
  gen.generatePhrase(10);
  code.onPhraseGenerated();
  const first = state.phraseCode;
  assert.equal(first, code.encode());
  state.velocityMax = 90;
  code.onStateChanged("velocityMax");
  assert.notEqual(state.phraseCode, first);
  assert.ok(max.sent.some((m) => m.receiver === "STATE_CHANGED" && m.args[1] === "phraseCode"));
});

test("the current code is kept in the hidden store and restored from it on load", () => {
  const { gen, code, state, objects } = setup({ store: true });
  gen.generatePhrase(21);
  code.onPhraseGenerated();
  assert.equal(objects.phraseCode.value, state.phraseCode);

  const saved = state.phraseCode;
  const wanted = snapshot(state);
  const fresh = setup({ store: true });
  fresh.code.objectNamed("phraseCode").value = saved;
  fresh.code.bind();
  assert.equal(snapshot(fresh.state), wanted);
});
