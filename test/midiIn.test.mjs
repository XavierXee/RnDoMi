import { test } from "node:test";
import assert from "node:assert/strict";
import { createMax } from "./max-sandbox.mjs";

function setup(overrides = {}) {
  const max = createMax();
  max.load("src/core/_state.js");
  max.connect("SET_PARAM", "src/core/_state.js");
  Object.assign(max.state, overrides);
  const midi = max.load("src/core/_midiIn.js");
  const send = (...bytes) => bytes.forEach((b) => midi.msg_int(b));
  const generated = () => max.sent.filter((m) => m.receiver === "GENERATE_PHRASE" && m.args[0] === "newPhrase").length;
  return { max, midi, state: max.state, send, generated };
}

const note = (pitch) => ({ relativePitch: 0, pitch, velocity: 100, duration: 100 });

test("a note-on sets the root and transposes the current phrase", () => {
  const { state, send } = setup({ root: 60, phrase: [note(60), null, note(67)] });
  send(0x90, 62, 100);
  assert.equal(state.root, 62);
  assert.deepEqual(state.phrase.map((n) => n && n.pitch), [62, null, 69]);
  assert.equal(state.phrase[2].relativePitch, 0);
});

test("note-offs and zero-velocity note-ons are ignored", () => {
  const { state, send } = setup({ root: 60, phrase: [] });
  send(0x80, 64, 0, 0x90, 65, 0);
  assert.equal(state.root, 60);
});

test("notes on any channel are accepted", () => {
  const { state, send } = setup({ root: 60, phrase: [] });
  send(0x9f, 48, 90);
  assert.equal(state.root, 48);
});

test("running status keeps parsing data bytes", () => {
  const { state, send } = setup({ root: 60, phrase: [] });
  send(0x90, 50, 100, 52, 100);
  assert.equal(state.root, 52);
  send(0xb0, 27, 0, 27, 127);
  assert.equal(state.phraseLength, 32);
});

test("realtime bytes inside a message are skipped", () => {
  const { state, send } = setup();
  send(0xb0, 0xf8, 27, 0xf8, 0);
  assert.equal(state.phraseLength, 1);
});

test("a list of bytes is parsed like single bytes", () => {
  const { state, midi } = setup();
  midi.list(0xb0, 28, 127);
  assert.equal(state.beatRate, 16);
});

test("number parameters are scaled to their range and snapped", () => {
  const { state, send } = setup();
  send(0xb0, 21, 0, 0xb0, 22, 127);
  assert.deepEqual([state.octaveMin, state.octavesMax], [-4, 4]);
  send(0xb0, 25, 64);
  assert.equal(state.durationMin, 1010);
  send(0xb0, 30, 127, 0xb0, 31, 0);
  assert.deepEqual([state.swingAmount, state.drift], [1, 0]);
});

test("the scale menu is split evenly over the CC range", () => {
  const { state, send } = setup();
  const names = Object.keys(state.noteLists);
  send(0xb0, 20, 0);
  assert.equal(state.scaleName, names[0]);
  send(0xb0, 20, 127);
  assert.equal(state.scaleName, names.at(-1));
  send(0xb0, 20, 64);
  assert.equal(state.scaleName, names[Math.floor(64 * names.length / 128)]);
});

test("toggles switch on at 64 and above", () => {
  const { state, send } = setup();
  send(0xb0, 32, 64);
  assert.equal(state.freeze, true);
  send(0xb0, 33, 127, 0xb0, 33, 63);
  assert.equal(state.freezeRhythm, false);
});

test("generate fires once when the value crosses 64 upward", () => {
  const { state, send, generated } = setup();
  send(0xb0, 34, 127, 0xb0, 34, 100);
  assert.equal(generated(), 1);
  assert.equal(state.freeze, true);
  send(0xb0, 34, 0, 0xb0, 34, 70);
  assert.equal(generated(), 2);
});

test("unmapped CCs and other messages change nothing", () => {
  const { max, send } = setup();
  send(0xb0, 7, 100, 0xe0, 0, 64, 0xc0, 5);
  assert.equal(max.sent.filter((m) => m.receiver === "SET_PARAM").length, 0);
});

test("setParam clamps every number parameter to its range", () => {
  const { state, max } = setup();
  const s = max.scripts.get("src/core/_state.js");
  s.setParam("phraseLength", 99);
  s.setParam("velocityMax", -5);
  s.setParam("durationMin", 1234);
  assert.deepEqual([state.phraseLength, state.velocityMax, state.durationMin], [32, 0, 1230]);
  s.setParam("chance", "abc");
  assert.equal(state.chance, 2);
});

test("drift is a 0-1 parameter shown as a percentage", () => {
  const max = createMax();
  max.load("src/core/_state.js");
  assert.equal(max.state.drift, 0);
  assert.equal(JSON.stringify(max.state.paramSpecs.drift), JSON.stringify({ type: "number", min: 0, max: 1, step: 0.01 }));
});
