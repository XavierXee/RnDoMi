autowatch = 1;
inlets = 1;
outlets = 0;

mgraphics.init();
mgraphics.relative_coords = 0;
mgraphics.autofill = 0;

var STATE = new Global("GLOBAL_STATE");

var ROWS = 12;
var COLUMNS = 2;
var BLACK_KEYS = { 1: true, 3: true, 6: true, 8: true, 10: true };
var MARGIN = 4;
var INSET = 4;
var COLUMN_WIDTH = 12;
var CORNER = 6;
var COLOR_BG = [0.12, 0.12, 0.12, 1];
var COLOR_BORDER = [1, 1, 1, 1];
var COLOR_KEY_OFF = [1, 1, 1, 0.12];
var COLOR_KEY_PLAYING = [1, 1, 1, 1];
var COLOR_EMPTY = [1, 1, 1, 0.08];
var COLOR_ACCENT = [0.35, 0.85, 1];

var currentStep = -1;
var size = [1, 1];

function mod(n, m) {
    return ((n % m) + m) % m;
}

function currentScale() {
    return (STATE.noteLists && STATE.noteLists[STATE.scaleName]) || [];
}

function scaleRows() {
    var rows = {};
    var scale = currentScale();

    for (var i = 0; i < scale.length; i++) {
        rows[mod(STATE.root + scale[i], ROWS)] = true;
    }

    return rows;
}

function playingPitchClass() {
    var note = STATE.phrase && STATE.phrase[currentStep];

    return note ? mod(note.pitch, ROWS) : -1;
}

function toggleKey(pitchClass) {
    var interval = mod(pitchClass - STATE.root, ROWS);
    var scale = currentScale();
    var next = [];
    var found = false;

    for (var i = 0; i < scale.length; i++) {
        if (mod(scale[i], ROWS) === interval) {
            found = true;
        } else {
            next.push(scale[i]);
        }
    }

    if (!found) {
        next.push(interval);
        next.sort(function (a, b) { return a - b; });
    }

    if (!next.length) {
        return;
    }

    STATE.noteLists.custom = next;
    STATE.scaleName = "custom";

    messnamed("SCALE_UI", "set", Object.keys(STATE.noteLists).indexOf("custom"));
    messnamed("STATE_CHANGED", "onStateChanged", "scaleName");
    messnamed("SAVE_STATE", "saveState");
    mgraphics.redraw();
}

// Fixed width; only the height follows the jsui, so it matches the grid's keyboard at the same height.
function layout() {
    var rh = (size[1] - (MARGIN + INSET) * 2) / ROWS;

    return {
        box: { x: MARGIN, y: MARGIN, w: COLUMN_WIDTH * COLUMNS + INSET * 2, h: size[1] - MARGIN * 2 },
        left: MARGIN + INSET,
        bottom: MARGIN + INSET + rh * ROWS,
        cw: COLUMN_WIDTH,
        rh: rh,
        dotRadius: Math.min(COLUMN_WIDTH, rh) * 0.36 * 0.25
    };
}

function fit() {
    var width = COLUMN_WIDTH * COLUMNS + (INSET + MARGIN) * 2;
    var attrs = ["patching_rect", "presentation_rect"];
    var rect;

    if (!this.box) {
        return;
    }

    for (var i = 0; i < attrs.length; i++) {
        rect = this.box.getattr(attrs[i]);

        if (rect && rect[2] !== width) {
            this.box.setattr(attrs[i], rect[0], rect[1], width, rect[3]);
        }
    }
}

function loadbang() {
    fit();
}

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

function paint() {
    size = [mgraphics.size[0], mgraphics.size[1]];

    var l = layout();
    var inScale = scaleRows();
    var playing = playingPitchClass();
    var rootClass = mod(STATE.root, ROWS);
    var radius = l.dotRadius;
    var pc, cx, cy;

    color(COLOR_BG);
    mgraphics.rectangle(0, 0, size[0], size[1]);
    mgraphics.fill();

    for (pc = 0; pc < ROWS; pc++) {
        cx = l.left + (BLACK_KEYS[pc] ? 0.5 : 1.5) * l.cw;
        cy = l.bottom - (pc + 0.5) * l.rh;

        color(COLOR_EMPTY);
        dot(l.left + (BLACK_KEYS[pc] ? 1.5 : 0.5) * l.cw, cy, radius);

        if (pc === playing) {
            color(COLOR_KEY_PLAYING);
        } else if (inScale[pc]) {
            color(COLOR_ACCENT);
        } else {
            color(COLOR_KEY_OFF);
        }

        dot(cx, cy, radius);

        if (pc === rootClass) {
            color(COLOR_ACCENT);
            mgraphics.set_line_width(1);
            mgraphics.ellipse(cx - radius - 2.5, cy - radius - 2.5, radius * 2 + 5, radius * 2 + 5);
            mgraphics.stroke();
        }
    }

    color(COLOR_BORDER);
    mgraphics.set_line_width(1);
    mgraphics.rectangle_rounded(l.box.x + 0.5, l.box.y + 0.5, l.box.w - 1, l.box.h - 1, CORNER * 2, CORNER * 2);
    mgraphics.stroke();
}

function onclick(x, y) {
    var l = layout();
    var row = Math.floor((l.bottom - y) / l.rh);

    if (row < 0 || row >= ROWS || x < l.box.x || x >= l.box.x + l.box.w) {
        return;
    }

    toggleKey(row);
}
onclick.local = 1;

function onPhraseGenerated() {
    mgraphics.redraw();
}

function onCurrentStepChanged(step) {
    currentStep = step;
    mgraphics.redraw();
}

function onStateChanged() {
    mgraphics.redraw();
}

fit();
