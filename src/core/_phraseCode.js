autowatch = 1;
inlets = 1;
outlets = 0;

var STATE = new Global("GLOBAL_STATE");

var VERSION = 1;
var STORE_NAME = "phraseCode";
var ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
var LOCKED = 128;

// Settings needed to rebuild the phrase, in code order. Hidden objects store durations in seconds.
var PARAMS = [
    "root", "scaleName", "octaveMin", "octavesMax", "velocityMin", "velocityMax",
    "durationMin", "durationMax", "phraseLength", "beatRate", "chance", "freezeRhythm"
];
var OBJECT_SCALE = { durationMin: 1000, durationMax: 1000 };

var listener = null;
var loading = false;

function mod(n, m) {
    return ((n % m) + m) % m;
}

function toText(bytes) {
    var out = "";
    var bits = 0;
    var value = 0;

    for (var i = 0; i < bytes.length; i++) {
        value = (value << 8) | bytes[i];
        bits += 8;

        while (bits >= 6) {
            bits -= 6;
            out += ALPHABET.charAt((value >> bits) & 63);
        }

        value &= (1 << bits) - 1;
    }

    if (bits > 0) {
        out += ALPHABET.charAt((value << (6 - bits)) & 63);
    }

    return out;
}

function fromText(text) {
    var bytes = [];
    var bits = 0;
    var value = 0;
    var index;

    for (var i = 0; i < text.length; i++) {
        index = ALPHABET.indexOf(text.charAt(i));

        if (index < 0) {
            return null;
        }

        value = (value << 6) | index;
        bits += 6;

        if (bits >= 8) {
            bits -= 8;
            bytes.push((value >> bits) & 255);
            value &= (1 << bits) - 1;
        }
    }

    return bytes;
}

function scaleNames() {
    return Object.keys(STATE.noteLists);
}

function intervalMask(intervals) {
    var mask = 0;

    for (var i = 0; i < intervals.length; i++) {
        mask |= 1 << mod(intervals[i], 12);
    }

    return mask;
}

function maskIntervals(mask) {
    var intervals = [];

    for (var i = 0; i < 12; i++) {
        if (mask & (1 << i)) {
            intervals.push(i);
        }
    }

    return intervals;
}

function encode() {
    var length = STATE.phraseLength;
    var phrase = STATE.phrase || [];
    var bytes = [VERSION, (STATE.seed >> 16) & 255, (STATE.seed >> 8) & 255, STATE.seed & 255];
    var scaleIndex = scaleNames().indexOf(STATE.scaleName);
    var mask = intervalMask(STATE.noteLists[STATE.scaleName] || []);
    var i, byte, note, duration;

    bytes.push(STATE.root, scaleIndex, mask >> 8, mask & 255);
    bytes.push(((STATE.octaveMin + 4) << 4) | (STATE.octavesMax + 4));
    bytes.push(STATE.velocityMin, STATE.velocityMax);
    bytes.push(Math.round(STATE.durationMin / 10), Math.round(STATE.durationMax / 10));
    bytes.push(length, STATE.beatRate, STATE.chance, STATE.freezeRhythm ? 1 : 0);

    for (i = 0; i < length; i += 8) {
        byte = 0;
        for (var b = 0; b < 8 && i + b < length; b++) {
            if (phrase[i + b]) {
                byte |= 1 << b;
            }
        }
        bytes.push(byte);
    }

    for (i = 0; i < length; i++) {
        note = phrase[i];
        if (!note) {
            continue;
        }

        duration = Math.max(0, Math.min(65535, Math.round(note.duration)));
        bytes.push((note.pitch & 127) | (note.locked ? LOCKED : 0), note.velocity & 127, duration >> 8, duration & 255);
    }

    return toText(bytes);
}

function decode(text) {
    var bytes = fromText(String(text));
    var pos = 0;
    var result, length, present, i, note, mask, octaves, pitch;

    function next() {
        return pos < bytes.length ? bytes[pos++] : -1;
    }

    if (!bytes || bytes.length < 20 || next() !== VERSION) {
        return null;
    }

    result = { seed: (next() << 16) | (next() << 8) | next(), params: {}, notes: [] };
    result.params.root = next();
    result.params.scaleName = next();
    mask = (next() << 8) | next();
    result.customIntervals = maskIntervals(mask);
    octaves = next();
    result.params.octaveMin = (octaves >> 4) - 4;
    result.params.octavesMax = (octaves & 15) - 4;
    result.params.velocityMin = next();
    result.params.velocityMax = next();
    result.params.durationMin = next() * 10;
    result.params.durationMax = next() * 10;
    length = result.params.phraseLength = next();
    result.params.beatRate = next();
    result.params.chance = next();
    result.params.freezeRhythm = next() & 1;

    if (length < 1 || length > 32 || result.params.scaleName >= scaleNames().length) {
        return null;
    }

    present = [];
    for (i = 0; i < length; i += 8) {
        present.push(next());
    }

    for (i = 0; i < length; i++) {
        if (!(present[i >> 3] & (1 << (i & 7)))) {
            result.notes.push(null);
            continue;
        }

        pitch = next();
        note = { pitch: pitch & 127, velocity: next(), duration: (next() << 8) | next() };

        if (note.duration < 0 || pitch < 0) {
            return null;
        }

        if (pitch & LOCKED) {
            note.locked = true;
        }

        result.notes.push(note);
    }

    return result;
}

function objectNamed(key) {
    return this.patcher ? this.patcher.getnamed(key) : null;
}

// Moves the hidden object so the controls follow and the value is saved; falls back to the engine.
function apply(key, value) {
    var obj = objectNamed(key);

    if (obj) {
        obj.message(OBJECT_SCALE[key] ? "float" : "int", OBJECT_SCALE[key] ? value / OBJECT_SCALE[key] : value);
    } else {
        messnamed("SET_PARAM", "setParam", key, value);
    }
}

function seedRandoms(seed, step, count) {
    var x = (seed * 64 + step + 1) * 2654435761 + 1 | 0 || 1;
    var cc = [];

    function next() {
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        return (x >>> 0) / 4294967296;
    }

    for (var i = 0; i < count; i++) {
        cc.push(next());
    }

    return { ccRandom: cc, driftRandom: next() * 2 - 1 };
}

function load(text) {
    var code = decode(text);
    var count = STATE.ccSlots ? STATE.ccSlots.randoms : 0;
    var i, note, randoms;

    if (!code) {
        post("_phraseCode.js: not a valid phrase code\n");
        update();
        return;
    }

    loading = true;
    STATE.noteLists.custom = code.customIntervals.length ? code.customIntervals : STATE.noteLists.custom;

    for (i = 0; i < PARAMS.length; i++) {
        apply(PARAMS[i], code.params[PARAMS[i]]);
    }

    STATE.seed = code.seed;
    STATE.rhythm = [];
    STATE.phrase = [];

    for (i = 0; i < code.notes.length; i++) {
        note = code.notes[i];

        if (note) {
            randoms = seedRandoms(code.seed, i, count);
            note.relativePitch = mod(note.pitch - code.params.root, 12);
            note.ccRandom = randoms.ccRandom;
            note.driftRandom = randoms.driftRandom;
            STATE.rhythm.push({ velocity: note.velocity, duration: note.duration });
        } else {
            STATE.rhythm.push(null);
        }

        STATE.phrase.push(note);
    }

    apply("freeze", 1);
    loading = false;
    messnamed("PHRASE_GENERATED", "onPhraseGenerated");
    messnamed("SAVE_STATE", "saveState");
}

function update() {
    var code;

    if (loading || !STATE.noteLists || typeof STATE.seed !== "number") {
        return;
    }

    code = encode();

    if (code === STATE.phraseCode) {
        return;
    }

    STATE.phraseCode = code;
    store(code);
    messnamed("STATE_CHANGED", "onStateChanged", "phraseCode");
}

function store(code) {
    var obj = objectNamed(STORE_NAME);

    if (obj) {
        obj.message(code);
    }
}

function restore(value) {
    var text = value && typeof value === "object" ? value[0] : value;

    if (text && String(text) !== STATE.phraseCode) {
        load(text);
    }
}

function bind() {
    var obj = objectNamed(STORE_NAME);

    if (!obj) {
        return;
    }

    listener = new MaxobjListener(obj, function (data) {
        restore(data.value);
    });
    restore(obj.getvalueof());
}

function onPhraseGenerated() {
    update();
}

function onPhraseEdited() {
    update();
}

function onStateChanged(key) {
    if (key !== "phraseCode") {
        update();
    }
}

function loadbang() {
    bind();
}
