autowatch = 1;
inlets = 1;
outlets = 0;

var STATE = new Global("GLOBAL_STATE");

var SWING_SHIFT = 1 / 3;
var MAX_TICK_GAP_MS = 1000;

var currentTick = 0;
var currentStep = 0;
var lastTickTime = -1;
var tickMs = 0;

function now() {
    return new Date().getTime();
}

// Average tick length, so a swing delay can be finer than one tick.
function measureTick() {
    var t = now();
    var gap = t - lastTickTime;

    if (lastTickTime >= 0 && gap > 0 && gap < MAX_TICK_GAP_MS) {
        tickMs = tickMs ? tickMs * 0.8 + gap * 0.2 : gap;
    }

    lastTickTime = t;
}

function swingDelay(step) {
    if (step % 2 === 0 || !STATE.swingAmount || !tickMs) {
        return 0;
    }

    return STATE.swingAmount * SWING_SHIFT * STATE.beatRate * tickMs;
}

function playStep(step, note, played) {
    messnamed("CC_STEP", "onStep", step, played ? 1 : 0);

    if (played) {
        messnamed("PLAY_NOTE", [note.pitch, note.velocity, note.duration, STATE.noteChannel || 1]);
    }

    messnamed("CURRENT_STEP", "onCurrentStepChanged", step);
}
playStep.local = 1;

/**
 * @inlet 0: expects bang from every tick from transport
 */
function bang() {
    measureTick();

    if (currentTick == 0) {
        if (!STATE.phrase || STATE.phrase.length == 0) {
            currentStep = 0;
            messnamed("GENERATE_PHRASE", "generatePhrase");
        }

        if (currentStep >= STATE.phraseLength) {
            currentStep = 0;
            currentTick = 0;
            if (!STATE.freeze) {
                messnamed("GENERATE_PHRASE", "generatePhrase");
            }
        }

        var played = !!(
            STATE.phrase[currentStep] &&
            currentStep > STATE.offsetLowerBoundary - 1 &&
            currentStep < STATE.phraseLength - STATE.offsetUpperBoundary
        );

        var delay = swingDelay(currentStep);

        if (delay > 0) {
            new Task(playStep, this, currentStep, STATE.phrase[currentStep], played).schedule(delay);
        } else {
            playStep(currentStep, STATE.phrase[currentStep], played);
        }

        currentStep++;
    }

    messnamed("CURRENT_TICK", "onCurrentTickChanged", currentTick);
    currentTick++;

    if (currentTick >= STATE.beatRate) {
        currentTick = 0;
    }
}