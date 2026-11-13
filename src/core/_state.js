autowatch = 1;
inlets = 1;
outlets = 1;
// outlet 0 = state notifications
// outlet 1 = debug / optional

var DICT_NAME = "RnDoMi_STATE";
var CHANGE_CHANNEL = "RnDoMi_STATE_CHANGE";

var STATE = new Global("GLOBAL_STATE");
var STATE_DICT = new Dict(DICT_NAME);

var noteLists = {
    major: [0, 2, 4, 5, 7, 9, 11],
    naturalMinor: [0, 2, 3, 5, 7, 8, 10],
    harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
    melodicMinor: [0, 2, 3, 5, 7, 9, 11],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    aeolian: [0, 2, 3, 5, 7, 8, 10],
    locrian: [0, 1, 3, 5, 6, 8, 10],
    wholeTone: [0, 2, 4, 6, 8, 10],
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    pentatonicMajor: [0, 2, 4, 7, 9],
    pentatonicMinor: [0, 3, 5, 7, 10],
    majorChord: [0, 4, 7],
    minorChord: [0, 3, 7],
    diminishedChord: [0, 3, 6],
    augmentedChord: [0, 4, 8],
    major7Chord: [0, 4, 7, 11],
    dominant7Chord: [0, 4, 7, 10],
    minor7Chord: [0, 3, 7, 10],
    halfDiminished7Chord: [0, 3, 6, 10],
    diminished7Chord: [0, 3, 6, 9],
    minorMajor7Chord: [0, 3, 7, 11],
    augmentedMajor7Chord: [0, 4, 8, 11],
    sus2Chord: [0, 2, 7],
    sus4Chord: [0, 5, 7],
    major9Chord: [0, 4, 7, 11, 2],
    minor9Chord: [0, 3, 7, 10, 2],
    major11Chord: [0, 4, 7, 11, 2, 5],
    minor11Chord: [0, 3, 7, 10, 2, 5],
    major13Chord: [0, 4, 7, 11, 2, 5, 9],
    minor13Chord: [0, 3, 7, 10, 2, 5, 9]
};

var defaultState = {
    // Notes
    root: 69,
    scaleName: "minor11Chord",
    octaveMin: -2,
    octavesMax: 0,

    // Velocity
    velocityMin: 0,
    velocityMax: 127,

    // Duration (ms)
    durationMin: 50,
    durationMax: 1000,

    // Groove / rhythm behavior
    swingAmount: 0.0,   // 0 - 1
    drift: 0.0,         // 0 - 1
    chance: 2,          // rhythm density
    tension: 0,         // builds automatically
    tensionMax: 8,

    // Runtime state
    // currentTick: 0,
    // currentStep: 0,

    // Phrase settings
    phraseLength: 16,
    beatRate: 4,
    freeze: false,
    seed: 0,
    regenerateRhythm: false,
    sequenceBlueprint: [],
    offsetLowerBoundary: 0,
    offsetUpperBoundary: 0,

    // MIDI CC
    envOn: true,
    rndCcOn: true,

    // Generated data
    rhythm: [],
    phrase: []
};

var ENVELOPE_SLOTS = 4;
var RANDOM_SLOTS = 4;
var FIRST_CC = 20;

for (var n = 1; n <= ENVELOPE_SLOTS; n++) {
    defaultState["env" + n + "On"] = false;
    defaultState["env" + n + "Shape"] = 0;
    defaultState["env" + n + "Cc"] = FIRST_CC + n - 1;
    defaultState["env" + n + "Min"] = 1;
    defaultState["env" + n + "Max"] = 127;
}

for (n = 1; n <= RANDOM_SLOTS; n++) {
    defaultState["rndCc" + n + "On"] = false;
    defaultState["rndCc" + n + "Number"] = FIRST_CC + ENVELOPE_SLOTS + n - 1;
    defaultState["rndCc" + n + "Min"] = 1;
    defaultState["rndCc" + n + "Max"] = 127;
}

for (var key in defaultState) {
    STATE[key] = defaultState[key];
}

noteLists.custom = noteLists[defaultState.scaleName].slice();

STATE.noteLists = noteLists;
STATE.ccSlots = { envelopes: ENVELOPE_SLOTS, randoms: RANDOM_SLOTS };
STATE.envelopeShapes = [
    "sine", "triangle", "sawUp", "sawDown", "square",
    "reverseSquare", "reverseSine", "logUp", "logDown", "expUp", "expDown"
];

function range(min, max, step) {
    return { type: "number", min: min, max: max, step: step };
}

var TOGGLE = { type: "toggle" };

var paramSpecs = {
    root: range(0, 127, 1),
    scaleName: { type: "menu" },
    octaveMin: range(-4, 4, 1),
    octavesMax: range(-4, 4, 1),
    velocityMin: range(0, 127, 1),
    velocityMax: range(0, 127, 1),
    durationMin: range(0, 2000, 10),
    durationMax: range(0, 2000, 10),
    phraseLength: range(1, 32, 1),
    beatRate: range(1, 16, 1),
    chance: range(1, 8, 1),
    swingAmount: range(0, 1, 0.01),
    drift: range(0, 1, 0.01),
    freeze: TOGGLE,
    regenerateRhythm: TOGGLE,
    seed: range(0, 16777215, 1),
    envOn: TOGGLE,
    rndCcOn: TOGGLE
};

for (n = 1; n <= ENVELOPE_SLOTS; n++) {
    paramSpecs["env" + n + "On"] = TOGGLE;
    paramSpecs["env" + n + "Shape"] = range(0, STATE.envelopeShapes.length - 1, 1);
    paramSpecs["env" + n + "Cc"] = range(0, 127, 1);
    paramSpecs["env" + n + "Min"] = range(1, 127, 1);
    paramSpecs["env" + n + "Max"] = range(1, 127, 1);
}

for (n = 1; n <= RANDOM_SLOTS; n++) {
    paramSpecs["rndCc" + n + "On"] = TOGGLE;
    paramSpecs["rndCc" + n + "Number"] = range(0, 127, 1);
    paramSpecs["rndCc" + n + "Min"] = range(1, 127, 1);
    paramSpecs["rndCc" + n + "Max"] = range(1, 127, 1);
}

STATE.paramSpecs = paramSpecs;

STATE_DICT.parse(JSON.stringify(STATE));

function saveState() {
    outlet(0, "parse", JSON.stringify(STATE))
}

function constrain(spec, value) {
    var snapped = spec.min + Math.round((value - spec.min) / spec.step) * spec.step;

    return Math.max(spec.min, Math.min(spec.max, +snapped.toFixed(4)));
}

function setParam(key, value) {
    if (!(key in defaultState)) {
        post("setParam: unknown key " + key + "\n");
        return;
    }

    if (key === "scaleName" && typeof value === "number") {
        value = Object.keys(noteLists)[value];
    }

    if (key === "scaleName" && !noteLists[value]) {
        post("setParam: unknown scale " + value + "\n");
        return;
    }

    if (typeof defaultState[key] === "boolean") {
        value = !!value;
    }

    if (paramSpecs[key] && paramSpecs[key].type === "number") {
        value = constrain(paramSpecs[key], Number(value));

        if (isNaN(value)) {
            post("setParam: " + key + " is not a number\n");
            return;
        }
    }

    STATE[key] = value;

    if (key === "phraseLength") {
        STATE.rhythm = [];
    }

    messnamed("STATE_CHANGED", "onStateChanged", key);
}
