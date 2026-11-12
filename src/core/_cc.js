autowatch = 1;
inlets = 1;
outlets = 0;

var STATE = new Global("GLOBAL_STATE");

var CHANNEL = 1;

var SHAPES = {
    sine: function (p) { return (Math.sin(p * Math.PI * 2) + 1) / 2; },
    triangle: function (p) { return p < 0.5 ? p * 2 : 2 - p * 2; },
    sawUp: function (p) { return p; },
    sawDown: function (p) { return 1 - p; },
    square: function (p) { return p < 0.5 ? 1 : 0; }
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
    var p = "rnd" + n;

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

    if (!STATE.ccOn) {
        return;
    }

    for (n = 1; n <= STATE.ccSlots.envelopes; n++) {
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
    if (!note) {
        return;
    }

    for (n = 1; n <= STATE.ccSlots.randoms; n++) {
        slot = "rnd" + n;
        if (STATE[slot + "On"]) {
            send(slot, STATE[slot + "Cc"], randomValue(n, note));
        }
    }
}

function onStateChanged(key) {
    if (/^(env|rnd)\d/.test(key)) {
        lastSent = {};
    }
}
