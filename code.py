import time
import board
import terminalio
from adafruit_display_text.scrolling_label import ScrollingLabel
from adafruit_macropad import MacroPad
from rainbowio import colorwheel

#notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

scales_and_modes = [
    {'name': 'C Major', 'notes': ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C']},
    {'name': 'D Major', 'notes': ['D', 'E', 'F#', 'G', 'A', 'B', 'C#', 'D']},
    {'name': 'E Major', 'notes': ['E', 'F#', 'G#', 'A', 'B', 'C#', 'D#', 'E']},
    {'name': 'F Major', 'notes': ['F', 'G', 'A', 'Bb', 'C', 'D', 'E', 'F']},
    {'name': 'G Major', 'notes': ['G', 'A', 'B', 'C', 'D', 'E', 'F#', 'G']},
    {'name': 'A Major', 'notes': ['A', 'B', 'C#', 'D', 'E', 'F#', 'G#', 'A']},
    {'name': 'B Major', 'notes': ['B', 'C#', 'D#', 'E', 'F#', 'G#', 'A#', 'B']},
    {'name': 'A Natural Minor', 'notes': ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'A']},
    {'name': 'D Natural Minor', 'notes': ['D', 'E', 'F', 'G', 'A', 'Bb', 'C', 'D']},
    {'name': 'E Natural Minor', 'notes': ['E', 'F#', 'G', 'A', 'B', 'C', 'D', 'E']},
    {'name': 'G Natural Minor', 'notes': ['G', 'A', 'Bb', 'C', 'D', 'Eb', 'F', 'G']},
    {'name': 'A Harmonic Minor', 'notes': ['A', 'B', 'C', 'D', 'E', 'F', 'G#', 'A']},
    {'name': 'D Harmonic Minor', 'notes': ['D', 'E', 'F', 'G', 'A', 'B', 'C#', 'D']},
    {'name': 'E Harmonic Minor', 'notes': ['E', 'F#', 'G', 'A', 'B', 'C', 'D#', 'E']},
    {'name': 'C Major (Ionian)', 'notes': ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C']},
    {'name': 'D Major (Dorian)', 'notes': ['D', 'E', 'F', 'G', 'A', 'B', 'C', 'D']},
    {'name': 'E Major (Phrygian)', 'notes': ['E', 'F', 'G', 'A', 'B', 'C', 'D', 'E']},
    {'name': 'F Major (Lydian)', 'notes': ['F', 'G', 'A', 'B', 'C', 'D', 'E', 'F']},
    {'name': 'G Major (Mixolydian)', 'notes': ['G', 'A', 'B', 'C', 'D', 'E', 'F', 'G']},
    {'name': 'A Natural Minor (Aeolian)', 'notes': ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'A']},
    {'name': 'B Major (Locrian)', 'notes': ['B', 'C', 'D', 'E', 'F', 'G', 'A', 'B']}
]

notes = [
    {"note": "C", "enabled": True},
    {"note": "C#", "enabled": True},
    {"note": "D", "enabled": True},
    {"note": "D#", "enabled": True},
    {"note": "E", "enabled": True},
    {"note": "F", "enabled": True},
    {"note": "F#", "enabled": True},
    {"note": "G", "enabled": True},
    {"note": "G#", "enabled": True},
    {"note": "A", "enabled": True},
    {"note": "A#", "enabled": True},
    {"note": "B", "enabled": True}
]

def update_notes_enabled(notes_array, enabled_notes):
    # Iterate through the notes array and update the 'enabled' field
    for note_obj in notes_array:
        note = note_obj['note']
        note_obj['enabled'] = note in enabled_notes
    return notes_array


updated_notes = update_notes_enabled(notes, scales_and_modes[5]["notes"])

selected_notes = scales_and_modes[5]["notes"];
print(selected_notes)


# display text setup
macropad = MacroPad(rotation=90)
encoder = macropad.encoder
text_lines = macropad.display_text(" RNDoMiZE")
colors = {
    "enabled": colorwheel(int(255 / 12) * 7),
    "disabled": colorwheel(int(255 / 12) * 1)
}

# text_lines[0].text = "   Mode:"
# text_lines[1].text = "  On/Off"
# text_lines[2].text = " "
# text_lines[3].text = "BPM: %d" % tempo

for index, scales_and_mode in enumerate(scales_and_modes):
    text_lines[index + 1].text = scales_and_mode["name"]

text_lines.show()

while True:
    key_events = macropad.keys.events.get()
    encoder_delta = encoder

    for index, note in enumerate(updated_notes):
        if note["enabled"]:
            macropad.pixels[index] = colors["enabled"]
        else:
            macropad.pixels[index] = colors["disabled"]

    if (key_events and key_events.pressed):
        print(key_events.key_number)
        updated_notes[key_events.key_number]["enabled"] = not updated_notes[key_events.key_number]["enabled"]



