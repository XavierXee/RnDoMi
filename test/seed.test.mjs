import { test } from "node:test";
import assert from "node:assert/strict";
import { createMax } from "./max-sandbox.mjs";

function rectHolder(rects, attrs = {}) {
  return {
    rects,
    getattr: (name) => (name in attrs ? attrs[name] : rects[name]),
    setattr: (name, ...v) => { rects[name] = v; },
  };
}

function setup({ values = {}, input = true, inputOnPanel = true, height = 169 } = {}) {
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
          this.value = value;
          this.listeners.forEach((fn) => fn({ value: [value] }));
        },
      };
    }
    return objects[key];
  }
  const at = inputOnPanel ? [111, 346, 58, 12] : [500, 900, 58, 12];
  const field = rectHolder({ patching_rect: at, presentation_rect: at });
  const patcher = { getnamed: (key) => (key === "seedInput" ? (input ? field : null) : object(key)) };
  const box = rectHolder({ patching_rect: [100, 200, 150, height], presentation_rect: [10, 0, 150, height] });
  const tasks = [];
  function Task(fn, owner) { this.schedule = (delay) => tasks.push({ delay, run: () => fn.call(owner) }); }
  const shown = [];
  const mgraphics = { size: [110, height], init() {}, redraw() {}, text_measure: (s) => [s.length * 5, 9],
    show_text: (s) => shown.push(s) };
  for (const fn of ["set_source_rgba", "rectangle", "rectangle_rounded", "ellipse", "fill", "stroke", "set_line_width",
    "move_to", "select_font_face", "set_font_size"]) mgraphics[fn] = () => {};
  const seed = max.load("src/max/_seed.jsui.js", { mgraphics, patcher, MaxobjListener, box, Task });
  let time = 0;
  seed.now = () => time;
  seed.paint();
  const center = (r) => [r.x + r.w / 2, r.y + r.h / 2];
  // In Max, STATE_CHANGED reaches the panel through [receive]; replay it here.
  const notify = () => {
    for (const m of max.sent.splice(0)) if (m.receiver === "STATE_CHANGED") seed.onStateChanged(m.args[1]);
  };
  return { max, seed, state: max.state, objects, field, box, center, tasks, shown, notify, setTime: (t) => { time = t; } };
}

const sent = (max, receiver) => max.sent.filter((m) => m.receiver === receiver);

test("the jsui keeps its fixed width and lays the editable text field over the code field", () => {
  const { seed, box, field } = setup({ inputOnPanel: false });
  assert.deepEqual(box.rects.patching_rect, [100, 200, 110, 169]);
  const f = seed.layout().field;
  assert.deepEqual(field.rects.patching_rect, [100 + f.x + 1, 200 + f.y + 1, f.w - 2, f.h - 2]);
  assert.deepEqual(field.rects.presentation_rect, [10 + f.x + 1, f.y + 1, f.w - 2, f.h - 2]);
});

test("the text field is kept to a single line without wrapping", () => {
  const { field } = setup();
  assert.deepEqual(field.rects.lines, [1]);
  assert.deepEqual(field.rects.wordwrap, [0]);
});

test("the inputs stack at the bottom and the button fills the space above", () => {
  const { seed } = setup();
  const l = seed.layout();
  const [phrase, rhythm] = l.toggles;
  assert.equal(rhythm.y, phrase.y + phrase.h);
  assert.equal(l.field.y - (rhythm.y + rhythm.h), 3);
  assert.equal(l.field.y + l.field.h, 169 - 10 - 5);
  assert.equal(l.button.cy - l.button.r, 10);
  assert.equal(l.button.cy + l.button.r, phrase.y - 4);
});

test("each toggle fits its label and switch on one line", () => {
  const { seed } = setup();
  for (const t of seed.layout().toggles) assert.ok("Freeze rhythm".length * 5 + 6 + 18 <= t.w);
});

test("the button reads rnd over omi and the field has no label", () => {
  const { seed, shown } = setup();
  shown.length = 0;
  seed.paint();
  const i = shown.indexOf("rnd");
  assert.equal(shown[i + 1], "omi");
  assert.ok(!shown.includes("Seed"));
});

test("clicking inside the circle generates a new phrase and freezes it", () => {
  const { max, seed, state } = setup();
  const b = seed.layout().button;
  seed.onclick(b.cx, b.cy);
  assert.equal(state.freeze, true);
  assert.equal(sent(max, "GENERATE_PHRASE").at(-1).args[0], "newPhrase");
});

test("clicking the corner outside the circle does nothing", () => {
  const { max, seed } = setup();
  const b = seed.layout().button;
  seed.onclick(b.cx - b.r + 1, b.cy - b.r + 1);
  assert.equal(sent(max, "GENERATE_PHRASE").length, 0);
});

test("toggles are labelled freeze phrase and freeze rhythm", () => {
  const { seed, shown } = setup();
  shown.length = 0;
  seed.paint();
  assert.ok(shown.includes("Freeze phrase"));
  assert.ok(shown.includes("Freeze rhythm"));
});

test("freeze rhythm on keeps the rhythm, off lets it regenerate", () => {
  const { seed, state, center } = setup();
  assert.equal(state.freezeRhythm, false);
  seed.onclick(...center(seed.layout().toggles[1]));
  assert.equal(state.freezeRhythm, true);
});

test("freezing the phrase freezes the rhythm, unfreezing restores it", () => {
  const { seed, state, center, notify } = setup({ values: { freeze: 0, freezeRhythm: 0 } });
  const [phrase] = seed.layout().toggles;
  seed.onclick(...center(phrase));
  notify();
  assert.deepEqual([state.freeze, state.freezeRhythm], [true, true]);
  seed.onclick(...center(phrase));
  notify();
  assert.deepEqual([state.freeze, state.freezeRhythm], [false, false]);
});

test("a rhythm that was already frozen stays frozen after unfreezing", () => {
  const { seed, state, center, notify } = setup({ values: { freeze: 0, freezeRhythm: 1 } });
  const [phrase] = seed.layout().toggles;
  seed.onclick(...center(phrase));
  notify();
  seed.onclick(...center(phrase));
  notify();
  assert.deepEqual([state.freeze, state.freezeRhythm], [false, true]);
});

test("restoring a frozen phrase on load does not touch the rhythm toggle", () => {
  const { state } = setup({ values: { freeze: 1, freezeRhythm: 0 } });
  assert.deepEqual([state.freeze, state.freezeRhythm], [true, false]);
});

test("the code is drawn in the field when there is no text field", () => {
  const { seed, state, shown } = setup({ input: false });
  state.phraseCode = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  shown.length = 0;
  seed.paint();
  const code = shown.find((s) => s.startsWith("ABC"));
  assert.ok(code.endsWith("…"));
  assert.ok(code.length * 5 <= seed.layout().field.w - 6);
});

test("the code is not drawn twice under a text field placed on the panel", () => {
  const { seed, state, shown } = setup({ inputOnPanel: true });
  state.phraseCode = "ABCDEF";
  shown.length = 0;
  seed.paint();
  assert.ok(!shown.some((s) => s.startsWith("ABC")));
});

test("a new code is shown in the text field", () => {
  const { max, seed, state } = setup();
  state.phraseCode = "Zz09";
  seed.onStateChanged("phraseCode");
  assert.deepEqual(sent(max, "SEED_UI").at(-1).args, ["set", "Zz09"]);
});

test("typing a code loads it", () => {
  const { max, seed } = setup();
  seed.text("  AbC-_9 ");
  assert.deepEqual(sent(max, "PHRASE_CODE").at(-1).args, ["load", "AbC-_9"]);
});

test("the copy icon selects the code and shows a Cmd+C hint for a moment", () => {
  const { max, seed, shown, tasks, setTime, center } = setup();
  setTime(1000);
  seed.onclick(...center(seed.layout().copy));
  assert.deepEqual(sent(max, "SEED_UI").at(-1).args, ["select"]);
  shown.length = 0;
  seed.paint();
  assert.ok(shown.includes("⌘C to copy"));
  assert.equal(tasks.at(-1).delay, 1500);
  setTime(2600);
  shown.length = 0;
  seed.paint();
  assert.ok(!shown.includes("⌘C to copy"));
});

test("every colour is set with four components", () => {
  const max = setup();
  const calls = [];
  max.seed.mgraphics.set_source_rgba = (...args) => calls.push(args);
  const b = max.seed.layout().button;
  max.seed.onclick(b.cx, b.cy);
  max.seed.paint();
  assert.ok(calls.length > 0);
  for (const args of calls) assert.equal(args.length, 4);
});
