import { test } from "node:test";
import assert from "node:assert/strict";
import { createMax } from "./max-sandbox.mjs";

function setup({ values = {}, named = true } = {}) {
  const max = createMax();
  max.load("src/core/_state.js");
  max.connect("SET_PARAM", "src/core/_state.js");
  const objects = {};
  function MaxobjListener(obj, fn) {
    obj.listeners.push(fn);
  }
  function object(key) {
    if (!objects[key]) {
      objects[key] = {
        value: key in values ? values[key] : Number(max.state[key]),
        listeners: [],
        getvalueof() { return this.value; },
        message(type, value) {
          this.type = type;
          this.value = value;
          this.listeners.forEach((fn) => fn({ value: [value] }));
        },
      };
    }
    return objects[key];
  }
  const patcher = { getnamed: (key) => (named ? object(key) : null) };
  const mgraphics = { size: [150, 169], init() {}, redraw() {}, text_measure: () => [30, 9] };
  for (const fn of ["set_source_rgba", "rectangle", "rectangle_rounded", "ellipse", "fill", "stroke", "set_line_width",
    "move_to", "line_to", "show_text", "select_font_face", "set_font_size"]) mgraphics[fn] = () => {};
  const panel = max.load("src/max/_drift.jsui.js", { mgraphics, patcher, MaxobjListener });
  panel.paint();
  const cell = (key) => panel.layout().cells.find((c) => c.control.key === key);
  const at = (c, v) => c.x0 + (v - c.control.min) / (c.control.max - c.control.min) * (c.x1 - c.x0);
  return { max, panel, state: max.state, objects, cell, at, mgraphics };
}

test("shows bend range, shape, MPE and distribution in that order", () => {
  const { panel } = setup();
  assert.equal(panel.layout().cells.map((c) => c.control.key).join(), "bendRange,driftShape,driftMpe,driftDistribution");
});

test("defaults: ±2 st, static, MPE off, weighted", () => {
  const { panel, cell } = setup();
  assert.equal(panel.valueText(cell("bendRange").control), "±2 st");
  assert.equal(panel.valueText(cell("driftShape").control), "static");
  assert.equal(panel.valueText(cell("driftMpe").control), "off");
  assert.equal(panel.valueText(cell("driftDistribution").control), "weighted");
});

test("bend range slider sets whole semitones through the hidden object", () => {
  const { panel, state, objects, cell, at } = setup();
  const c = cell("bendRange");
  panel.onclick(at(c, 12), c.trackY);
  assert.equal(state.bendRange, 12);
  assert.equal(objects.bendRange.type, "int");
  panel.onwheel(at(c, 12), c.trackY, 0, 1);
  assert.equal(state.bendRange, 13);
});

test("clicking a shape half selects it", () => {
  const { panel, state, cell } = setup();
  const c = cell("driftShape");
  panel.onclick(c.x + c.w * 0.75, c.trackY);
  assert.equal(state.driftShape, 1);
  panel.onclick(c.x + c.w * 0.25, c.trackY);
  assert.equal(state.driftShape, 0);
});

test("the MPE switch toggles", () => {
  const { panel, state, cell } = setup();
  const c = cell("driftMpe");
  panel.onclick(c.x0, c.trackY);
  assert.equal(state.driftMpe, true);
});

test("distribution drags between uniform and weighted", () => {
  const { panel, state, objects, cell, at } = setup();
  const c = cell("driftDistribution");
  panel.onclick(at(c, 1), c.trackY);
  panel.ondrag(at(c, 0.3), c.trackY, 1);
  assert.equal(state.driftDistribution, 0.3);
  assert.equal(objects.driftDistribution.type, "float");
  assert.equal(panel.valueText(c.control), "30% weighted");
  panel.ondrag(at(c, -1), c.trackY, 1);
  assert.equal(panel.valueText(c.control), "uniform");
});

test("restored values reach the engine on load", () => {
  const { state } = setup({ values: { bendRange: 24, driftShape: 1, driftMpe: 1, driftDistribution: 0.2 } });
  assert.deepEqual([state.bendRange, state.driftShape, state.driftMpe, state.driftDistribution], [24, 1, true, 0.2]);
});

test("the panel ranges match the engine's parameter table", () => {
  const { panel, state } = setup();
  for (const c of panel.CONTROLS.filter((c) => c.type === "slider")) {
    const spec = state.paramSpecs[c.key];
    assert.equal(`${c.min} ${c.max} ${c.step}`, `${spec.min} ${spec.max} ${spec.step}`, c.key);
  }
});

test("every colour is set with four components", () => {
  const { panel, mgraphics } = setup({ values: { driftMpe: 1, driftShape: 1 } });
  const calls = [];
  mgraphics.set_source_rgba = (...args) => calls.push(args);
  panel.paint();
  assert.ok(calls.length > 0);
  for (const args of calls) assert.equal(args.length, 4);
});
