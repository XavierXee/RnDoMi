import { test } from "node:test";
import assert from "node:assert/strict";
import { createMax } from "./max-sandbox.mjs";

function setup(file, { values = {}, named = true } = {}) {
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
  const mgraphics = { size: [220, 169], init() {}, redraw() {}, text_measure: () => [30, 9] };
  for (const fn of ["set_source_rgba", "rectangle", "rectangle_rounded", "ellipse", "fill", "stroke", "set_line_width",
    "move_to", "line_to", "show_text", "select_font_face", "set_font_size"]) mgraphics[fn] = () => {};
  const tasks = [];
  function Task(fn) {
    this.running = false;
    this.repeat = () => { this.running = true; };
    this.cancel = () => { this.running = false; };
    tasks.push(this);
  }
  const panel = max.load(file, { mgraphics, patcher, MaxobjListener, Task });
  let time = 0;
  panel.now = () => time;
  const setTime = (t) => { time = t; };
  panel.paint();
  const cell = (id) => panel.layout().cells.find((c) => c.slot.id === id);
  const line = (c) => c.lineY - 3;
  return { max, panel, state: max.state, objects, cell, line, mgraphics, animation: tasks[0], setTime };
}

const at = (c, v) => c.x0 + (v - 1) / 126 * (c.x1 - c.x0);
const ENV = "src/max/_envelopes.jsui.js";
const RND = "src/max/_randomCc.jsui.js";


const ccKey = (prefix, n) => (prefix === "env" ? `env${n}Cc` : `rndCc${n}Number`);

for (const [file, prefix, master] of [[ENV, "env", "envOn"], [RND, "rndCc", "rndCcOn"]]) {
  test(`${prefix}: lays out 4 slots in one column`, () => {
    const { panel } = setup(file);
    const cells = panel.layout().cells;
    assert.equal(cells.map((c) => c.slot.id).join(), [1, 2, 3, 4].map((n) => prefix + n).join());
    assert.equal(new Set(cells.map((c) => c.x)).size, 1);
  });

  test(`${prefix}: the dot toggles a slot on and off`, () => {
    const { panel, state, cell, line } = setup(file);
    const c = cell(prefix + "2");
    panel.onclick(c.x + 3, line(c));
    assert.equal(state[prefix + "2On"], true);
    panel.onclick(c.x + 3, line(c));
    assert.equal(state[prefix + "2On"], false);
  });

  test(`${prefix}: the master switch turns the whole panel off`, () => {
    const { panel, state } = setup(file);
    const m = panel.layout().master;
    panel.onclick(m.x + m.w / 2, m.y + m.h / 2);
    assert.equal(state[master], false);
  });

  test(`${prefix}: dragging the CC number changes it within 0-127`, () => {
    const { panel, state, cell, line } = setup(file);
    const c = cell(prefix + "1");
    const x = panel.ccArea(c).x + 2;
    const key = ccKey(prefix, 1);
    const start = state[key];
    panel.onclick(x, line(c));
    panel.ondrag(x, line(c) - 30, 1);
    assert.equal(state[key], start + 10);
    panel.ondrag(x, line(c) - 3000, 1);
    assert.equal(state[key], 127);
    panel.onwheel(x, line(c), 0, -1);
    assert.equal(state[key], 126);
  });

  test(`${prefix}: the range slider moves the nearer handle without crossing`, () => {
    const { panel, state, cell } = setup(file, { values: { [prefix + "3Min"]: 20, [prefix + "3Max"]: 40 } });
    const c = cell(prefix + "3");
    panel.onclick(at(c, 100), c.trackY);
    assert.equal(state[prefix + "3Max"], 100);
    panel.ondrag(at(c, 1), c.trackY, 1);
    assert.equal(state[prefix + "3Max"], 20);
    assert.equal(state[prefix + "3Min"], 20);
  });

  test(`${prefix}: dragging inside the range moves it as a whole`, () => {
    const { panel, state, cell } = setup(file, { values: { [prefix + "4Min"]: 20, [prefix + "4Max"]: 40 } });
    const c = cell(prefix + "4");
    panel.onclick(at(c, 30), c.trackY);
    panel.ondrag(at(c, 40), c.trackY, 1);
    assert.deepEqual([state[prefix + "4Min"], state[prefix + "4Max"]], [30, 50]);
  });

  test(`${prefix}: restored values reach the engine on load`, () => {
    const { state } = setup(file, { values: { [prefix + "1On"]: 1, [ccKey(prefix, 1)]: 74, [prefix + "2Min"]: 12, [master]: 0 } });
    assert.equal(state[prefix + "1On"], true);
    assert.equal(state[ccKey(prefix, 1)], 74);
    assert.equal(state[prefix + "2Min"], 12);
    assert.equal(state[master], false);
  });

  test(`${prefix}: every colour is set with four components`, () => {
    const { panel, state, mgraphics } = setup(file, { values: { [prefix + "1On"]: 1 } });
    state.ccValues = { [prefix + "1"]: 64 };
    if (panel.onCurrentStepChanged) panel.onCurrentStepChanged(3);
    const calls = [];
    mgraphics.set_source_rgba = (...args) => calls.push(args);
    panel.paint();
    assert.ok(calls.length > 0);
    for (const args of calls) assert.equal(args.length, 4);
  });
}

test("the random panel only binds its own parameters", () => {
  const { objects } = setup(RND);
  assert.equal(Object.keys(objects).sort().join(), ["rndCcOn", ...[1, 2, 3, 4].flatMap((n) =>
    [`rndCc${n}On`, `rndCc${n}Number`, `rndCc${n}Min`, `rndCc${n}Max`])].sort().join());
  assert.ok(!Object.keys(objects).some((k) => k.endsWith("Shape")));
});

test("clicking the shape cycles through every envelope shape", () => {
  const { panel, state, cell, line } = setup(ENV);
  const c = cell("env1");
  const x = panel.shapeArea(c).x + 2;
  const count = state.envelopeShapes.length;
  assert.equal(count, 11);
  for (let i = 0; i < count; i++) panel.onclick(x, line(c));
  assert.equal(state.env1Shape, 0);
  panel.onclick(x, line(c));
  assert.equal(state.env1Shape, 1);
  panel.onwheel(x, line(c), 0, -1);
  assert.equal(state.env1Shape, 0);
  panel.onwheel(x, line(c), 0, -1);
  assert.equal(state.env1Shape, count - 1);
});

test("every shape has a label and the preview matches the engine", () => {
  const { panel, max, state } = setup(ENV);
  const cc = max.load("src/core/_cc.js");
  state.envelopeShapes.forEach((name, i) => {
    assert.ok(panel.SHAPE_LABELS[name], name);
    for (const p of [0, 0.1, 0.25, 0.5, 0.7, 0.99]) assert.equal(panel.shapeAt(i, p), cc.shapeValue(i, p), `${name} at ${p}`);
  });
});

test("the random panel indicator flashes on each sent note and fades out", () => {
  const { panel, animation, setTime } = setup(RND);
  assert.equal(panel.flashLevel(0), 0);
  setTime(1000);
  panel.onRandomSent();
  assert.equal(animation.running, true);
  assert.equal(panel.flashLevel(1000), 1);
  assert.ok(panel.flashLevel(1100) > 0 && panel.flashLevel(1100) < 1);
  setTime(1200);
  panel.animate();
  assert.equal(panel.flashLevel(1200), 0);
  assert.equal(animation.running, false);
});

test("the indicator is drawn right after the title", () => {
  const { panel, mgraphics, setTime } = setup(RND);
  const ellipses = [];
  mgraphics.ellipse = (...a) => ellipses.push(a);
  setTime(10);
  panel.onRandomSent();
  panel.paint();
  const l = panel.layout();
  const ring = ellipses[0];
  assert.ok(ring[0] > l.titleX + 30);
  assert.ok(ring[1] + ring[3] <= l.cells[0].y);
});
