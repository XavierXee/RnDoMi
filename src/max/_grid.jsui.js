autowatch = 1;
inlets = 1;
outlets = 0;

mgraphics.init();
mgraphics.relative_coords = 0;
mgraphics.autofill = 0;

var STATE = new Global("GLOBAL_STATE");

var ROWS = 12;
var FRAME_MS = 33;
var MARGIN = 4;
var INSET = 4;
var CORNER = 6;
var COLOR_BG = [0.12, 0.12, 0.12, 1];
var COLOR_BORDER = [1, 1, 1, 1];
var COLOR_EMPTY = [1, 1, 1, 0.08];
var COLOR_EMPTY_SCALE = [1, 1, 1, 0.22];
var COLOR_NOTE = [1, 0.65, 0.2];
var COLOR_ACCENT = [0.35, 0.85, 1];
var COLOR_PLAYHEAD = [1, 1, 1, 0.05];

var currentStep = -1;
var size = [1, 1];
var halos = [];

var animation = new Task(animate, this);
animation.interval = FRAME_MS;

function now() {
    return new Date().getTime();
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);

    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function mod(n, m) {
    return ((n % m) + m) % m;
}

function noteRow(note) {
    return mod(note.pitch, ROWS);
}

function stepCount() {
    return STATE.phraseLength || 16;
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

function newNote(row) {
    var relativePitch = mod(row - STATE.root, ROWS);

    return {
        relativePitch: relativePitch,
        pitch: STATE.root + relativePitch + getRandomInt(STATE.octaveMin, STATE.octavesMax) * 12,
        velocity: getRandomInt(STATE.velocityMin, STATE.velocityMax),
        duration: getRandomInt(STATE.durationMin, STATE.durationMax)
    };
}

function editCell(step, row) {
    if (!STATE.phrase) {
        STATE.phrase = [];
    }

    var note = STATE.phrase[step];

    if (note && noteRow(note) === row) {
        STATE.phrase[step] = null;
    } else if (note) {
        note.pitch += row - noteRow(note);
        note.relativePitch = mod(note.pitch - STATE.root, ROWS);
    } else {
        STATE.phrase[step] = newNote(row);
    }

    if (!STATE.freeze) {
        STATE.freeze = true;
        messnamed("FREEZE_UI", "set", 1);
        messnamed("STATE_CHANGED", "onStateChanged", "freeze");
    }

    messnamed("SAVE_STATE", "saveState");
    mgraphics.redraw();
}

function layout() {
    var steps = stepCount();
    var rh = (size[1] - (MARGIN + INSET) * 2) / ROWS;
    var grid = { x: MARGIN, y: MARGIN, w: size[0] - MARGIN * 2, h: size[1] - MARGIN * 2 };
    var cw = (grid.w - INSET * 2) / steps;

    return {
        steps: steps,
        grid: grid,
        left: grid.x + INSET,
        bottom: MARGIN + INSET + rh * ROWS,
        cw: cw,
        rh: rh,
        radius: Math.min(cw, rh) * 0.36
    };
}

function haloShape(halo, t) {
    var progress = (t - halo.start) / halo.duration;

    if (progress < 0 || progress >= 1) {
        return null;
    }

    return {
        scale: 1 - progress,
        alpha: (1 - progress) * (0.25 + 0.5 * halo.velocity / 127)
    };
}

function startHalo(step) {
    var note = STATE.phrase && STATE.phrase[step];

    if (!note || !note.duration) {
        return;
    }

    halos.push({
        step: step,
        row: noteRow(note),
        velocity: note.velocity,
        duration: note.duration,
        start: now()
    });

    if (!animation.running) {
        animation.repeat();
    }
}

function animate() {
    var t = now();
    var alive = [];

    for (var i = 0; i < halos.length; i++) {
        if (haloShape(halos[i], t)) {
            alive.push(halos[i]);
        }
    }

    halos = alive;

    if (!halos.length) {
        animation.cancel();
    }

    mgraphics.redraw();
}
animate.local = 1;

function color(c, alpha) {
    mgraphics.set_source_rgba(c[0], c[1], c[2], alpha !== undefined ? alpha : (c.length > 3 ? c[3] : 1));
}

function dot(cx, cy, radius) {
    mgraphics.ellipse(cx - radius, cy - radius, radius * 2, radius * 2);
    mgraphics.fill();
}

function paint() {
    size = [mgraphics.size[0], mgraphics.size[1]];

    var w = size[0];
    var h = size[1];
    var l = layout();
    var inScale = scaleRows();
    var t = now();
    var i, row, note, shape;

    function x(step) {
        return l.left + (step + 0.5) * l.cw;
    }

    function y(row) {
        return l.bottom - (row + 0.5) * l.rh;
    }

    color(COLOR_BG);
    mgraphics.rectangle(0, 0, w, h);
    mgraphics.fill();

    if (currentStep >= 0 && currentStep < l.steps) {
        color(COLOR_PLAYHEAD);
        mgraphics.rectangle(l.left + currentStep * l.cw, l.bottom - ROWS * l.rh, l.cw, ROWS * l.rh);
        mgraphics.fill();
    }

    for (i = 0; i < l.steps; i++) {
        for (row = 0; row < ROWS; row++) {
            color(inScale[row] ? COLOR_EMPTY_SCALE : COLOR_EMPTY);
            dot(x(i), y(row), l.radius * 0.25);
        }
    }

    for (i = 0; i < halos.length; i++) {
        shape = haloShape(halos[i], t);
        if (!shape) {
            continue;
        }

        color(COLOR_ACCENT, shape.alpha);
        dot(x(halos[i].step), y(halos[i].row), l.radius * (1 + 1.8 * shape.scale));
    }

    for (i = 0; i < l.steps; i++) {
        note = STATE.phrase && STATE.phrase[i];
        if (!note) {
            continue;
        }

        color(i === currentStep ? COLOR_ACCENT : COLOR_NOTE, 0.35 + 0.65 * note.velocity / 127);
        dot(x(i), y(noteRow(note)), l.radius);
    }

    color(COLOR_BORDER);
    mgraphics.set_line_width(1);
    border(l.grid);
}

function border(b) {
    mgraphics.rectangle_rounded(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1, CORNER * 2, CORNER * 2);
    mgraphics.stroke();
}

function onclick(x, y) {
    var l = layout();
    var row = Math.floor((l.bottom - y) / l.rh);
    var column;

    if (row < 0 || row >= ROWS) {
        return;
    }

    column = Math.floor((x - l.left) / l.cw);

    if (column >= 0 && column < l.steps) {
        editCell(column, row);
    }
}
onclick.local = 1;

function onPhraseGenerated() {
    mgraphics.redraw();
}

function onCurrentStepChanged(step) {
    currentStep = step;
    startHalo(step);
    mgraphics.redraw();
}

function onStateChanged() {
    mgraphics.redraw();
}
