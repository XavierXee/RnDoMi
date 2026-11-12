inlets = 1;
oulets = 1;

var STATE = new Global("GLOBAL_STATE");

function mapPhraseToMatrixCtrl() {
    var mappedPhrase = []
    var column, row, state = 0;

    outlet(0, "clear");

    for (var i=0; i<STATE.phraseLength; i++) {
        column = i;
        if (STATE.phrase[i]) {
            row = STATE.phrase[i].relativePitch;
            state = 1;
        } else {
            row = 0
            state = 0
        }

        mappedPhrase.push(column);
        mappedPhrase.push(row);
        mappedPhrase.push(state);
    }

    outlet(0, "set", mappedPhrase);
}

function onPhraseGenerated() {
    mapPhraseToMatrixCtrl()
}