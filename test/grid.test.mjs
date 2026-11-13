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

test("edited notes are locked and freeze stays off", () => {
  const { max, grid, state } = setup([null, { relativePitch: 0, pitch: 60, velocity: 90, duration: 100 }]);
  grid.editCell(0, 4);
  grid.editCell(1, 7);
  assert.equal(state.phrase[0].locked, true);
  assert.equal(state.phrase[1].locked, true);
  assert.equal(state.freeze, false);
  assert.ok(!max.sent.some((m) => m.receiver === "FREEZE_UI"));
});

test("removing a locked note gives the step back to the generator", () => {
  const { grid, state } = setup([null]);
  grid.editCell(0, 4);
  grid.editCell(0, 4);
  assert.equal(state.phrase[0], null);
});

test("locked notes survive regeneration while the rest changes", () => {
  const { max, grid, state } = setup(new Array(16).fill(null));
  Object.assign(state, { phraseLength: 16, chance: 1, rhythm: [] });
  const gen = max.load("src/core/_generatePhrase.js");
  gen.generatePhrase();
  grid.editCell(3, 9);
  const locked = state.phrase[3];
  state.phrase[5] = null;
  gen.generatePhrase();
  assert.equal(state.phrase[3], locked);
  assert.equal(state.phrase[3].pitch % 12, 9);
  assert.notEqual(state.phrase[5], null);
});

test("a locked rest step keeps its note even if the rhythm has none there", () => {
  const { max, grid, state } = setup(new Array(4).fill(null));
  Object.assign(state, { phraseLength: 4, chance: 1e9, rhythm: [] });
  const gen = max.load("src/core/_generatePhrase.js");
  grid.editCell(2, 0);
  gen.generatePhrase();
  assert.equal(state.phrase.filter(Boolean).length, 1);
  assert.equal(state.phrase[2].locked, true);
});

test("locked notes are blue, others orange, the playing note white, and freeze turns everything blue", () => {
  const notes = [
    { relativePitch: 0, pitch: 60, velocity: 127, duration: 100 },
    { relativePitch: 0, pitch: 61, velocity: 127, duration: 100, locked: true },
    { relativePitch: 0, pitch: 62, velocity: 127, duration: 100 },
  ];
  const { grid, state, mgraphics } = setup(notes);
  const noteColours = () => {
    const calls = [];
    mgraphics.set_source_rgba = (...a) => calls.push(a.slice(0, 3).join(","));
    grid.paint();
    return calls.slice(-4, -1);
  };
  grid.onCurrentStepChanged(2);
  assert.deepEqual(noteColours(), ["1,0.65,0.2", "0.35,0.85,1", "1,1,1"]);
  state.freeze = true;
  assert.deepEqual(noteColours(), ["0.35,0.85,1", "0.35,0.85,1", "1,1,1"]);
});

test("a halo takes its note's colour", () => {
  const { grid, state } = setup([{ relativePitch: 0, pitch: 60, velocity: 100, duration: 100, locked: true }, { relativePitch: 0, pitch: 60, velocity: 100, duration: 100 }]);
  grid.onCurrentStepChanged(0);
  grid.onCurrentStepChanged(1);
  assert.equal(grid.halos.map((h) => h.frozen).join(), "true,false");
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
