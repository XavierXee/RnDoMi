// ----------------------------
// ENVELOPE
// ----------------------------

var STATE = new Global("GLOBAL_STATE");

function sinusoidEnvelope(step, totalSteps) {
    // Normalize step to 0–1 range
    const phase = step / (totalSteps - 1);

    // Generate sine wave (-1 to 1)
    const sine = Math.sin(phase * Math.PI * 2);

    // Convert to 0–1 range
    const normalized = (sine + 1) / 2;

    // Scale to 1–127
    const value = Math.round(normalized * 126 + 1);

    return value;
}

function sendEnvelopeValue(step, totalSteps) {
    var ccNumber = 1;   // Mod wheel
    var channel = 1;
    // outlet(2, sinusoidEnvelope(step, totalSteps), ccNumber, channel);
    if (STATE.envSIN) {
        messnamed("ENV_SIN", [sinusoidEnvelope(step, totalSteps), ccNumber, channel]);
    }
}

function onCurrentTickChanged(currentTick) {
    sendEnvelopeValue(currentTick, STATE.phraseLength);
}