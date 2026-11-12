import { test } from "node:test";
import assert from "node:assert/strict";
import { createMax } from "./max-sandbox.mjs";

function fakeBox(width, height) {
  const rects = { patching_rect: [10, 20, width, height], presentation_rect: [30, 40, width, height] };
  return {
    rects,
    getattr: (name) => rects[name],
    setattr: (name, ...v) => { rects[name] = v; },
  };
}

function setup(overrides = {}, size = [40, 120], box = fakeBox(size[0], size[1])) {
  const max = createMax();
  max.load("src/core/_state.js");
  Object.assign(max.state, { root: 60, scaleName: "major", phrase: [] }, overrides);
  const mgraphics = { size, init() {}, redraw() {} };
  for (const fn of ["set_source_rgba", "rectangle", "rectangle_rounded", "ellipse", "fill", "stroke", "set_line_width"]) mgraphics[fn] = () => {};
  const keyboard = max.load("src/max/_keyboard.jsui.js", { mgraphics, box });
  keyboard.paint();
  return { max, keyboard, state: max.state, mgraphics, box };
}

const scaleOf = (state) => JSON.stringify(state.noteLists[state.scaleName]);

test("box width stays fixed when the jsui is wider", () => {
  const narrow = setup({}, [40, 120]).keyboard.layout();
  const wide = setup({}, [200, 120]).keyboard.layout();
  assert.equal(narrow.box.w, wide.box.w);
});

test("clicking a row toggles that key into a custom scale", () => {
  const { max, keyboard, state } = setup();
  const l = keyboard.layout();
  keyboard.onclick(l.left + l.cw * 0.5, l.bottom - 1.5 * l.rh);
  assert.equal(state.scaleName, "custom");
  assert.equal(scaleOf(state), JSON.stringify([0, 1, 2, 4, 5, 7, 9, 11]));
  assert.ok(max.sent.some((m) => m.receiver === "SCALE_UI"));
});

test("clicks outside the box are ignored", () => {
  const { keyboard, state } = setup({}, [200, 120]);
  const l = keyboard.layout();
  keyboard.onclick(l.box.x + l.box.w + 5, l.bottom - 1.5 * l.rh);
  assert.equal(state.scaleName, "major");
});

test("toggling is relative to the root and keeps one note", () => {
  const { keyboard, state } = setup({ root: 62 });
  keyboard.toggleKey(6);
  assert.equal(scaleOf(state), JSON.stringify([0, 2, 5, 7, 9, 11]));
  state.noteLists.custom = [0];
  keyboard.toggleKey(2);
  assert.equal(scaleOf(state), JSON.stringify([0]));
});

test("the key of the note on the current step is playing", () => {
  const { keyboard } = setup({ phrase: [null, { relativePitch: 4, pitch: 52, velocity: 90, duration: 100 }] });
  keyboard.onCurrentStepChanged(1);
  assert.equal(keyboard.playingPitchClass(), 4);
});

test("every colour is set with four components", () => {
  const { keyboard, mgraphics } = setup({ phrase: [{ relativePitch: 0, pitch: 60, velocity: 100, duration: 300 }] });
  const calls = [];
  mgraphics.set_source_rgba = (...args) => calls.push(args);
  keyboard.onCurrentStepChanged(0);
  keyboard.paint();
  assert.ok(calls.length > 0);
  for (const args of calls) assert.equal(args.length, 4);
});

test("the jsui shrinks to the box plus margins, keeping its position and height", () => {
  const box = fakeBox(200, 120);
  setup({}, [200, 120], box);
  assert.deepEqual(box.rects.patching_rect, [10, 20, 40, 120]);
  assert.deepEqual(box.rects.presentation_rect, [30, 40, 40, 120]);
});

test("resizing wider snaps back to the fixed width", () => {
  const { keyboard, box } = setup();
  box.rects.presentation_rect = [30, 40, 90, 150];
  keyboard.onresize(90, 150);
  assert.deepEqual(box.rects.presentation_rect, [30, 40, 40, 150]);
});

test("scale membership follows the root", () => {
  const { keyboard, state } = setup({ root: 62 });
  assert.equal(keyboard.scaleRows()[2], true);
  assert.equal(keyboard.scaleRows()[1], true);
  assert.equal(keyboard.scaleRows()[0], undefined);
  state.root = 60;
  assert.equal(keyboard.scaleRows()[0], true);
});

test("toggling notifies the scale menu and the other views", () => {
  const { max, keyboard, state } = setup();
  keyboard.toggleKey(1);
  assert.equal(state.noteLists.major.length, 7);
  const ui = max.sent.find((m) => m.receiver === "SCALE_UI");
  assert.equal(ui.args[1], Object.keys(state.noteLists).indexOf("custom"));
  assert.ok(max.sent.some((m) => m.receiver === "STATE_CHANGED"));
});

test("extended chord intervals match their pitch class", () => {
  const { keyboard, state } = setup({ scaleName: "major9Chord" });
  keyboard.toggleKey(2);
  assert.equal(scaleOf(state), JSON.stringify([0, 4, 7, 11]));
});
