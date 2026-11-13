autowatch = 1;
inlets = 1;
outlets = 0;

var STATE = new Global("GLOBAL_STATE");

var PITCH_BEND = 0xE0;
var CENTER = 8192;
var MAX_OFFSET = 0.5;
var MPE_FIRST = 2;
var MPE_LAST = 16;
var GLIDE_MS = 15;
var SHAPE_GLIDE = 1;

var lastBend = {};
var glides = [];
var nextMpeChannel = MPE_FIRST;

var animation = new Task(animate, this);
animation.interval = GLIDE_MS;

function now() {
    return new Date().getTime();
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

// Distribution 0 keeps the roll uniform; towards 1 most rolls land close to 0.
function shaped(r) {
    var power = 1 + 2 * (STATE.driftDistribution || 0);

    return (r < 0 ? -1 : 1) * Math.pow(Math.abs(r), power);
}

function driftRandom(note) {
    if (typeof note.driftRandom !== "number") {
        note.driftRandom = Math.random() * 2 - 1;
    }

    return note.driftRandom;
}

function offset(note) {
    return shaped(driftRandom(note)) * (STATE.drift || 0) * MAX_OFFSET;
}

function bendValue(semitones) {
    return clamp(Math.round(CENTER + semitones / (STATE.bendRange || 2) * CENTER), 0, 16383);
}

function sendBend(channel, value) {
    if (lastBend[channel] === value) {
        return;
    }

    lastBend[channel] = value;
    messnamed("CC_OUT", PITCH_BEND + channel - 1, value & 127, value >> 7);
}

function noteChannel() {
    var channel;

    if (!STATE.driftMpe) {
        return 1;
    }

    channel = nextMpeChannel;
    nextMpeChannel = channel >= MPE_LAST ? MPE_FIRST : channel + 1;

    return channel;
}

function startGlide(channel, target, duration) {
    var kept = [];

    for (var i = 0; i < glides.length; i++) {
        if (glides[i].channel !== channel) {
            kept.push(glides[i]);
        }
    }

    kept.push({ channel: channel, target: target, start: now(), duration: Math.max(duration, 1) });
    glides = kept;

    if (!animation.running) {
        animation.repeat();
    }
}

function animate() {
    var t = now();
    var alive = [];
    var g, progress;

    for (var i = 0; i < glides.length; i++) {
        g = glides[i];
        progress = clamp((t - g.start) / g.duration, 0, 1);
        sendBend(g.channel, bendValue(g.target * progress));

        if (progress < 1) {
            alive.push(g);
        }
    }

    glides = alive;

    if (!glides.length) {
        animation.cancel();
    }
}
animate.local = 1;

function onStep(step, played) {
    var note = played && STATE.phrase && STATE.phrase[step];
    var channel, target;

    if (!note) {
        return;
    }

    channel = noteChannel();
    STATE.noteChannel = channel;
    target = offset(note);

    if (STATE.driftShape === SHAPE_GLIDE && target) {
        sendBend(channel, CENTER);
        startGlide(channel, target, note.duration);
    } else {
        sendBend(channel, bendValue(target));
    }
}

function recenter() {
    glides = [];
    animation.cancel();

    for (var channel in lastBend) {
        sendBend(+channel, CENTER);
    }
}

function onStateChanged(key) {
    if (key === "driftMpe") {
        recenter();
        nextMpeChannel = MPE_FIRST;
        STATE.noteChannel = 1;
    } else if (key === "drift" && !STATE.drift) {
        recenter();
    }
}
