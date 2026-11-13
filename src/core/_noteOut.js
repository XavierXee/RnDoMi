autowatch = 1;
inlets = 1;
outlets = 0;

var NOTE_OFF = 0x80;
var NOTE_ON = 0x90;

// Raw MIDI out keeps notes in order with the pitch bend and CCs on the same [midiout].
function send(status, a, b) {
    messnamed("CC_OUT", status, a, b);
}

function noteOff(channel, pitch) {
    send(NOTE_OFF + channel - 1, pitch, 0);
}
noteOff.local = 1;

// Each note-off is scheduled with its own channel, so MPE channel changes can't strand a note.
function list(pitch, velocity, duration, channel) {
    var ch = channel || 1;
    var off;

    if (!velocity) {
        return;
    }

    send(NOTE_ON + ch - 1, pitch, velocity);
    off = new Task(noteOff, this, ch, pitch);
    off.schedule(Math.max(duration, 1));
}
