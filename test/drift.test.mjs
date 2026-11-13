import { test } from "node:test";
import assert from "node:assert/strict";
import { createMax } from "./max-sandbox.mjs";

const note = (driftRandom, extra = {}) => ({ relativePitch: 0, pitch: 60, velocity: 100, duration: 300, driftRandom, ...extra });

function setup(overrides = {}) {
  const max = createMax();
  max.load("src/core/_state.js");
  Object.assign(max.state, { phrase: [note(1), null, note(-1), note(0.5)] }, overrides);
  const tasks = [];
  function Task() {
    this.running = false;
    this.repeat = () => { this.running = true; };
    this.cancel = () => { this.running = false; };
    tasks.push(this);
  }
  const drift = max.load("src/core/_drift.js", { Task });
  let time = 0;
  drift.now = () => time;
  const out = () => max.sent.filter((m) => m.receiver === "CC_OUT").map((m) => {
    const [status, lsb, msb] = m.args;
    return { channel: (status & 0x0f) + 1, type: status & 0xf0, value: lsb | (msb << 7) };
  });
  return { max, drift, state: max.state, out, animation: tasks[0], setTime: (t) => { time = t; } };
}

test("at 0% drift the bend stays centred and is sent only once", () => {
  const { drift, out } = setup();
  drift.onStep(0, 1);
  drift.onStep(2, 1);
  assert.deepEqual(out(), [{ channel: 1, type: 0xe0, value: 8192 }]);
});

test("100% drift reaches half a semitone with the default 2 semitone range", () => {
  const { drift, out } = setup({ drift: 1, driftDistribution: 0 });
  drift.onStep(0, 1);
  drift.onStep(2, 1);
  assert.deepEqual(out().map((b) => b.value), [8192 + 2048, 8192 - 2048]);
});

test("the bend range scales the bend so the pitch offset stays the same", () => {
  const { drift, out } = setup({ drift: 1, driftDistribution: 0, bendRange: 12 });
  drift.onStep(0, 1);
  assert.equal(out()[0].value, 8192 + Math.round(8192 / 24));
});

test("the drift amount scales the offset", () => {
  const { drift, out } = setup({ drift: 0.5, driftDistribution: 0 });
  drift.onStep(0, 1);
  assert.equal(out()[0].value, 8192 + 1024);
});

test("distribution pulls rolls towards zero but keeps the extremes", () => {
  const { drift, state } = setup({ drift: 1 });
  state.driftDistribution = 0;
  const uniform = drift.offset(note(0.5));
  state.driftDistribution = 1;
  const weighted = drift.offset(note(0.5));
  assert.equal(uniform, 0.25);
  assert.ok(Math.abs(weighted - 0.0625) < 1e-9);
  assert.equal(drift.offset(note(-1)), -0.5);
});

test("rests and skipped steps send nothing", () => {
  const { drift, out } = setup({ drift: 1 });
  drift.onStep(1, 0);
  drift.onStep(0, 0);
  assert.equal(out().length, 0);
});

test("a frozen phrase drifts the same way every loop", () => {
  const { drift, out, state } = setup({ drift: 1, phrase: [note(undefined), note(undefined)] });
  drift.onStep(0, 1);
  drift.onStep(1, 1);
  const first = out().map((b) => b.value);
  assert.equal(typeof state.phrase[0].driftRandom, "number");
  drift.onStep(0, 1);
  drift.onStep(1, 1);
  assert.deepEqual(out().slice(2).map((b) => b.value), first);
});

test("glide starts centred and reaches the target over the note duration", () => {
  const { drift, out, animation, setTime } = setup({ drift: 1, driftDistribution: 0, driftShape: 1 });
  setTime(1000);
  drift.onStep(0, 1);
  assert.deepEqual(out().map((b) => b.value), [8192]);
  assert.equal(animation.running, true);
  setTime(1150);
  drift.animate();
  assert.equal(out().at(-1).value, 8192 + 1024);
  setTime(1300);
  drift.animate();
  assert.equal(out().at(-1).value, 8192 + 2048);
  assert.equal(animation.running, false);
});

test("without MPE every note plays on channel 1", () => {
  const { drift, state } = setup({ drift: 1 });
  drift.onStep(0, 1);
  assert.equal(state.noteChannel, 1);
});

test("MPE rotates notes over channels 2-16, each with its own bend", () => {
  const phrase = Array.from({ length: 16 }, () => note(1));
  const { drift, state, out } = setup({ drift: 1, driftDistribution: 0, driftMpe: true, phrase });
  const channels = [];
  for (let i = 0; i < 16; i++) {
    drift.onStep(i, 1);
    channels.push(state.noteChannel);
  }
  assert.deepEqual(channels, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 2]);
  assert.deepEqual(out().map((b) => b.channel), channels.slice(0, 15));
});

test("turning drift off recentres every channel that was bent", () => {
  const { drift, state, out, max } = setup({ drift: 1, driftMpe: true });
  drift.onStep(0, 1);
  drift.onStep(2, 1);
  max.sent.length = 0;
  state.drift = 0;
  drift.onStateChanged("drift");
  assert.deepEqual(out().map((b) => [b.channel, b.value]), [[2, 8192], [3, 8192]]);
});

test("switching MPE off recentres and goes back to channel 1", () => {
  const { drift, state, out, max } = setup({ drift: 1, driftMpe: true });
  drift.onStep(0, 1);
  max.sent.length = 0;
  state.driftMpe = false;
  drift.onStateChanged("driftMpe");
  assert.deepEqual(out().map((b) => [b.channel, b.value]), [[2, 8192]]);
  assert.equal(state.noteChannel, 1);
});

test("the main loop sends the note channel with each note", () => {
  const max = createMax();
  max.load("src/core/_state.js");
  Object.assign(max.state, { phraseLength: 1, beatRate: 1, phrase: [note(0)], noteChannel: 5 });
  const main = max.load("src/core/_main.js");
  main.bang();
  assert.equal(JSON.stringify(max.sent.find((m) => m.receiver === "PLAY_NOTE").args[0]), "[60,100,300,5]");
});

test("generated notes carry a drift roll", () => {
  const max = createMax();
  max.load("src/core/_state.js");
  max.load("src/core/_generatePhrase.js").generatePhrase();
  for (const n of max.state.phrase.filter(Boolean)) assert.ok(n.driftRandom >= -1 && n.driftRandom <= 1);
});

test("bend range has an incoming CC", () => {
  const max = createMax();
  max.load("src/core/_state.js");
  max.connect("SET_PARAM", "src/core/_state.js");
  const midi = max.load("src/core/_midiIn.js");
  [0xb0, 35, 127].forEach((b) => midi.msg_int(b));
  assert.equal(max.state.bendRange, 48);
});
