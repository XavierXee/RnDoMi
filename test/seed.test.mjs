import { test } from "node:test";
import assert from "node:assert/strict";
import { createMax } from "./max-sandbox.mjs";

function rectHolder(rects) {
  return {
    rects,
    getattr: (name) => rects[name],
    setattr: (name, ...v) => { rects[name] = v; },
  };
}

function setup({ values = {}, named = true, height = 169 } = {}) {
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
        value: key in values ? values[key] : 0,
        listeners: [],
        getvalueof() { return this.value; },
        message(type, value) {
          this.value = value;
          this.listeners.forEach((fn) => fn({ value: [value] }));
        },
      };
    }
    return objects[key];
  }
  const input = rectHolder({ patching_rect: [0, 0, 50, 20], presentation_rect: [0, 0, 50, 20] });
  const patcher = { getnamed: (key) => (key === "seedInput" ? input : named ? object(key) : null) };
  const box = rectHolder({ patching_rect: [100, 200, 150, height], presentation_rect: [10, 0, 150, height] });
  const mgraphics = { size: [80, height], init() {}, redraw() {}, text_measure: () => [30, 9] };
  for (const fn of ["set_source_rgba", "rectangle", "rectangle_rounded", "ellipse", "fill", "stroke", "set_line_width",
    "move_to", "show_text", "select_font_face", "set_font_size"]) mgraphics[fn] = () => {};
  const seed = max.load("src/max/_seed.jsui.js", { mgraphics, patcher, MaxobjListener, box });
  seed.paint();
  const center = (r) => [r.x + r.w / 2, r.y + r.h / 2];
  return { max, seed, state: max.state, objects, input, box, center };
}

const generated = (max) => max.sent.filter((m) => m.receiver === "GENERATE_PHRASE").length;

test("the jsui is twice the keyboard width and keeps its height", () => {
  const { box } = setup();
  assert.deepEqual(box.rects.patching_rect, [100, 200, 80, 169]);
  assert.deepEqual(box.rects.presentation_rect, [10, 0, 80, 169]);
});

test("the seed text field is laid over the field area", () => {
  const { seed, input } = setup();
  const f = seed.layout().field;
  assert.deepEqual(input.rects.presentation_rect, [10 + f.x + 1, f.y + 1, f.w - 2, f.h - 2]);
  assert.deepEqual(input.rects.patching_rect, [100 + f.x + 1, 200 + f.y + 1, f.w - 2, f.h - 2]);
});

test("generate picks a new seed, turns freeze on and regenerates", () => {
  const { max, seed, state, objects, center } = setup();
  seed.onclick(...center(seed.layout().button));
  assert.equal(state.freeze, true);
  assert.equal(objects.freeze.value, 1);
  assert.equal(state.seed, objects.seed.value);
  assert.ok(Number.isInteger(state.seed) && state.seed >= 0 && state.seed <= 16777215);
  assert.equal(generated(max), 1);
});

test("the seed is set before the phrase is regenerated", () => {
  const { max, seed, center } = setup();
  seed.onclick(...center(seed.layout().button));
  const order = max.sent.map((m) => m.receiver);
  assert.ok(order.lastIndexOf("SET_PARAM") < order.indexOf("GENERATE_PHRASE"));
});

test("the button lights while pressed", () => {
  const { seed, center } = setup();
  seed.onclick(...center(seed.layout().button));
  assert.equal(seed.pressed, true);
  seed.ondrag(0, 0, 0);
  assert.equal(seed.pressed, false);
});

test("toggles flip freeze and rhythm regeneration", () => {
  const { seed, state, center } = setup();
  const [freeze, rhythm] = seed.layout().toggles;
  seed.onclick(...center(freeze));
  assert.equal(state.freeze, true);
  seed.onclick(...center(rhythm));
  assert.equal(state.regenerateRhythm, true);
  seed.onclick(...center(rhythm));
  assert.equal(state.regenerateRhythm, false);
});

test("typing a seed stores it and regenerates straight away", () => {
  const { max, seed, state } = setup();
  seed.text("4242");
  assert.equal(state.seed, 4242);
  assert.equal(state.freeze, true);
  assert.equal(generated(max), 1);
});

test("plain numbers from the text field are accepted too", () => {
  const { seed, state } = setup();
  seed.msg_int(31);
  assert.equal(state.seed, 31);
});

test("invalid seeds are rejected and the field is reset", () => {
  const { max, seed, state } = setup({ values: { seed: 7 } });
  max.sent.length = 0;
  seed.text("abc");
  assert.equal(state.seed, 7);
  assert.equal(generated(max), 0);
  assert.deepEqual(max.sent.at(-1), { receiver: "SEED_UI", args: ["set", 7] });
});

test("seeds above the limit are clamped", () => {
  const { seed, state } = setup();
  seed.seed(99999999);
  assert.equal(state.seed, 16777215);
});

test("restored values reach the engine on load", () => {
  const { state } = setup({ values: { seed: 123, regenerateRhythm: 1, freeze: 1 } });
  assert.equal(state.seed, 123);
  assert.equal(state.regenerateRhythm, true);
  assert.equal(state.freeze, true);
});

test("a seed change updates the text field", () => {
  const { max, seed, state } = setup();
  state.seed = 55;
  seed.onStateChanged("seed");
  assert.deepEqual(max.sent.at(-1), { receiver: "SEED_UI", args: ["set", 55] });
});

test("every colour is set with four components", () => {
  const max = setup();
  const calls = [];
  const { seed } = max;
  seed.mgraphics.set_source_rgba = (...args) => calls.push(args);
  seed.onclick(...max.center(seed.layout().button));
  seed.paint();
  assert.ok(calls.length > 0);
  for (const args of calls) assert.equal(args.length, 4);
});
