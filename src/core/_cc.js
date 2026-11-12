autowatch = 1;
inlets = 1;
outlets = 0;

var STATE = new Global("GLOBAL_STATE");

var CHANNEL = 1;
var CURVE = 4;
var CURVE_SPAN = Math.exp(CURVE) - 1;

function sine(p) {
    return (Math.sin(p * Math.PI * 2) + 1) / 2;
}

function expUp(p) {
    return (Math.exp(CURVE * p) - 1) / CURVE_SPAN;
}

function logUp(p) {
    return Math.log(1 + CURVE_SPAN * p) / CURVE;
}

var SHAPES = {
    sine: sine,
    triangle: function (p) { return p < 0.5 ? p * 2 : 2 - p * 2; },
    sawUp: function (p) { return p; },
    sawDown: function (p) { return 1 - p; },
    square: function (p) { return p < 0.5 ? 1 : 0; },
    reverseSquare: function (p) { return p < 0.5 ? 0 : 1; },
    reverseSine: function (p) { return 1 - sine(p); },
    logUp: logUp,
    logDown: function (p) { return logUp(1 - p); },
    expUp: expUp,
    expDown: function (p) { return expUp(1 - p); }
};

var lastSent = {};

function shapeValue(index, phase) {
    var name = STATE.envelopeShapes[index] || STATE.envelopeShapes[0];

    return SHAPES[name](phase);
}

function scale(t, min, max) {
    return Math.round(min + t * (max - min));
}

function envelopeValue(n, step) {
    var p = "env" + n;

    return scale(shapeValue(STATE[p + "Shape"], step / STATE.phraseLength), STATE[p + "Min"], STATE[p + "Max"]);
}

// Random CC values are rolled once per note and kept in the phrase, so a frozen phrase repeats them.
function randomValues(note) {
    if (!note.ccRandom) {
        note.ccRandom = [];
    }

    for (var i = note.ccRandom.length; i < STATE.ccSlots.randoms; i++) {
        note.ccRandom.push(Math.random());
    }

    return note.ccRandom;
}

function randomValue(n, note) {
    var p = "rndCc" + n;

    return scale(randomValues(note)[n - 1], STATE[p + "Min"], STATE[p + "Max"]);
}

function send(slot, cc, value) {
    lastSent[slot] = value;

    if (!STATE.ccValues) {
        STATE.ccValues = {};
    }

    STATE.ccValues[slot] = value;
    messnamed("CC_OUT", 0xB0 + CHANNEL - 1, cc, value);
}

function onStep(step, played) {
    var n, slot, value, note;

    if (step === 0) {
        lastSent = {};
    }

    for (n = 1; STATE.envOn && n <= STATE.ccSlots.envelopes; n++) {
        slot = "env" + n;
        if (!STATE[slot + "On"]) {
            continue;
        }

        value = envelopeValue(n, step);
        if (lastSent[slot] !== value) {
            send(slot, STATE[slot + "Cc"], value);
        }
    }

    note = played && STATE.phrase && STATE.phrase[step];
    if (!note || !STATE.rndCcOn) {
        return;
    }

    var sent = false;

    for (n = 1; n <= STATE.ccSlots.randoms; n++) {
        slot = "rndCc" + n;
        if (STATE[slot + "On"]) {
            send(slot, STATE["rndCc" + n + "Number"], randomValue(n, note));
            sent = true;
        }
    }

    if (sent) {
        messnamed("RANDOM_CC_SENT", "onRandomSent");
    }
}

function onStateChanged(key) {
    if (/^(env|rndCc)\d/.test(key)) {
        lastSent = {};
    }
}
