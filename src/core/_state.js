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

    // Enveloppe
    envSIN: null,
    envSAW: null,
    envTRI: null,
    envSQR: null,

    // Generated data
    rhythm: [],
    phrase: []
};

for (var key in defaultState) {
    STATE[key] = defaultState[key];
}

noteLists.custom = noteLists[defaultState.scaleName].slice();

STATE.noteLists = noteLists;

STATE_DICT.parse(JSON.stringify(STATE));

function saveState() {
    outlet(0, "parse", JSON.stringify(STATE))
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

    STATE[key] = value;

    if (key === "phraseLength") {
        STATE.rhythm = [];
    }

    messnamed("STATE_CHANGED", "onStateChanged", key);
}
