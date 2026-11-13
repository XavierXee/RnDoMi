import { test } from "node:test";
import assert from "node:assert/strict";
import { createMax } from "./max-sandbox.mjs";

const note = (pitch) => ({ relativePitch: 0, pitch, velocity: 100, duration: 100 });

// Ticks every 10 ms, 4 ticks per step: a step lasts 40 ms.
function runTimed(swingAmount) {
  const max = createMax();
  max.load("src/core/_state.js");
  Object.assign(max.state, { swingAmount, freeze: true, phraseLength: 4, beatRate: 4, phrase: [note(60), note(61), note(62), note(63)] });
  const scheduled = [];
  let time = 0;
  function Task(fn, owner, ...args) {
    this.schedule = (delay) => scheduled.push({ at: time + delay, fn: () => fn(...args) });
  }
  const main = max.load("src/core/_main.js", { Task });
  main.now = () => time;
  const played = [];
  const record = (from) => {
    for (const m of max.sent.slice(from)) if (m.receiver === "PLAY_NOTE") played.push({ pitch: m.args[0][0], at: time });
  };
  for (let tick = 0; tick < 16; tick++) {
    const end = time + 10;
    let from = max.sent.length;
    main.bang();
    record(from);
    for (;;) {
      scheduled.sort((a, b) => a.at - b.at);
      if (!scheduled.length || scheduled[0].at >= end) break;
      const next = scheduled.shift();
      time = next.at;
      from = max.sent.length;
      next.fn();
      record(from);
    }
    time = end;
  }
  return played;
}

test("0% swing plays every step straight on its tick", () => {
  const played = runTimed(0);
  assert.deepEqual(played.map((p) => [p.pitch, p.at]), [[60, 0], [61, 40], [62, 80], [63, 120]]);
});

test("100% swing pushes off-beats by a third of a step", () => {
  const played = runTimed(1);
  const offbeats = played.filter((p) => p.pitch % 2 === 1);
  assert.ok(Math.abs(offbeats[0].at - (40 + 40 / 3)) < 0.5, `got ${offbeats[0].at}`);
  assert.ok(Math.abs(offbeats[1].at - (120 + 40 / 3)) < 0.5, `got ${offbeats[1].at}`);
  assert.deepEqual(played.filter((p) => p.pitch % 2 === 0).map((p) => p.at), [0, 80]);
});

test("50% swing gives half the shift", () => {
  const played = runTimed(0.5);
  assert.ok(Math.abs(played[1].at - (40 + 20 / 3)) < 0.5, `got ${played[1].at}`);
});

test("swing waits for a measured tick before delaying anything", () => {
  const max = createMax();
  max.load("src/core/_state.js");
  Object.assign(max.state, { swingAmount: 1, phraseLength: 2, beatRate: 1, phrase: [note(60), note(61)] });
  let scheduled = 0;
  function Task() { this.schedule = () => { scheduled++; }; }
  const main = max.load("src/core/_main.js", { Task });
  main.now = () => 0;
  main.bang();
  main.bang();
  assert.equal(scheduled, 0);
});

test("the delayed step keeps its CC, note and playhead together and in order", () => {
  const max = createMax();
  max.load("src/core/_state.js");
  Object.assign(max.state, { swingAmount: 1, freeze: true, phraseLength: 2, beatRate: 1, phrase: [note(60), note(61)] });
  const scheduled = [];
  function Task(fn, owner, ...args) {
    this.schedule = () => scheduled.push(() => fn(...args));
  }
  const main = max.load("src/core/_main.js", { Task });
  let time = 0;
  main.now = () => time;
  main.bang();
  time = 10;
  main.bang();
  const names = (from) => max.sent.slice(from).map((m) => m.receiver).filter((r) => ["CC_STEP", "PLAY_NOTE", "CURRENT_STEP"].includes(r));
  const before = max.sent.length;
  assert.equal(scheduled.length, 1);
  assert.deepEqual(names(before), []);
  scheduled[0]();
  assert.deepEqual(names(before), ["CC_STEP", "PLAY_NOTE", "CURRENT_STEP"]);
});

test("long gaps such as a stopped transport don't count as ticks", () => {
  const max = createMax();
  max.load("src/core/_state.js");
  const main = max.load("src/core/_main.js");
  let time = 0;
  main.now = () => time;
  main.measureTick();
  time = 5000;
  main.measureTick();
  assert.equal(main.tickMs, 0);
  time = 5010;
  main.measureTick();
  assert.equal(main.tickMs, 10);
});
