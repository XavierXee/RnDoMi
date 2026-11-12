import { test } from "node:test";
import assert from "node:assert/strict";
import { createMax } from "./max-sandbox.mjs";

function setup({ named = true, values = {} } = {}) {
  const max = createMax();
  max.load("src/core/_state.js");
  max.connect("SET_PARAM", "src/core/_state.js");
  const messages = [];
  const objects = {};
  function MaxobjListener(obj, fn) {
    obj.listeners.push(fn);
  }
  function object(key) {
    if (!objects[key]) {
      objects[key] = {
        value: key in values ? values[key] : 0,
        listeners: [],
        getvalueof() { return this.value; },
        message(type, value) {
          messages.push([key, type, value]);
          this.value = value;
          this.listeners.forEach((fn) => fn({ value: [value], maxobject: this }));
        },
      };
    }
    return objects[key];
  }
  const patcher = { getnamed: (key) => (named ? object(key) : null) };
  const mgraphics = { size: [300, 160], init() {}, redraw() {}, text_measure: () => [10, 9] };
  for (const fn of ["set_source_rgba", "rectangle", "rectangle_rounded", "ellipse", "fill", "stroke", "set_line_width",
    "move_to", "line_to", "show_text", "select_font_face", "set_font_size"]) mgraphics[fn] = () => {};
  const controls = max.load("src/max/_controls.jsui.js", { mgraphics, patcher, MaxobjListener });
  controls.paint();
  const cell = (key) => controls.layout().find((c) => c.control.key === key || (c.control.keys || []).includes(key));
  return { max, controls, state: max.state, messages, objects, cell };
}

function at(cell, value) {
  return cell.x0 + (value - cell.control.min) / (cell.control.max - cell.control.min) * (cell.x1 - cell.x0);
}

test("slider click sets the value through the named object", () => {
  const { controls, state, messages, cell } = setup();
  const c = cell("phraseLength");
  controls.onclick(at(c, 8), c.trackY);
  assert.equal(state.phraseLength, 8);
  assert.deepEqual(messages.at(-1), ["phraseLength", "float", 8]);
});

test("slider drag follows the mouse and release ends the drag", () => {
  const { controls, state, cell } = setup();
  const c = cell("beatRate");
  controls.onclick(at(c, 2), c.trackY);
  controls.ondrag(at(c, 6), c.trackY, 1);
  assert.equal(state.beatRate, 6);
  controls.ondrag(at(c, 6), c.trackY, 0);
  controls.ondrag(at(c, 10), c.trackY, 1);
  assert.equal(state.beatRate, 6);
});

test("float values are sent as floats", () => {
  const { controls, messages, cell } = setup();
  const c = cell("swingAmount");
  controls.onclick(at(c, 0.5), c.trackY);
  assert.deepEqual(messages.at(-1), ["swingAmount", "float", 0.5]);
});

test("range click moves the nearer handle and handles never cross", () => {
  const { controls, state, cell } = setup();
  const c = cell("velocityMin");
  state.velocityMin = 40;
  state.velocityMax = 80;
  controls.onclick(at(c, 90), c.trackY);
  assert.equal(state.velocityMax, 90);
  controls.ondrag(at(c, 10), c.trackY, 1);
  assert.equal(state.velocityMax, 40);
  assert.equal(state.velocityMin, 40);
});

test("dragging between the handles moves the whole range within bounds", () => {
  const { controls, state, cell } = setup();
  const c = cell("velocityMin");
  state.velocityMin = 40;
  state.velocityMax = 80;
  controls.onclick(at(c, 60), c.trackY);
  controls.ondrag(at(c, 70), c.trackY, 1);
  assert.deepEqual([state.velocityMin, state.velocityMax], [50, 90]);
  controls.ondrag(at(c, 200), c.trackY, 1);
  assert.deepEqual([state.velocityMin, state.velocityMax], [87, 127]);
});

test("menu arrows step through scales by index", () => {
  const { controls, state, messages, cell } = setup();
  const c = cell("scaleName");
  const names = Object.keys(state.noteLists);
  state.scaleName = names[3];
  controls.onclick(c.x + 1, c.trackY);
  assert.equal(state.scaleName, names[2]);
  controls.onclick(c.x + c.w - 1, c.trackY);
  controls.onclick(c.x + c.w - 1, c.trackY);
  assert.equal(state.scaleName, names[4]);
  assert.deepEqual(messages.at(-1), ["scaleName", "int", 4]);
});

test("menu drag scrolls and clamps to the list", () => {
  const { controls, state, cell } = setup();
  const c = cell("scaleName");
  const names = Object.keys(state.noteLists);
  state.scaleName = names[0];
  const mid = (c.x0 + c.x1) / 2;
  controls.onclick(mid, c.trackY);
  controls.ondrag(mid + 12, c.trackY, 1);
  assert.equal(state.scaleName, names[2]);
  controls.ondrag(mid - 100, c.trackY, 1);
  assert.equal(state.scaleName, names[0]);
});

test("wheel steps sliders and menus", () => {
  const { controls, state, cell } = setup();
  const c = cell("chance");
  state.chance = 2;
  controls.onwheel(at(c, 2), c.trackY, 0, 1);
  assert.equal(state.chance, 3);
});

test("value labels format each control", () => {
  const { controls, state, cell } = setup({ values: { scaleName: 30 } });
  Object.assign(state, { root: 69, octaveMin: -2, octavesMax: 0, durationMin: 50, durationMax: 1000, chance: 2, swingAmount: 0.25 });
  assert.equal(controls.valueText(cell("root").control), "A3");
  assert.equal(controls.valueText(cell("octaveMin").control), "-2 – 0");
  assert.equal(controls.valueText(cell("durationMin").control), "50 ms – 1000 ms");
  assert.equal(controls.valueText(cell("chance").control), "1 in 2");
  assert.equal(controls.valueText(cell("swingAmount").control), "25%");
  assert.equal(controls.valueText(cell("scaleName").control), "minor 11 chord");
});

test("without a named object the value goes to setParam and warns once", () => {
  const { controls, max, cell } = setup({ named: false });
  const c = cell("phraseLength");
  controls.onclick(at(c, 8), c.trackY);
  controls.onclick(at(c, 9), c.trackY);
  assert.equal(max.sent.filter((m) => m.receiver === "SET_PARAM").length, 2);
  assert.equal(max.posts.filter((p) => p.includes("phraseLength")).length, 1);
});

test("on load the panel pushes every object's current value to the engine", () => {
  const { state } = setup({ values: { phraseLength: 12, scaleName: 3, velocityMax: 90 } });
  assert.equal(state.phraseLength, 12);
  assert.equal(state.scaleName, Object.keys(state.noteLists)[3]);
  assert.equal(state.velocityMax, 90);
});

test("automation moving an object reaches the engine", () => {
  const { state, objects } = setup({ values: { beatRate: 4 } });
  objects.beatRate.message("int", 8);
  assert.equal(state.beatRate, 8);
});

test("duration objects hold seconds while the engine keeps milliseconds", () => {
  const { controls, state, messages, objects, cell } = setup({ values: { durationMin: 0.05, durationMax: 1 } });
  assert.deepEqual([state.durationMin, state.durationMax], [50, 1000]);
  const c = cell("durationMin");
  controls.onclick(at(c, 1500), c.trackY);
  assert.deepEqual(messages.at(-1), ["durationMax", "float", 1.5]);
  assert.equal(state.durationMax, 1500);
  objects.durationMin.message("float", 0.07300000001);
  assert.equal(state.durationMin, 70);
});

test("float objects for integer parameters are rounded to the control step", () => {
  const { state, objects } = setup({ values: { octaveMin: -2.0000001, phraseLength: 11.6 } });
  assert.equal(state.octaveMin, -2);
  assert.equal(state.phraseLength, 12);
  objects.octaveMin.message("float", -9);
  assert.equal(state.octaveMin, -4);
});
