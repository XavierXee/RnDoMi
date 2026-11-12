autowatch = 1;
inlets = 1;
outlets = 0;

mgraphics.init();
mgraphics.relative_coords = 0;
mgraphics.autofill = 0;

var STATE = new Global("GLOBAL_STATE");

var MARGIN = 4;
var INSET = 6;
var CORNER = 6;
var COLUMN_GAP = 14;
var ROWS_PER_COLUMN = 5;
var ARROW = 8;
var HANDLE = 3.5;
var DOT = 1.5;
var MAX_STEP_DOTS = 40;
var MENU_DRAG_PX = 6;
var FONT = "Arial";
var FONT_SIZE = 9;
var NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

var COLOR_BG = [0.12, 0.12, 0.12, 1];
var COLOR_BORDER = [1, 1, 1, 1];
var COLOR_LABEL = [1, 1, 1, 0.55];
var COLOR_VALUE = [1, 1, 1, 0.9];
var COLOR_TRACK = [1, 1, 1, 0.22];
var COLOR_DOT = [1, 1, 1, 0.22];
var COLOR_ACCENT = [0.35, 0.85, 1, 1];

var CONTROLS = [
    { key: "root", label: "Root", type: "slider", min: 0, max: 127, step: 1, format: noteName },
    { key: "scaleName", label: "Scale", type: "menu", items: scaleNames, format: prettyName },
    { keys: ["octaveMin", "octavesMax"], label: "Octave", type: "range", min: -4, max: 4, step: 1 },
    { keys: ["velocityMin", "velocityMax"], label: "Velocity", type: "range", min: 0, max: 127, step: 1 },
    { keys: ["durationMin", "durationMax"], label: "Duration", type: "range", min: 0, max: 2000, step: 10, unit: " ms", paramScale: 1000 },
    { key: "phraseLength", label: "Length", type: "slider", min: 1, max: 32, step: 1 },
    { key: "beatRate", label: "Rate", type: "slider", min: 1, max: 16, step: 1 },
    { key: "chance", label: "Chance", type: "slider", min: 1, max: 8, step: 1, format: oneIn },
    { key: "swingAmount", label: "Swing", type: "slider", min: 0, max: 1, step: 0.01, format: percent }
];

var size = [1, 1];
var drag = null;
var warned = {};
var listeners = {};

function noteName(n) {
    return NOTE_NAMES[n % 12] + (Math.floor(n / 12) - 2);
}

function prettyName(name) {
    return name.replace(/([a-z])([A-Z0-9])/g, "$1 $2").replace(/([0-9])([a-zA-Z])/g, "$1 $2").toLowerCase();
}

function oneIn(n) {
    return "1 in " + n;
}

function percent(v) {
    return Math.round(v * 100) + "%";
}

function scaleNames() {
    return STATE.noteLists ? Object.keys(STATE.noteLists) : [];
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function quantize(control, v) {
    var steps = Math.round((v - control.min) / control.step);

    return clamp(+(control.min + steps * control.step).toFixed(4), control.min, control.max);
}

function formatValue(control, v) {
    if (control.format) {
        return control.format(v);
    }

    return v + (control.unit || "");
}

function valueText(control) {
    if (control.type === "range") {
        return formatValue(control, STATE[control.keys[0]]) + " \u2013 " + formatValue(control, STATE[control.keys[1]]);
    }

    return formatValue(control, STATE[control.key]);
}

function controlFor(key) {
    for (var i = 0; i < CONTROLS.length; i++) {
        if (CONTROLS[i].key === key || (CONTROLS[i].keys && CONTROLS[i].keys.indexOf(key) >= 0)) {
            return CONTROLS[i];
        }
    }

    return null;
}

function isDiscrete(control) {
    return control.type === "menu";
}

// Hidden objects hold value / paramScale (e.g. seconds); the engine works in control units (ms).
function toObject(key, value) {
    var control = controlFor(key);

    return isDiscrete(control) ? value : value / (control.paramScale || 1);
}

function fromObject(key, value) {
    var control = controlFor(key);

    if (isDiscrete(control)) {
        return Math.round(value);
    }

    return quantize(control, value * (control.paramScale || 1));
}

function setValue(key, value) {
    var obj = this.patcher && this.patcher.getnamed(key);

    if (obj) {
        obj.message(isDiscrete(controlFor(key)) ? "int" : "float", toObject(key, value));
        return;
    }

    if (!warned[key]) {
        warned[key] = true;
        post("_controls.jsui.js: no object named " + key + ", value not automatable\n");
    }

    messnamed("SET_PARAM", "setParam", key, value);
}

function paramKeys() {
    var keys = [];

    for (var i = 0; i < CONTROLS.length; i++) {
        keys = keys.concat(CONTROLS[i].keys || [CONTROLS[i].key]);
    }

    return keys;
}

function forward(key, value) {
    messnamed("SET_PARAM", "setParam", key, fromObject(key, value && typeof value === "object" ? value[0] : value));
}

function listen(key, obj) {
    listeners[key] = new MaxobjListener(obj, function (data) {
        forward(key, data.value);
    });
}

function bind() {
    var keys = paramKeys();
    var obj;

    if (!this.patcher) {
        return;
    }

    for (var i = 0; i < keys.length; i++) {
        obj = this.patcher.getnamed(keys[i]);

        if (obj) {
            listen(keys[i], obj);
            forward(keys[i], obj.getvalueof());
        }
    }
}

function loadbang() {
    bind();
}

function layout() {
    var pad = MARGIN + INSET;
    var columns = Math.ceil(CONTROLS.length / ROWS_PER_COLUMN);
    var cw = (size[0] - pad * 2 - COLUMN_GAP * (columns - 1)) / columns;
    var rh = (size[1] - pad * 2) / ROWS_PER_COLUMN;
    var cells = [];

    for (var i = 0; i < CONTROLS.length; i++) {
        var column = Math.floor(i / ROWS_PER_COLUMN);
        var row = i % ROWS_PER_COLUMN;
        var x = pad + column * (cw + COLUMN_GAP);
        var y = pad + row * rh;
        var inner = CONTROLS[i].type === "menu" ? ARROW + HANDLE : HANDLE;

        cells.push({
            control: CONTROLS[i],
            x: x,
            y: y,
            w: cw,
            h: rh,
            trackY: y + rh * 0.72,
            x0: x + inner,
            x1: x + cw - inner
        });
    }

    return cells;
}

function cellAt(x, y) {
    var cells = layout();

    for (var i = 0; i < cells.length; i++) {
        var c = cells[i];
        if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) {
            return c;
        }
    }

    return null;
}

function positionOf(cell, v) {
    var control = cell.control;

    return cell.x0 + (v - control.min) / (control.max - control.min) * (cell.x1 - cell.x0);
}

function valueAt(cell, x) {
    var control = cell.control;
    var t = clamp((x - cell.x0) / (cell.x1 - cell.x0), 0, 1);

    return quantize(control, control.min + t * (control.max - control.min));
}

function stepCount(control) {
    return Math.round((control.max - control.min) / control.step) + 1;
}

function menuIndex(control) {
    return Math.max(0, control.items().indexOf(STATE[control.key]));
}

function selectItem(control, index) {
    var items = control.items();

    if (!items.length) {
        return;
    }

    setValue(control.key, clamp(index, 0, items.length - 1));
}

function setRange(control, lo, hi) {
    if (lo !== STATE[control.keys[0]]) {
        setValue(control.keys[0], lo);
    }

    if (hi !== STATE[control.keys[1]]) {
        setValue(control.keys[1], hi);
    }
}

function press(cell, x) {
    var control = cell.control;
    var v, lo, hi;

    if (control.type === "menu") {
        if (x < cell.x0) {
            selectItem(control, menuIndex(control) - 1);
            return null;
        }

        if (x > cell.x1) {
            selectItem(control, menuIndex(control) + 1);
            return null;
        }

        return { cell: cell, x: x, index: menuIndex(control) };
    }

    v = valueAt(cell, x);

    if (control.type === "slider") {
        setValue(control.key, v);
        return { cell: cell };
    }

    lo = STATE[control.keys[0]];
    hi = STATE[control.keys[1]];

    if (Math.abs(x - positionOf(cell, lo)) <= HANDLE * 2 || Math.abs(x - positionOf(cell, hi)) <= HANDLE * 2 || v < lo || v > hi) {
        var handle = Math.abs(v - lo) <= Math.abs(v - hi) ? 0 : 1;

        if (lo === hi) {
            handle = v < lo ? 0 : 1;
        }

        moveHandle(control, handle, v);
        return { cell: cell, handle: handle };
    }

    return { cell: cell, handle: -1, x: x, lo: lo, hi: hi };
}

function moveHandle(control, handle, v) {
    var lo = STATE[control.keys[0]];
    var hi = STATE[control.keys[1]];

    if (handle === 0) {
        setRange(control, Math.min(v, hi), hi);
    } else {
        setRange(control, lo, Math.max(v, lo));
    }
}

function move(d, x) {
    var cell = d.cell;
    var control = cell.control;
    var delta, span;

    if (control.type === "menu") {
        selectItem(control, d.index + Math.round((x - d.x) / MENU_DRAG_PX));
    } else if (control.type === "slider") {
        setValue(control.key, valueAt(cell, x));
    } else if (d.handle >= 0) {
        moveHandle(control, d.handle, valueAt(cell, x));
    } else {
        span = d.hi - d.lo;
        delta = quantize(control, control.min + (x - d.x) / (cell.x1 - cell.x0) * (control.max - control.min)) - control.min;
        delta = clamp(delta, control.min - d.lo, control.max - d.hi);
        setRange(control, d.lo + delta, d.lo + delta + span);
    }
}

function onclick(x, y) {
    var cell = cellAt(x, y);

    drag = cell ? press(cell, x) : null;
    mgraphics.redraw();
}
onclick.local = 1;

function ondrag(x, y, button) {
    if (!button) {
        drag = null;
        return;
    }

    if (drag) {
        move(drag, x);
        mgraphics.redraw();
    }
}
ondrag.local = 1;

function onwheel(x, y, dx, dy) {
    var cell = cellAt(x, y);

    if (!cell || !dy) {
        return;
    }

    var control = cell.control;
    var dir = dy > 0 ? 1 : -1;

    if (control.type === "menu") {
        selectItem(control, menuIndex(control) + dir);
    } else if (control.type === "slider") {
        setValue(control.key, quantize(control, STATE[control.key] + dir * control.step));
    }

    mgraphics.redraw();
}
onwheel.local = 1;

function color(c, alpha) {
    mgraphics.set_source_rgba(c[0], c[1], c[2], alpha !== undefined ? alpha : (c.length > 3 ? c[3] : 1));
}

function dot(cx, cy, radius) {
    mgraphics.ellipse(cx - radius, cy - radius, radius * 2, radius * 2);
    mgraphics.fill();
}

function line(xa, xb, y, width) {
    mgraphics.set_line_width(width);
    mgraphics.move_to(xa, y);
    mgraphics.line_to(xb, y);
    mgraphics.stroke();
}

function text(str, x, y, alignRight) {
    if (alignRight) {
        x -= mgraphics.text_measure(str)[0];
    }

    mgraphics.move_to(x, y);
    mgraphics.show_text(str);
}

function paintSteps(cell, lo, hi) {
    var control = cell.control;
    var n = stepCount(control);

    for (var i = 0; i < n; i++) {
        var v = control.min + i * control.step;
        color(v >= lo && v <= hi ? COLOR_ACCENT : COLOR_DOT);
        dot(positionOf(cell, v), cell.trackY, DOT);
    }
}

function paintTrack(cell, lo, hi, fromStart) {
    var control = cell.control;
    var a = positionOf(cell, fromStart ? control.min : lo);
    var b = positionOf(cell, hi);

    if (stepCount(control) <= MAX_STEP_DOTS) {
        paintSteps(cell, fromStart ? control.min : lo, hi);
    } else {
        color(COLOR_TRACK);
        line(cell.x0, cell.x1, cell.trackY, 1);
        color(COLOR_ACCENT);
        line(a, b, cell.trackY, 2);
    }
}

function paintSlider(cell) {
    var v = STATE[cell.control.key];

    paintTrack(cell, v, v, true);
    color(COLOR_ACCENT);
    dot(positionOf(cell, v), cell.trackY, HANDLE);
}

function paintRange(cell) {
    var lo = STATE[cell.control.keys[0]];
    var hi = STATE[cell.control.keys[1]];

    paintTrack(cell, lo, hi, false);
    color(COLOR_ACCENT);
    dot(positionOf(cell, lo), cell.trackY, HANDLE);
    dot(positionOf(cell, hi), cell.trackY, HANDLE);
}

function paintMenu(cell) {
    var items = cell.control.items();
    var index = menuIndex(cell.control);
    var y = cell.trackY;
    var i, cx;

    color(COLOR_VALUE);
    mgraphics.set_line_width(1);
    mgraphics.move_to(cell.x + ARROW - 3, y - 3);
    mgraphics.line_to(cell.x + 2, y);
    mgraphics.line_to(cell.x + ARROW - 3, y + 3);
    mgraphics.stroke();
    mgraphics.move_to(cell.x + cell.w - ARROW + 3, y - 3);
    mgraphics.line_to(cell.x + cell.w - 2, y);
    mgraphics.line_to(cell.x + cell.w - ARROW + 3, y + 3);
    mgraphics.stroke();

    for (i = 0; i < items.length; i++) {
        cx = cell.x0 + (items.length > 1 ? i / (items.length - 1) : 0.5) * (cell.x1 - cell.x0);
        color(i === index ? COLOR_ACCENT : COLOR_DOT);
        dot(cx, y, i === index ? HANDLE : DOT);
    }
}

var PAINTERS = { slider: paintSlider, range: paintRange, menu: paintMenu };

function paint() {
    size = [mgraphics.size[0], mgraphics.size[1]];

    var w = size[0];
    var h = size[1];
    var cells = layout();

    color(COLOR_BG);
    mgraphics.rectangle(0, 0, w, h);
    mgraphics.fill();

    mgraphics.select_font_face(FONT);
    mgraphics.set_font_size(FONT_SIZE);

    for (var i = 0; i < cells.length; i++) {
        var cell = cells[i];
        var baseline = cell.y + FONT_SIZE;

        color(COLOR_LABEL);
        text(cell.control.label, cell.x, baseline);
        color(COLOR_VALUE);
        text(valueText(cell.control), cell.x + cell.w, baseline, true);

        PAINTERS[cell.control.type](cell);
    }

    color(COLOR_BORDER);
    mgraphics.set_line_width(1);
    mgraphics.rectangle_rounded(MARGIN + 0.5, MARGIN + 0.5, w - MARGIN * 2 - 1, h - MARGIN * 2 - 1, CORNER * 2, CORNER * 2);
    mgraphics.stroke();
}

function onStateChanged() {
    mgraphics.redraw();
}

bind();
