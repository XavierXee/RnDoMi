autowatch = 1;
inlets = 1;
outlets = 0;

mgraphics.init();
mgraphics.relative_coords = 0;
mgraphics.autofill = 0;

var STATE = new Global("GLOBAL_STATE");

var ENVELOPE_SLOTS = 4;
var RANDOM_SLOTS = 4;
var MARGIN = 4;
var INSET = 6;
var CORNER = 6;
var COLUMN_GAP = 14;
var HEADER_H = 14;
var TOGGLE_W = 10;
var SHAPE_W = 44;
var CC_W = 34;
var PREVIEW_W = 24;
var HANDLE = 3.5;
var CC_DRAG_PX = 3;
var SWITCH_W = 18;
var SWITCH_H = 10;
var FONT = "Arial";
var FONT_SIZE = 9;
var SHAPE_LABELS = { sine: "sine", triangle: "triangle", sawUp: "saw up", sawDown: "saw down", square: "square" };

var COLOR_BG = [0.12, 0.12, 0.12, 1];
var COLOR_BORDER = [1, 1, 1, 1];
var COLOR_LABEL = [1, 1, 1, 0.55];
var COLOR_VALUE = [1, 1, 1, 0.9];
var COLOR_TRACK = [1, 1, 1, 0.22];
var COLOR_ACCENT = [0.35, 0.85, 1, 1];
var COLOR_OUTPUT = [1, 1, 1, 1];
var DIM = 0.35;

var size = [1, 1];
var currentStep = -1;
var drag = null;
var warned = {};
var listeners = {};

function slots() {
    var list = [];
    var n;

    for (n = 1; n <= ENVELOPE_SLOTS; n++) {
        list.push({ id: "env" + n, label: "Env " + n, envelope: true });
    }

    for (n = 1; n <= RANDOM_SLOTS; n++) {
        list.push({ id: "rnd" + n, label: "Rnd " + n, envelope: false });
    }

    return list;
}

var SLOTS = slots();

function paramKeys() {
    var keys = ["ccOn"];

    for (var i = 0; i < SLOTS.length; i++) {
        keys.push(SLOTS[i].id + "On", SLOTS[i].id + "Cc", SLOTS[i].id + "Min", SLOTS[i].id + "Max");
        if (SLOTS[i].envelope) {
            keys.push(SLOTS[i].id + "Shape");
        }
    }

    return keys;
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function shapes() {
    return STATE.envelopeShapes || ["sine"];
}

function setValue(key, value) {
    var obj = this.patcher && this.patcher.getnamed(key);

    if (obj) {
        obj.message("int", value);
        return;
    }

    if (!warned[key]) {
        warned[key] = true;
        post("_cc.jsui.js: no object named " + key + ", value not saved\n");
    }

    messnamed("SET_PARAM", "setParam", key, value);
}

function forward(key, value) {
    messnamed("SET_PARAM", "setParam", key, Math.round(value && typeof value === "object" ? value[0] : value));
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

function layout() {
    var pad = MARGIN + INSET;
    var cw = (size[0] - pad * 2 - COLUMN_GAP) / 2;
    var rows = Math.max(ENVELOPE_SLOTS, RANDOM_SLOTS);
    var rh = (size[1] - pad * 2 - HEADER_H) / rows;
    var cells = [];
    var i, column, row, x, y;

    for (i = 0; i < SLOTS.length; i++) {
        column = SLOTS[i].envelope ? 0 : 1;
        row = SLOTS[i].envelope ? i : i - ENVELOPE_SLOTS;
        x = pad + column * (cw + COLUMN_GAP);
        y = pad + HEADER_H + row * rh;

        cells.push({
            slot: SLOTS[i],
            x: x,
            y: y,
            w: cw,
            h: rh,
            lineY: y + FONT_SIZE,
            trackY: y + rh * 0.68,
            x0: x + HANDLE,
            x1: x + cw - HANDLE
        });
    }

    return {
        border: { x: MARGIN, y: MARGIN, w: size[0] - MARGIN * 2, h: size[1] - MARGIN * 2 },
        headers: [{ x: pad, label: "Envelopes" }, { x: pad + cw + COLUMN_GAP, label: "Random" }],
        headerY: pad + FONT_SIZE,
        master: { x: size[0] - pad - SWITCH_W, y: pad, w: SWITCH_W, h: SWITCH_H },
        cells: cells
    };
}

function toggleArea(cell) {
    return { x: cell.x, w: TOGGLE_W };
}

function shapeArea(cell) {
    return { x: cell.x + TOGGLE_W + 26, w: SHAPE_W };
}

function ccArea(cell) {
    var shape = shapeArea(cell);

    return { x: cell.slot.envelope ? shape.x + shape.w : shape.x, w: CC_W };
}

function previewArea(cell) {
    var cc = ccArea(cell);

    return { x: cc.x + cc.w, w: PREVIEW_W };
}

function within(area, x) {
    return x >= area.x && x < area.x + area.w;
}

function inside(r, x, y) {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function cellAt(x, y) {
    var cells = layout().cells;

    for (var i = 0; i < cells.length; i++) {
        if (inside(cells[i], x, y)) {
            return cells[i];
        }
    }

    return null;
}

function positionOf(cell, v) {
    return cell.x0 + (v - 1) / 126 * (cell.x1 - cell.x0);
}

function valueAt(cell, x) {
    return Math.round(1 + clamp((x - cell.x0) / (cell.x1 - cell.x0), 0, 1) * 126);
}

function stepShape(id, dir) {
    var count = shapes().length;

    setValue(id + "Shape", ((STATE[id + "Shape"] || 0) + dir + count) % count);
}

function setCc(id, value) {
    setValue(id + "Cc", clamp(Math.round(value), 0, 127));
}

function setRange(id, lo, hi) {
    if (lo !== STATE[id + "Min"]) {
        setValue(id + "Min", lo);
    }

    if (hi !== STATE[id + "Max"]) {
        setValue(id + "Max", hi);
    }
}

function moveHandle(id, handle, v) {
    var lo = STATE[id + "Min"];
    var hi = STATE[id + "Max"];

    if (handle === 0) {
        setRange(id, Math.min(v, hi), hi);
    } else {
        setRange(id, lo, Math.max(v, lo));
    }
}

function pressRange(cell, x) {
    var id = cell.slot.id;
    var lo = STATE[id + "Min"];
    var hi = STATE[id + "Max"];
    var v = valueAt(cell, x);
    var nearHandle = Math.abs(x - positionOf(cell, lo)) <= HANDLE * 2 || Math.abs(x - positionOf(cell, hi)) <= HANDLE * 2;
    var handle;

    if (nearHandle || v < lo || v > hi) {
        handle = Math.abs(v - lo) <= Math.abs(v - hi) ? 0 : 1;
        if (lo === hi) {
            handle = v < lo ? 0 : 1;
        }
        moveHandle(id, handle, v);
        return { cell: cell, kind: "range", handle: handle };
    }

    return { cell: cell, kind: "range", handle: -1, x: x, lo: lo, hi: hi };
}

function press(cell, x, y) {
    var id = cell.slot.id;

    if (y > cell.lineY + 3) {
        return pressRange(cell, x);
    }

    if (within(toggleArea(cell), x)) {
        setValue(id + "On", STATE[id + "On"] ? 0 : 1);
    } else if (cell.slot.envelope && within(shapeArea(cell), x)) {
        stepShape(id, 1);
    } else if (within(ccArea(cell), x)) {
        return { cell: cell, kind: "cc", y: y, value: STATE[id + "Cc"] };
    }

    return null;
}

function move(d, x, y) {
    var id = d.cell.slot.id;
    var delta, span;

    if (d.kind === "cc") {
        setCc(id, d.value + (d.y - y) / CC_DRAG_PX);
    } else if (d.handle >= 0) {
        moveHandle(id, d.handle, valueAt(d.cell, x));
    } else {
        span = d.hi - d.lo;
        delta = Math.round((x - d.x) / (d.cell.x1 - d.cell.x0) * 126);
        delta = clamp(delta, 1 - d.lo, 127 - d.hi);
        setRange(id, d.lo + delta, d.lo + delta + span);
    }
}

function onclick(x, y) {
    var cell;

    drag = null;

    if (inside(layout().master, x, y)) {
        setValue("ccOn", STATE.ccOn ? 0 : 1);
    } else {
        cell = cellAt(x, y);
        if (cell) {
            drag = press(cell, x, y);
        }
    }

    mgraphics.redraw();
}
onclick.local = 1;

function ondrag(x, y, button) {
    if (!button) {
        drag = null;
        return;
    }

    if (drag) {
        move(drag, x, y);
        mgraphics.redraw();
    }
}
ondrag.local = 1;

function onwheel(x, y, dx, dy) {
    var cell = cellAt(x, y);
    var dir = dy > 0 ? 1 : -1;

    if (!cell || !dy || y > cell.lineY + 3) {
        return;
    }

    if (cell.slot.envelope && within(shapeArea(cell), x)) {
        stepShape(cell.slot.id, dir);
    } else if (within(ccArea(cell), x)) {
        setCc(cell.slot.id, STATE[cell.slot.id + "Cc"] + dir);
    }

    mgraphics.redraw();
}
onwheel.local = 1;

function color(c, alpha) {
    mgraphics.set_source_rgba(c[0], c[1], c[2], alpha !== undefined ? alpha : (c.length > 3 ? c[3] : 1));
}

function faded(c, active) {
    color(c, (c.length > 3 ? c[3] : 1) * (active ? 1 : DIM));
}

function dot(cx, cy, radius) {
    mgraphics.ellipse(cx - radius, cy - radius, radius * 2, radius * 2);
    mgraphics.fill();
}

function text(str, x, y, alignRight) {
    if (alignRight) {
        x -= mgraphics.text_measure(str)[0];
    }

    mgraphics.move_to(x, y);
    mgraphics.show_text(str);
}

function shapeAt(index, p) {
    var name = shapes()[index] || "sine";

    if (name === "triangle") {
        return p < 0.5 ? p * 2 : 2 - p * 2;
    }

    if (name === "sawUp") {
        return p;
    }

    if (name === "sawDown") {
        return 1 - p;
    }

    if (name === "square") {
        return p < 0.5 ? 1 : 0;
    }

    return (Math.sin(p * Math.PI * 2) + 1) / 2;
}

function paintPreview(cell, active) {
    var area = previewArea(cell);
    var shape = STATE[cell.slot.id + "Shape"] || 0;
    var top = cell.y + 1;
    var h = FONT_SIZE - 1;
    var n = 16;
    var i, p;

    faded(COLOR_LABEL, active);
    mgraphics.set_line_width(1);

    for (i = 0; i <= n; i++) {
        p = i / n;
        if (i === 0) {
            mgraphics.move_to(area.x + p * area.w, top + h - shapeAt(shape, p) * h);
        } else {
            mgraphics.line_to(area.x + p * area.w, top + h - shapeAt(shape, Math.min(p, 0.9999)) * h);
        }
    }

    mgraphics.stroke();

    if (currentStep >= 0 && STATE.phraseLength) {
        p = currentStep / STATE.phraseLength;
        faded(COLOR_OUTPUT, active);
        dot(area.x + p * area.w, top + h - shapeAt(shape, p) * h, 1.5);
    }
}

function paintCell(cell) {
    var id = cell.slot.id;
    var active = !!(STATE.ccOn && STATE[id + "On"]);
    var lo = STATE[id + "Min"];
    var hi = STATE[id + "Max"];
    var output = STATE.ccValues && STATE.ccValues[id];
    var shape;

    faded(STATE[id + "On"] ? COLOR_ACCENT : COLOR_TRACK, STATE.ccOn);
    dot(cell.x + 3, cell.lineY - 3, 3);

    faded(COLOR_LABEL, active);
    text(cell.slot.label, cell.x + TOGGLE_W, cell.lineY);

    faded(COLOR_VALUE, active);
    if (cell.slot.envelope) {
        shape = shapes()[STATE[id + "Shape"] || 0];
        text(SHAPE_LABELS[shape] || shape, shapeArea(cell).x, cell.lineY);
        paintPreview(cell, active);
    }

    text("CC " + STATE[id + "Cc"], ccArea(cell).x, cell.lineY);
    text(lo + " – " + hi, cell.x + cell.w, cell.lineY, true);

    faded(COLOR_TRACK, active);
    mgraphics.set_line_width(1);
    mgraphics.move_to(cell.x0, cell.trackY);
    mgraphics.line_to(cell.x1, cell.trackY);
    mgraphics.stroke();

    faded(COLOR_ACCENT, active);
    mgraphics.set_line_width(2);
    mgraphics.move_to(positionOf(cell, lo), cell.trackY);
    mgraphics.line_to(positionOf(cell, hi), cell.trackY);
    mgraphics.stroke();
    dot(positionOf(cell, lo), cell.trackY, HANDLE);
    dot(positionOf(cell, hi), cell.trackY, HANDLE);

    if (active && output !== undefined) {
        color(COLOR_OUTPUT);
        dot(positionOf(cell, output), cell.trackY, 1.5);
    }
}

function paintSwitch(r, on) {
    var cy = r.y + r.h / 2;
    var knob = SWITCH_H / 2 - 2;

    mgraphics.set_line_width(1);
    color(on ? COLOR_ACCENT : COLOR_TRACK);
    mgraphics.rectangle_rounded(r.x, r.y, r.w, r.h, r.h, r.h);
    mgraphics.stroke();
    color(on ? COLOR_ACCENT : COLOR_VALUE);
    dot(on ? r.x + r.w - knob - 2 : r.x + knob + 2, cy, knob);
}

function paint() {
    size = [mgraphics.size[0], mgraphics.size[1]];

    var l = layout();
    var i;

    color(COLOR_BG);
    mgraphics.rectangle(0, 0, size[0], size[1]);
    mgraphics.fill();

    mgraphics.select_font_face(FONT);
    mgraphics.set_font_size(FONT_SIZE);

    for (i = 0; i < l.headers.length; i++) {
        faded(COLOR_VALUE, STATE.ccOn);
        text(l.headers[i].label, l.headers[i].x, l.headerY);
    }

    color(COLOR_LABEL);
    text("CC", l.master.x - 4, l.headerY, true);
    paintSwitch(l.master, !!STATE.ccOn);

    for (i = 0; i < l.cells.length; i++) {
        paintCell(l.cells[i]);
    }

    color(COLOR_BORDER);
    mgraphics.set_line_width(1);
    mgraphics.rectangle_rounded(l.border.x + 0.5, l.border.y + 0.5, l.border.w - 1, l.border.h - 1, CORNER * 2, CORNER * 2);
    mgraphics.stroke();
}

function onCurrentStepChanged(step) {
    currentStep = step;
    mgraphics.redraw();
}

function onStateChanged() {
    mgraphics.redraw();
}

function loadbang() {
    bind();
}

bind();
