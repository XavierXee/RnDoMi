autowatch = 1;
inlets = 1;
outlets = 0;

var STATE = new Global("GLOBAL_STATE");

var currentTick = 0;
var currentStep = 0;

/**
 * @inlet 0: expects bang from every tick from transport
 */
function bang() {
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

        if (
            STATE.phrase[currentStep] &&
            currentStep > STATE.offsetLowerBoundary - 1 &&
            currentStep < STATE.phraseLength - STATE.offsetUpperBoundary
        ) {
            messnamed("PLAY_NOTE", [
                STATE.phrase[currentStep].pitch,
                STATE.phrase[currentStep].velocity,
                STATE.phrase[currentStep].duration]
            );
        }

        messnamed("CURRENT_STEP", "onCurrentStepChanged", currentStep);

        currentStep++;
    }

    messnamed("CURRENT_TICK", "onCurrentTickChanged", currentTick);
    currentTick++;

    if (currentTick >= STATE.beatRate) {
        currentTick = 0;
    }
}