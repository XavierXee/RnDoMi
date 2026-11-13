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
var HEADER_H = 14;
var HANDLE = 3.5;
var SWITCH_W = 18;
var SWITCH_H = 10;
var FONT = "Arial";
var FONT_SIZE = 9;
var SHAPES = ["static", "glide"];

var COLOR_BG = [0.12, 0.12, 0.12, 1];
var COLOR_BORDER = [1, 1, 1, 1];
var COLOR_LABEL = [1, 1, 1, 0.55];
var COLOR_VALUE = [1, 1, 1, 0.9];
var COLOR_TRACK = [1, 1, 1, 0.22];
var COLOR_ACCENT = [0.35, 0.85, 1, 1];

var CONTROLS = [
    { key: "bendRange", label: "Bend Range", type: "slider", min: 1, max: 48, step: 1, format: function (v) { return "±" + v + " st"; } },
    { key: "driftShape", label: "Shape", type: "choice", items: SHAPES },
    { key: "driftMpe", label: "MPE", type: "toggle" },
    { key: "driftDistribution", label: "Distribution", type: "slider", min: 0, max: 1, step: 0.01, format: distributionText }
];

var size = [1, 1];
var drag = null;
var warned = {};
var listeners = {};

function distributionText(v) {
    if (v <= 0) {
        return "uniform";
    }

    if (v >= 1) {
        return "weighted";
    }

    return Math.round(v * 100) + "% weighted";
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function quantize(control, v) {
    var steps = Math.round((v - control.min) / control.step);

    return clamp(+(control.min + steps * control.step).toFixed(4), control.min, control.max);
}

function valueText(control) {
    var v = STATE[control.key];

    if (control.type === "toggle") {
        return v ? "on" : "off";
    }

    if (control.type === "choice") {
        return control.items[v || 0];
    }

    return control.format(v);
}

function setValue(key, value) {
    var obj = this.patcher && this.patcher.getnamed(key);

    if (obj) {
        obj.message(value % 1 !== 0 ? "float" : "int", value);
        return;
    }

    if (!warned[key]) {
        warned[key] = true;
        post("_drift.jsui.js: no object named " + key + ", value not saved\n");
    }

    messnamed("SET_PARAM", "setParam", key, value);
}

function forward(key, value) {
    messnamed("SET_PARAM", "setParam", key, value && typeof value === "object" ? value[0] : value);
}

function listen(key, obj) {
    listeners[key] = new MaxobjListener(obj, function (data) {
        forward(key, data.value);
    });
}

function bind() {
    var obj;

    if (!this.patcher) {
        return;
    }

    for (var i = 0; i < CONTROLS.length; i++) {
        obj = this.patcher.getnamed(CONTROLS[i].key);

        if (obj) {
            listen(CONTROLS[i].key, obj);
            forward(CONTROLS[i].key, obj.getvalueof());
        }
    }
}

function layout() {
    var pad = MARGIN + INSET;
    var w = size[0] - pad * 2;
    var rh = (size[1] - pad * 2 - HEADER_H) / CONTROLS.length;
    var cells = [];
    var y;

    for (var i = 0; i < CONTROLS.length; i++) {
        y = pad + HEADER_H + i * rh;
        cells.push({
            control: CONTROLS[i],
            x: pad,
            y: y,
            w: w,
            h: rh,
            lineY: y + FONT_SIZE,
            trackY: y + rh * 0.68,
            x0: pad + HANDLE,
            x1: pad + w - HANDLE
        });
    }

    return {
        border: { x: MARGIN, y: MARGIN, w: size[0] - MARGIN * 2, h: size[1] - MARGIN * 2 },
        titleX: pad,
        headerY: pad + FONT_SIZE,
        cells: cells
    };
}

function cellAt(x, y) {
    var cells = layout().cells;

    for (var i = 0; i < cells.length; i++) {
        var c = cells[i];
        if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) {
            return c;
        }
    }

    return null;
}

function positionOf(cell, v) {
    var c = cell.control;

    return cell.x0 + (v - c.min) / (c.max - c.min) * (cell.x1 - cell.x0);
}

function valueAt(cell, x) {
    var c = cell.control;

    return quantize(c, c.min + clamp((x - cell.x0) / (cell.x1 - cell.x0), 0, 1) * (c.max - c.min));
}

function choiceAt(cell, x) {
    var items = cell.control.items;

    return clamp(Math.floor((x - cell.x) / cell.w * items.length), 0, items.length - 1);
}

function press(cell, x) {
    var c = cell.control;

    if (c.type === "toggle") {
        setValue(c.key, STATE[c.key] ? 0 : 1);
        return null;
    }

    if (c.type === "choice") {
        setValue(c.key, choiceAt(cell, x));
        return null;
    }

    setValue(c.key, valueAt(cell, x));
    return { cell: cell };
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
        setValue(drag.cell.control.key, valueAt(drag.cell, x));
        mgraphics.redraw();
    }
}
ondrag.local = 1;

function onwheel(x, y, dx, dy) {
    var cell = cellAt(x, y);
    var c;

    if (!cell || !dy) {
        return;
    }

    c = cell.control;

    if (c.type === "slider") {
        setValue(c.key, quantize(c, STATE[c.key] + (dy > 0 ? 1 : -1) * c.step));
        mgraphics.redraw();
    }
}
onwheel.local = 1;

function color(c, alpha) {
    mgraphics.set_source_rgba(c[0], c[1], c[2], alpha !== undefined ? alpha : (c.length > 3 ? c[3] : 1));
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

function centeredText(str, cx, y) {
    mgraphics.move_to(cx - mgraphics.text_measure(str)[0] / 2, y);
    mgraphics.show_text(str);
}

function paintSlider(cell) {
    var v = STATE[cell.control.key];

    color(COLOR_TRACK);
    mgraphics.set_line_width(1);
    mgraphics.move_to(cell.x0, cell.trackY);
    mgraphics.line_to(cell.x1, cell.trackY);
    mgraphics.stroke();

    color(COLOR_ACCENT);
    mgraphics.set_line_width(2);
    mgraphics.move_to(cell.x0, cell.trackY);
    mgraphics.line_to(positionOf(cell, v), cell.trackY);
    mgraphics.stroke();
    dot(positionOf(cell, v), cell.trackY, HANDLE);
}

function paintChoice(cell) {
    var items = cell.control.items;
    var selected = STATE[cell.control.key] || 0;
    var w = cell.w / items.length;
    var h = SWITCH_H + 2;
    var top = cell.trackY - h / 2;

    mgraphics.set_line_width(1);

    for (var i = 0; i < items.length; i++) {
        color(i === selected ? COLOR_ACCENT : COLOR_TRACK);
        mgraphics.rectangle_rounded(cell.x + i * w + 0.5, top, w - 1, h, 4, 4);
        mgraphics.stroke();
        color(i === selected ? COLOR_VALUE : COLOR_LABEL);
        centeredText(items[i], cell.x + (i + 0.5) * w, top + h - 3);
    }
}

function paintToggle(cell) {
    var on = !!STATE[cell.control.key];
    var x = cell.x0;
    var cy = cell.trackY;
    var knob = SWITCH_H / 2 - 2;

    mgraphics.set_line_width(1);
    color(on ? COLOR_ACCENT : COLOR_TRACK);
    mgraphics.rectangle_rounded(x, cy - SWITCH_H / 2, SWITCH_W, SWITCH_H, SWITCH_H, SWITCH_H);
    mgraphics.stroke();
    color(on ? COLOR_ACCENT : COLOR_VALUE);
    dot(on ? x + SWITCH_W - knob - 2 : x + knob + 2, cy, knob);
}

var PAINTERS = { slider: paintSlider, choice: paintChoice, toggle: paintToggle };

function paint() {
    size = [mgraphics.size[0], mgraphics.size[1]];

    var l = layout();
    var cell;

    color(COLOR_BG);
    mgraphics.rectangle(0, 0, size[0], size[1]);
    mgraphics.fill();

    mgraphics.select_font_face(FONT);
    mgraphics.set_font_size(FONT_SIZE);

    color(COLOR_VALUE);
    text("Drift", l.titleX, l.headerY);
    color(COLOR_LABEL);
    text(Math.round((STATE.drift || 0) * 100) + "%", l.border.x + l.border.w - INSET, l.headerY, true);

    for (var i = 0; i < l.cells.length; i++) {
        cell = l.cells[i];
        color(COLOR_LABEL);
        text(cell.control.label, cell.x, cell.lineY);
        color(COLOR_VALUE);
        text(valueText(cell.control), cell.x + cell.w, cell.lineY, true);
        PAINTERS[cell.control.type](cell);
    }

    color(COLOR_BORDER);
    mgraphics.set_line_width(1);
    mgraphics.rectangle_rounded(l.border.x + 0.5, l.border.y + 0.5, l.border.w - 1, l.border.h - 1, CORNER * 2, CORNER * 2);
    mgraphics.stroke();
}

function onStateChanged() {
    mgraphics.redraw();
}

function loadbang() {
    bind();
}

bind();
