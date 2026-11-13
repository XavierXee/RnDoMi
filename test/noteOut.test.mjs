import { test } from "node:test";
import assert from "node:assert/strict";
import { createMax } from "./max-sandbox.mjs";

function setup() {
  const max = createMax();
  const scheduled = [];
  function Task(fn, owner, ...args) {
    this.schedule = (delay) => scheduled.push({ delay, run: () => fn(...args) });
  }
  const out = max.load("src/core/_noteOut.js", { Task });
  const midi = () => max.sent.filter((m) => m.receiver === "CC_OUT").map((m) => m.args.join(" "));
  return { out, midi, scheduled };
}

test("a note sends note-on now and note-off after its duration on the same channel", () => {
  const { out, midi, scheduled } = setup();
  out.list(60, 100, 250, 3);
  assert.deepEqual(midi(), [`${0x92} 60 100`]);
  assert.equal(scheduled[0].delay, 250);
  scheduled[0].run();
  assert.deepEqual(midi(), [`${0x92} 60 100`, `${0x82} 60 0`]);
});

test("a later channel change does not move an earlier note-off", () => {
  const { out, midi, scheduled } = setup();
  out.list(60, 100, 500, 2);
  out.list(64, 100, 100, 3);
  scheduled[1].run();
  scheduled[0].run();
  assert.deepEqual(midi().slice(2), [`${0x82} 64 0`, `${0x81} 60 0`]);
});

test("the channel defaults to 1 and zero-velocity notes are skipped", () => {
  const { out, midi } = setup();
  out.list(60, 90, 100);
  out.list(61, 0, 100, 1);
  assert.deepEqual(midi(), [`${0x90} 60 90`]);
});
