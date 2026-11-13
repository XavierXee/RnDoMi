autowatch = 1;
inlets = 1;
outlets = 0;

mgraphics.init();
mgraphics.relative_coords = 0;
mgraphics.autofill = 0;

var STATE = new Global("GLOBAL_STATE");

var WIDTH = 110;
var MARGIN = 4;
var INSET = 6;
var CORNER = 6;
var GAP = 4;
var TOGGLE_H = 16;
var FIELD_H = 20;
var FIELD_LIFT = 5;
var FIELD_GAP = 3;
var BUTTON_LINES = ["rnd", "omi"];
var ICON_W = 12;
var SWITCH_W = 18;
var SWITCH_H = 10;
var HINT_MS = 1500;
var INPUT_NAME = "seedInput";
var FONT = "Arial";
var FONT_SIZE = 9;

var COLOR_BG = [0.12, 0.12, 0.12, 1];
var COLOR_BORDER = [1, 1, 1, 1];
var COLOR_LABEL = [1, 1, 1, 0.55];
var COLOR_VALUE = [1, 1, 1, 0.9];
var COLOR_TRACK = [1, 1, 1, 0.22];
var COLOR_ACCENT = [0.35, 0.85, 1, 1];

var TOGGLES = [
    { key: "freeze", label: "Freeze phrase" },
    { key: "freezeRhythm", label: "Freeze rhythm" }
];
var PARAMS = ["freeze", "freezeRhythm"];

var size = [WIDTH, 1];
var pressed = false;
var warned = {};
var listeners = {};
var binding = false;
var lastFreeze = false;
var rhythmBeforeFreeze = null;
var hintUntil = 0;

function now() {
    return new Date().getTime();
}

function setValue(key, value) {
    var obj = this.patcher && this.patcher.getnamed(key);

    if (obj) {
        obj.message("int", value);
        return;
    }

    if (!warned[key]) {
        warned[key] = true;
        post("_seed.jsui.js: no object named " + key + ", value not saved\n");
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
    var obj;

    if (!this.patcher) {
        return;
    }

    binding = true;

    for (var i = 0; i < PARAMS.length; i++) {
        obj = this.patcher.getnamed(PARAMS[i]);

        if (obj) {
            listen(PARAMS[i], obj);
            forward(PARAMS[i], obj.getvalueof());
        }
    }

    binding = false;
    lastFreeze = !!STATE.freeze;
}

// Freezing the phrase freezes the rhythm too; unfreezing puts the rhythm toggle back as it was.
function followFreeze() {
    var frozen = !!STATE.freeze;

    if (binding || frozen === lastFreeze) {
        return;
    }

    lastFreeze = frozen;

    if (frozen) {
        rhythmBeforeFreeze = !!STATE.freezeRhythm;
        if (!STATE.freezeRhythm) {
            setValue("freezeRhythm", 1);
        }
    } else if (rhythmBeforeFreeze !== null) {
        if (!!STATE.freezeRhythm !== rhythmBeforeFreeze) {
            setValue("freezeRhythm", rhythmBeforeFreeze ? 1 : 0);
        }
        rhythmBeforeFreeze = null;
    }
}

function layout() {
    var pad = MARGIN + INSET;
    var w = size[0] - pad * 2;
    var fieldY = size[1] - pad - FIELD_H - FIELD_LIFT;
    var togglesY = fieldY - FIELD_GAP - TOGGLE_H * 2;
    var buttonH = togglesY - GAP - pad;

    // Inputs stack at the bottom; the button takes whatever height is left.
    return {
        border: { x: MARGIN, y: MARGIN, w: size[0] - MARGIN * 2, h: size[1] - MARGIN * 2 },
        button: { cx: size[0] / 2, cy: pad + buttonH / 2, r: Math.max(0, Math.min(w, buttonH) / 2) },
        toggles: [
            { x: pad, y: togglesY, w: w, h: TOGGLE_H },
            { x: pad, y: togglesY + TOGGLE_H, w: w, h: TOGGLE_H }
        ],
        field: { x: pad, y: fieldY, w: w - ICON_W - 2, h: FIELD_H },
        copy: { x: pad + w - ICON_W, y: fieldY, w: ICON_W, h: FIELD_H }
    };
}

// Keeps the jsui at a fixed width and lays the seed [textedit] over the field, which a jsui can't make editable.
function fit() {
    var attrs = ["patching_rect", "presentation_rect"];
    var input = this.patcher && this.patcher.getnamed(INPUT_NAME);
    var field, rect;

    if (!this.box) {
        return;
    }

    for (var i = 0; i < attrs.length; i++) {
        rect = this.box.getattr(attrs[i]);

        if (!rect) {
            continue;
        }

        if (rect[2] !== WIDTH) {
            this.box.setattr(attrs[i], rect[0], rect[1], WIDTH, rect[3]);
        }

        if (input) {
            size = [WIDTH, rect[3]];
            field = layout().field;
            input.setattr(attrs[i], rect[0] + field.x + 1, rect[1] + field.y + 1, field.w - 2, field.h - 2);
        }
    }

    if (input) {
        input.setattr("lines", 1);
        input.setattr("wordwrap", 0);
    }
}

function inside(r, x, y) {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function insideCircle(c, x, y) {
    return (x - c.cx) * (x - c.cx) + (y - c.cy) * (y - c.cy) <= c.r * c.r;
}

function generate() {
    if (!STATE.freeze) {
        setValue("freeze", 1);
    }

    messnamed("GENERATE_PHRASE", "newPhrase");
}

function submitCode(v) {
    var code = String(v).replace(/^\s+|\s+$/g, "");

    if (!code) {
        showCode();
        return;
    }

    messnamed("PHRASE_CODE", "load", code);
}

function showCode() {
    messnamed("SEED_UI", "set", STATE.phraseCode || "");
}

// The system clipboard isn't reachable from Max: select the code so the user can press Cmd+C.
function copyCode() {
    messnamed("SEED_UI", "select");
    hintUntil = now() + HINT_MS;
    new Task(mgraphics.redraw, mgraphics).schedule(HINT_MS);
}

function text() {
    submitCode(arguments[arguments.length - 1]);
}

function anything() {
    submitCode(arguments.length ? arguments[arguments.length - 1] : messagename);
}

function onclick(x, y) {
    var l = layout();

    if (insideCircle(l.button, x, y)) {
        pressed = true;
        generate();
    }

    if (inside(l.copy, x, y)) {
        copyCode();
    }

    for (var i = 0; i < TOGGLES.length; i++) {
        if (inside(l.toggles[i], x, y)) {
            setValue(TOGGLES[i].key, STATE[TOGGLES[i].key] ? 0 : 1);
        }
    }

    mgraphics.redraw();
}
onclick.local = 1;

function ondrag(x, y, button) {
    if (!button && pressed) {
        pressed = false;
        mgraphics.redraw();
    }
}
ondrag.local = 1;

function onresize() {
    fit();
}
onresize.local = 1;

function color(c, alpha) {
    mgraphics.set_source_rgba(c[0], c[1], c[2], alpha !== undefined ? alpha : (c.length > 3 ? c[3] : 1));
}

function dot(cx, cy, radius) {
    mgraphics.ellipse(cx - radius, cy - radius, radius * 2, radius * 2);
    mgraphics.fill();
}

function rounded(r, radius) {
    mgraphics.rectangle_rounded(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, radius * 2, radius * 2);
}

function centeredText(str, cx, cy) {
    var m = mgraphics.text_measure(str);

    mgraphics.move_to(cx - m[0] / 2, cy + m[1] / 2 - 2);
    mgraphics.show_text(str);
}

function circle(c) {
    mgraphics.ellipse(c.cx - c.r + 0.5, c.cy - c.r + 0.5, c.r * 2 - 1, c.r * 2 - 1);
}

function paintButton(c) {
    mgraphics.set_line_width(1);
    color(COLOR_ACCENT, pressed ? 1 : 0.15);
    circle(c);
    mgraphics.fill();
    color(COLOR_ACCENT);
    circle(c);
    mgraphics.stroke();
    color(pressed ? COLOR_BG : COLOR_VALUE);
    paintButtonLabel(c);
}

function paintButtonLabel(c) {
    var fontSize = Math.max(FONT_SIZE, Math.round(c.r * 0.42));
    var lineH = fontSize * 1.05;
    var top = c.cy - lineH * (BUTTON_LINES.length - 1) / 2;

    mgraphics.set_font_size(fontSize);

    for (var i = 0; i < BUTTON_LINES.length; i++) {
        centeredText(BUTTON_LINES[i], c.cx, top + i * lineH);
    }

    mgraphics.set_font_size(FONT_SIZE);
}

function paintToggle(r, toggle) {
    var on = !!STATE[toggle.key];
    var sx = r.x + r.w - SWITCH_W;
    var cy = r.y + r.h / 2;
    var knob = SWITCH_H / 2 - 2;

    color(COLOR_LABEL);
    mgraphics.move_to(r.x, cy + FONT_SIZE / 2 - 1);
    mgraphics.show_text(toggle.label);

    mgraphics.set_line_width(1);
    color(on ? COLOR_ACCENT : COLOR_TRACK);
    mgraphics.rectangle_rounded(sx, cy - SWITCH_H / 2, SWITCH_W, SWITCH_H, SWITCH_H, SWITCH_H);
    mgraphics.stroke();
    color(on ? COLOR_ACCENT : COLOR_VALUE);
    dot(on ? sx + SWITCH_W - knob - 2 : sx + knob + 2, cy, knob);
}

function overlaps(a, b) {
    return a && b && a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];
}

// A [textedit] placed on top of the panel shows the code itself; otherwise the panel draws it.
function inputVisible() {
    var input = this.patcher && this.patcher.getnamed(INPUT_NAME);
    var attr;

    if (!input || !this.box) {
        return false;
    }

    attr = this.box.getattr("presentation") ? "presentation_rect" : "patching_rect";

    return !!overlaps(input.getattr(attr), this.box.getattr(attr));
}

function fitText(str, width) {
    if (mgraphics.text_measure(str)[0] <= width) {
        return str;
    }

    while (str.length > 1 && mgraphics.text_measure(str + "\u2026")[0] > width) {
        str = str.slice(0, -1);
    }

    return str + "\u2026";
}

function paintCode(r) {
    var hint = now() < hintUntil;

    if (!hint && inputVisible()) {
        return;
    }

    color(hint ? COLOR_ACCENT : COLOR_VALUE);
    mgraphics.move_to(r.x + 3, r.y + r.h / 2 + FONT_SIZE / 2 - 1);
    mgraphics.show_text(hint ? "\u2318C to copy" : fitText(STATE.phraseCode || "", r.w - 6));
}

function paintCopyIcon(r) {
    var s = 6;
    var x = r.x + (r.w - s) / 2 + 1;
    var y = r.y + (r.h - s) / 2 + 1;

    mgraphics.set_line_width(1);
    color(COLOR_LABEL);
    mgraphics.rectangle_rounded(x - 2.5, y - 2.5, s, s, 2, 2);
    mgraphics.stroke();
    color(COLOR_BG);
    mgraphics.rectangle(x, y, s, s);
    mgraphics.fill();
    color(COLOR_VALUE);
    mgraphics.rectangle_rounded(x + 0.5, y + 0.5, s, s, 2, 2);
    mgraphics.stroke();
}

function paint() {
    size = [mgraphics.size[0], mgraphics.size[1]];

    var l = layout();

    color(COLOR_BG);
    mgraphics.rectangle(0, 0, size[0], size[1]);
    mgraphics.fill();

    mgraphics.select_font_face(FONT);
    mgraphics.set_font_size(FONT_SIZE);

    paintButton(l.button);

    for (var i = 0; i < TOGGLES.length; i++) {
        paintToggle(l.toggles[i], TOGGLES[i]);
    }

    mgraphics.set_line_width(1);
    color(COLOR_TRACK);
    rounded(l.field, 3);
    mgraphics.stroke();
    paintCode(l.field);
    paintCopyIcon(l.copy);

    color(COLOR_BORDER);
    rounded(l.border, CORNER);
    mgraphics.stroke();
}

function onStateChanged(key) {
    if (key === "phraseCode") {
        showCode();
    }

    if (key === "freeze") {
        followFreeze();
    }

    mgraphics.redraw();
}

function loadbang() {
    bind();
    fit();
    showCode();
}

bind();
fit();
