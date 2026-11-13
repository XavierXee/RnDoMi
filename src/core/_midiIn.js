autowatch = 1;
inlets = 1;
outlets = 0;

var STATE = new Global("GLOBAL_STATE");

var NOTE_ON = 0x90;
var CONTROL_CHANGE = 0xB0;
var MAX_SEED = 16777215;

var CC_MAP = {
    20: "scaleName",
    21: "octaveMin",
    22: "octavesMax",
    23: "velocityMin",
    24: "velocityMax",
    25: "durationMin",
    26: "durationMax",
    27: "phraseLength",
    28: "beatRate",
    29: "chance",
    30: "swingAmount",
    31: "drift",
    32: "freeze",
    33: "regenerateRhythm",
    34: "generate"
};

var status = 0;
var data = [];
var lastValues = {};

function dataLength(statusByte) {
    var type = statusByte & 0xF0;

    return type === 0xC0 || type === 0xD0 ? 1 : 2;
}

// Raw bytes from [midiin], with running status; realtime and system messages are skipped.
function msg_int(byte) {
    if (byte >= 0xF8) {
        return;
    }

    if (byte >= 0xF0) {
        status = 0;
        data = [];
        return;
    }

    if (byte >= 0x80) {
        status = byte;
        data = [];
        return;
    }

    if (!status) {
        return;
    }

    data.push(byte);

    if (data.length === dataLength(status)) {
        handle(status & 0xF0, data[0], data[1]);
        data = [];
    }
}

function list() {
    for (var i = 0; i < arguments.length; i++) {
        msg_int(arguments[i]);
    }
}

function setParam(key, value) {
    messnamed("SET_PARAM", "setParam", key, value);
}

function handle(type, a, b) {
    if (type === NOTE_ON && b > 0) {
        setRoot(a);
    } else if (type === CONTROL_CHANGE && CC_MAP[a]) {
        control(CC_MAP[a], b);
    }
}

// A new root transposes the current phrase so a frozen loop follows it.
function setRoot(note) {
    var delta = note - STATE.root;
    var phrase = STATE.phrase || [];

    if (!delta) {
        return;
    }

    for (var i = 0; i < phrase.length; i++) {
        if (phrase[i]) {
            phrase[i].pitch += delta;
        }
    }

    setParam("root", note);
}

function scaled(key, value) {
    var spec = STATE.paramSpecs[key];
    var count;

    if (spec.type === "toggle") {
        return value >= 64 ? 1 : 0;
    }

    if (spec.type === "menu") {
        count = Object.keys(STATE.noteLists).length;
        return Math.min(count - 1, Math.floor(value * count / 128));
    }

    return spec.min + value / 127 * (spec.max - spec.min);
}

function control(key, value) {
    var previous = lastValues[key];

    lastValues[key] = value;

    if (key === "generate") {
        if (value >= 64 && !(previous >= 64)) {
            generate();
        }
        return;
    }

    setParam(key, scaled(key, value));
}

function generate() {
    setParam("freeze", 1);
    setParam("seed", Math.floor(Math.random() * (MAX_SEED + 1)));
    messnamed("GENERATE_PHRASE", "generatePhrase");
}
