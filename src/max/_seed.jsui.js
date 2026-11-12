autowatch = 1;
inlets = 1;
outlets = 0;

mgraphics.init();
mgraphics.relative_coords = 0;
mgraphics.autofill = 0;

var STATE = new Global("GLOBAL_STATE");

var WIDTH = 80;
var MARGIN = 4;
var INSET = 6;
var CORNER = 6;
var GAP = 4;
var ROW_H = 14;
var LABEL_H = 11;
var FIELD_H = 14;
var SWITCH_W = 18;
var SWITCH_H = 10;
var MAX_SEED = 16777215;
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
    { key: "freeze", label: "Freeze" },
    { key: "regenerateRhythm", label: "Rhythm" }
];
var PARAMS = ["freeze", "regenerateRhythm", "seed"];

var size = [WIDTH, 1];
var pressed = false;
var warned = {};
var listeners = {};

function setValue(key, value) {
    var obj = this.patcher && this.patcher.getnamed(key);

    if (obj) {
        obj.message(key === "seed" ? "float" : "int", value);
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

    for (var i = 0; i < PARAMS.length; i++) {
        obj = this.patcher.getnamed(PARAMS[i]);

        if (obj) {
            listen(PARAMS[i], obj);
            forward(PARAMS[i], obj.getvalueof());
        }
    }
}

function layout() {
    var pad = MARGIN + INSET;
    var w = size[0] - pad * 2;
    var fieldY = size[1] - pad - FIELD_H;
    var rhythmY = fieldY - LABEL_H - GAP - ROW_H;
    var freezeY = rhythmY - ROW_H;

    return {
        border: { x: MARGIN, y: MARGIN, w: size[0] - MARGIN * 2, h: size[1] - MARGIN * 2 },
        button: { x: pad, y: pad, w: w, h: freezeY - GAP - pad },
        toggles: [
            { x: pad, y: freezeY, w: w, h: ROW_H },
            { x: pad, y: rhythmY, w: w, h: ROW_H }
        ],
        labelY: fieldY - 3,
        field: { x: pad, y: fieldY, w: w, h: FIELD_H }
    };
}

// Keeps the jsui at a fixed width and lays the seed [textedit] over the field.
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
}

function inside(r, x, y) {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function regenerate() {
    if (!STATE.freeze) {
        setValue("freeze", 1);
    }

    messnamed("GENERATE_PHRASE", "generatePhrase");
}

function generate() {
    setValue("seed", Math.floor(Math.random() * (MAX_SEED + 1)));
    regenerate();
}

function submitSeed(v) {
    var n = parseInt(String(v), 10);

    if (isNaN(n) || n < 0) {
        showSeed();
        return;
    }

    setValue("seed", Math.min(n, MAX_SEED));
    regenerate();
}

function showSeed() {
    messnamed("SEED_UI", "set", STATE.seed);
}

function text() {
    submitSeed(arguments[arguments.length - 1]);
}

function seed() {
    submitSeed(arguments[arguments.length - 1]);
}

function msg_int(v) {
    submitSeed(v);
}

function msg_float(v) {
    submitSeed(v);
}

function anything() {
    submitSeed(arguments.length ? arguments[arguments.length - 1] : messagename);
}

function onclick(x, y) {
    var l = layout();

    if (inside(l.button, x, y)) {
        pressed = true;
        generate();
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

function paintButton(r) {
    mgraphics.set_line_width(1);
    color(COLOR_ACCENT, pressed ? 1 : 0.15);
    rounded(r, 4);
    mgraphics.fill();
    color(COLOR_ACCENT);
    rounded(r, 4);
    mgraphics.stroke();
    color(pressed ? COLOR_BG : COLOR_VALUE);
    centeredText("Generate", r.x + r.w / 2, r.y + r.h / 2);
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

    color(COLOR_LABEL);
    mgraphics.move_to(l.field.x, l.labelY);
    mgraphics.show_text("Seed");
    mgraphics.set_line_width(1);
    color(COLOR_TRACK);
    rounded(l.field, 3);
    mgraphics.stroke();

    color(COLOR_BORDER);
    rounded(l.border, CORNER);
    mgraphics.stroke();
}

function onStateChanged(key) {
    if (key === "seed") {
        showSeed();
    }

    mgraphics.redraw();
}

function loadbang() {
    bind();
    fit();
    showSeed();
}

bind();
fit();
