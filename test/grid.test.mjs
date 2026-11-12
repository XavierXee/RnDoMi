import { test } from "node:test";
import assert from "node:assert/strict";
import { createMax } from "./max-sandbox.mjs";

function setup(phrase) {
  const max = createMax();
  max.load("src/core/_state.js");
  Object.assign(max.state, {
    root: 60, octaveMin: 0, octavesMax: 1, velocityMin: 50, velocityMax: 60, durationMin: 100, durationMax: 120, phrase,
  });
  const mgraphics = { size: [160, 120], redraws: 0, init() {}, redraw() { this.redraws++; } };
  for (const fn of ["set_source_rgba", "rectangle", "rectangle_rounded", "ellipse", "fill", "stroke", "set_line_width"]) mgraphics[fn] = () => {};
  const tasks = [];
  function Task(fn) {
    this.fn = fn;
    this.running = false;
    this.repeat = () => { this.running = true; };
    this.cancel = () => { this.running = false; };
    tasks.push(this);
  }
  const grid = max.load("src/max/_grid.jsui.js", { mgraphics, Task });
  let time = 0;
  grid.now = () => time;
  const setTime = (t) => { time = t; };
  return { max, grid, state: max.state, mgraphics, animation: tasks[0], setTime };
}

test("clicking an empty step adds a note within the ranges", () => {
  const { grid, state } = setup([null, null]);
  grid.editCell(1, 4);
  const note = state.phrase[1];
  assert.equal(note.relativePitch, 4);
  assert.ok([64, 76].includes(note.pitch));
  assert.ok(note.velocity >= 50 && note.velocity <= 60);
  assert.ok(note.duration >= 100 && note.duration <= 120);
});

test("clicking another row moves the note and keeps its octave", () => {
  const { grid, state } = setup([{ relativePitch: 2, pitch: 74, velocity: 80, duration: 300 }]);
  grid.editCell(0, 7);
  assert.equal(state.phrase[0].relativePitch, 7);
  assert.equal(state.phrase[0].pitch, 79);
  assert.equal(state.phrase[0].velocity, 80);
});

test("clicking the note itself removes it", () => {
  const { grid, state } = setup([{ relativePitch: 2, pitch: 74, velocity: 80, duration: 300 }]);
  grid.editCell(0, 2);
  assert.equal(state.phrase[0], null);
});

test("first edit enables freeze and updates the toggle", () => {
  const { max, grid, state } = setup([null]);
  grid.editCell(0, 0);
  assert.equal(state.freeze, true);
  assert.ok(max.sent.some((m) => m.receiver === "FREEZE_UI" && m.args.join(" ") === "set 1"));
  max.sent.length = 0;
  grid.editCell(0, 0);
  assert.ok(!max.sent.some((m) => m.receiver === "FREEZE_UI"));
});

function clickCell(grid, column, row) {
  const l = grid.layout();
  grid.onclick(l.left + (column + 0.5) * l.cw, l.bottom - (row + 0.5) * l.rh);
}

test("click position maps to step and row", () => {
  const { grid, state } = setup(new Array(16).fill(null));
  grid.paint();
  clickCell(grid, 1, 0);
  assert.equal(state.phrase[1].relativePitch, 0);
  clickCell(grid, 15, 11);
  assert.equal(state.phrase[15].relativePitch, 11);
});

const playedNote = { relativePitch: 3, pitch: 63, velocity: 127, duration: 400 };

test("playing a note starts a halo and the animation", () => {
  const { grid, animation } = setup([playedNote, null]);
  grid.onCurrentStepChanged(0);
  assert.equal(grid.halos.length, 1);
  assert.equal(animation.running, true);
});

test("rests start no halo", () => {
  const { grid, animation } = setup([playedNote, null]);
  grid.onCurrentStepChanged(1);
  assert.equal(grid.halos.length, 0);
  assert.equal(animation.running, false);
});

test("halo shrinks and fades over the note duration", () => {
  const { grid } = setup([playedNote]);
  const halo = { start: 1000, duration: 400, velocity: 127 };
  const start = grid.haloShape(halo, 1000);
  const middle = grid.haloShape(halo, 1200);
  assert.equal(start.scale, 1);
  assert.equal(middle.scale, 0.5);
  assert.ok(middle.alpha < start.alpha);
  assert.equal(grid.haloShape(halo, 1400), null);
});

test("animation stops once every halo has faded", () => {
  const { grid, animation, setTime } = setup([playedNote]);
  grid.onCurrentStepChanged(0);
  setTime(200);
  animation.fn();
  assert.equal(animation.running, true);
  setTime(400);
  animation.fn();
  assert.equal(grid.halos.length, 0);
  assert.equal(animation.running, false);
});

test("rows are absolute pitch classes, independent of root", () => {
  const { grid, state } = setup([null, { relativePitch: 0, pitch: 69, velocity: 80, duration: 300 }]);
  state.root = 69;
  grid.editCell(0, 0);
  assert.equal(state.phrase[0].pitch % 12, 0);
  assert.equal(state.phrase[0].relativePitch, 3);
  grid.editCell(1, 9);
  assert.equal(state.phrase[1], null);
});

test("moving a note keeps its octave and updates its interval", () => {
  const { grid, state } = setup([{ relativePitch: 0, pitch: 69, velocity: 80, duration: 300 }]);
  state.root = 69;
  grid.editCell(0, 11);
  assert.equal(state.phrase[0].pitch, 71);
  assert.equal(state.phrase[0].relativePitch, 2);
});

function scaleSetup(overrides = {}) {
  const s = setup([]);
  Object.assign(s.state, { root: 60, scaleName: "major" }, overrides);
  return s;
}

test("scale membership follows the root", () => {
  const { grid, state } = scaleSetup({ root: 62 });
  assert.equal(grid.scaleRows()[2], true);
  assert.equal(grid.scaleRows()[1], true);
  assert.equal(grid.scaleRows()[0], undefined);
  state.root = 60;
  assert.equal(grid.scaleRows()[0], true);
});

test("every colour is set with four components", () => {
  const { grid, state, mgraphics } = setup([{ relativePitch: 0, pitch: 60, velocity: 100, duration: 300 }]);
  const calls = [];
  mgraphics.set_source_rgba = (...args) => calls.push(args);
  Object.assign(state, { scaleName: "major" });
  grid.onCurrentStepChanged(0);
  grid.paint();
  assert.ok(calls.length > 0);
  for (const args of calls) {
    assert.equal(args.length, 4);
    assert.ok(args.every((v) => typeof v === "number" && !Number.isNaN(v)));
  }
});

test("columns share the width whatever the phrase length", () => {
  const { grid, state } = setup([]);
  grid.paint();
  state.phraseLength = 8;
  const short = grid.layout();
  state.phraseLength = 32;
  const long = grid.layout();
  assert.ok(short.cw > long.cw);
  assert.equal(long.left + long.steps * long.cw, long.grid.x + long.grid.w - 4);
});
