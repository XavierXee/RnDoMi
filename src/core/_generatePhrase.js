inlets = 1
outlets = 0

var STATE = new Global("GLOBAL_STATE");


// ----------------------------
// UTILITY
// ----------------------------
/**
 * Return the probability of occurrence of event
 *
 * @return { number } number
 * @param x number
 */
function oneInXChance(x) {
    return Math.random() < (1 / x);
}

/**
 * Return a random integer between 2 values
 *
 * @return { number } (number)
 * @param min (number) lower boundary value
 * @param max (number) upper boundary value
 */
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);

    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomList(count) {
    var list = [];

    for (var i = 0; i < count; i++) {
        list.push(Math.random());
    }

    return list;
}

// ----------------------------
// SCALE BUILDER
// ----------------------------
/**
 * Get the list of note from a given scale, represented as a list of relative pitch
 *
 * @return { notes } number[]
 * @param noteLists ({ key: string, value: number[] })
 * @param scaleName string
 */
function getScaleNotes() {

    var scale = STATE.noteLists[STATE.scaleName];
    var notes = [];

    for (var i=0; i<scale.length; i++) {
        notes.push(scale[i]);
    }

    return notes;
}

// ----------------------------
// RHYTHM ENGINE
// ----------------------------
/**
 * Generate a list of rhythm parameters (means a note will be played)
 * or null (means no note will be played on this step) for each step of the phrase
 * no pitch information is set from this function, only velocity and duration
 * velocity and duration are part of the rhythm generation to accommodate for accents
 *
 * @return { ({duration: number, velocity: number} | null)[] }
 * @param phraseLength
 * @param chance
 * @param velocityMin
 * @param velocityMax
 * @param durationMin
 * @param durationMax
 */
function generatePhraseRhythm() {

    var rhythm = STATE.sequenceBlueprint.slice();

    for (var i=0; i<STATE.phraseLength; i++) {

        // var beatPosition = i % 4;
        // var probability = density;

        // strong beat boost
        // if (beatPosition == 0)
        //     probability += 0.25;
        //
        // if (beatPosition == 2)
        //     probability += 0.1;

        if (oneInXChance(STATE.chance)) {
            rhythm.push({
                duration: getRandomInt(STATE.durationMin, STATE.durationMax),
                velocity: getRandomInt(STATE.velocityMin, STATE.velocityMax),
            })
        } else {
            rhythm.push(null)
        }
    }

    return rhythm;
}

// ----------------------------
// PHRASE ENGINE
// ----------------------------

function generatePhraseNotes() {

    var phrase = [];
    var noteList = getScaleNotes();

    for (var i=0; i<STATE.rhythm.length; i++) {
        if (STATE.rhythm[i]) {
            var pitch = noteList[getRandomInt(0, noteList.length - 1)];
            phrase.push({
                relativePitch: pitch,
                pitch: STATE.root + pitch + getRandomInt(STATE.octaveMin, STATE.octavesMax) * 12,
                velocity: STATE.rhythm[i].velocity,
                duration: STATE.rhythm[i].duration,
                ccRandom: randomList(STATE.ccSlots ? STATE.ccSlots.randoms : 0),
                driftRandom: Math.random() * 2 - 1
            });
        } else {
            phrase.push(STATE.rhythm[i]);
        }
    }

    return phrase;
}

function set_phrase() {
    if (!STATE.rhythm || !STATE.rhythm.length || STATE.regenerateRhythm) {
        STATE.rhythm = generatePhraseRhythm();
    }

    STATE.phrase = generatePhraseNotes();
}

function set_tension() {
    STATE.tension++;

    if (STATE.tension > STATE.tensionMax)
        STATE.tension = 0;
}

function generatePhrase() {
    set_phrase();
    set_tension();
    messnamed("PHRASE_GENERATED", "onPhraseGenerated");
    messnamed("SAVE_STATE", "saveState");
}

function bang() {
    generatePhrase();
}