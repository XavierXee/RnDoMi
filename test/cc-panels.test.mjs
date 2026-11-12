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
        value: key in values ? values[key] : max.state[key],
        listeners: [],
        getvalueof() { return typeof this.value === "boolean" ? Number(this.value) : this.value; },
        message(type, value) {
          this.value = value;
          this.listeners.forEach((fn) => fn({ value: [value] }));
        },
      };
    }
    return objects[key];
  }
  const patcher = { getnamed: (key) => (named ? object(key) : null) };
  const mgraphics = { size: [420, 169], init() {}, redraw() {}, text_measure: () => [30, 9] };
  for (const fn of ["set_source_rgba", "rectangle", "rectangle_rounded", "ellipse", "fill", "stroke", "set_line_width",
    "move_to", "line_to", "show_text", "select_font_face", "set_font_size"]) mgraphics[fn] = () => {};
  const panel = max.load("src/max/_cc.jsui.js", { mgraphics, patcher, MaxobjListener });
  panel.paint();
  const cell = (id) => panel.layout().cells.find((c) => c.slot.id === id);
  const line = (c) => c.lineY - 3;
  return { max, panel, state: max.state, objects, cell, line, mgraphics };
}

const at = (c, v) => c.x0 + (v - 1) / 126 * (c.x1 - c.x0);

test("lays out 4 envelopes on the left and 4 random slots on the right", () => {
  const { panel } = setup();
  const cells = panel.layout().cells;
  assert.equal(cells.length, 8);
  const envX = new Set(cells.filter((c) => c.slot.envelope).map((c) => c.x));
  const rndX = new Set(cells.filter((c) => !c.slot.envelope).map((c) => c.x));
  assert.equal(envX.size, 1);
  assert.equal(rndX.size, 1);
  assert.ok([...rndX][0] > [...envX][0]);
});

test("the dot toggles a slot on and off", () => {
  const { panel, state, cell, line } = setup();
  const c = cell("env2");
  panel.onclick(c.x + 3, line(c));
  assert.equal(state.env2On, true);
  panel.onclick(c.x + 3, line(c));
  assert.equal(state.env2On, false);
});

test("the master switch turns every CC off", () => {
  const { panel, state } = setup();
  const m = panel.layout().master;
  panel.onclick(m.x + m.w / 2, m.y + m.h / 2);
  assert.equal(state.ccOn, false);
});

test("clicking the shape cycles through the envelope shapes", () => {
  const { panel, state, cell, line } = setup();
  const c = cell("env1");
  const x = panel.shapeArea(c).x + 2;
  for (let i = 0; i < 5; i++) panel.onclick(x, line(c));
  assert.equal(state.env1Shape, 0);
  panel.onclick(x, line(c));
  assert.equal(state.env1Shape, 1);
  panel.onwheel(x, line(c), 0, -1);
  assert.equal(state.env1Shape, 0);
});

test("dragging the CC number up and down changes it within 0-127", () => {
  const { panel, state, cell, line } = setup();
  const c = cell("rnd1");
  const x = panel.ccArea(c).x + 2;
  const start = state.rnd1Cc;
  panel.onclick(x, line(c));
  panel.ondrag(x, line(c) - 30, 1);
  assert.equal(state.rnd1Cc, start + 10);
  panel.ondrag(x, line(c) - 3000, 1);
  assert.equal(state.rnd1Cc, 127);
  panel.onwheel(x, line(c), 0, -1);
  assert.equal(state.rnd1Cc, 126);
});

test("the range slider moves the nearer handle without crossing", () => {
  const { panel, state, cell } = setup({ values: { env3Min: 20, env3Max: 40 } });
  const c = cell("env3");
  panel.onclick(at(c, 100), c.trackY);
  assert.equal(state.env3Max, 100);
  panel.ondrag(at(c, 1), c.trackY, 1);
  assert.equal(state.env3Max, 20);
  assert.equal(state.env3Min, 20);
});

test("dragging inside the range moves it as a whole", () => {
  const { panel, state, cell } = setup({ values: { rnd4Min: 20, rnd4Max: 40 } });
  const c = cell("rnd4");
  panel.onclick(at(c, 30), c.trackY);
  panel.ondrag(at(c, 40), c.trackY, 1);
  assert.deepEqual([state.rnd4Min, state.rnd4Max], [30, 50]);
});

test("restored values reach the engine on load", () => {
  const { state } = setup({ values: { env1On: 1, env1Shape: 3, env1Cc: 74, rnd2Min: 12, ccOn: 0 } });
  assert.equal(state.env1On, true);
  assert.equal(state.env1Shape, 3);
  assert.equal(state.env1Cc, 74);
  assert.equal(state.rnd2Min, 12);
  assert.equal(state.ccOn, false);
});

test("every colour is set with four components", () => {
  const { panel, state, mgraphics } = setup({ values: { env1On: 1, rnd1On: 1 } });
  state.ccValues = { env1: 64, rnd1: 10 };
  panel.onCurrentStepChanged(3);
  const calls = [];
  mgraphics.set_source_rgba = (...args) => calls.push(args);
  panel.paint();
  assert.ok(calls.length > 0);
  for (const args of calls) assert.equal(args.length, 4);
});
