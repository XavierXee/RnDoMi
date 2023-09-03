import time
import board
import terminalio
import displayio
import microcontroller

from adafruit_simple_text_display import SimpleTextDisplay
from adafruit_macropad import MacroPad
from rainbowio import colorwheel

from adafruit_display_shapes.rect import Rect
from adafruit_display_text import label
from adafruit_display_text import bitmap_label
from adafruit_display_text.scrolling_label import ScrollingLabel

from constants import *

#notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def update_notes_enabled(notes_array, enabled_notes):
    # Iterate through the notes array and update the 'enabled' field
    for note_obj in notes_array:
        note = note_obj['note']
        note_obj['enabled'] = note in enabled_notes
    return notes_array


updated_notes = update_notes_enabled(NOTES, SCALES_AND_MODES[5]["notes"])


# display text setup
macropad = MacroPad(rotation=90)
encoder = macropad.encoder
text_lines = macropad.display_text(" RNDoMiZE")
colors = {
    "enabled": colorwheel(int(255 / 12) * 7),
    "disabled": colorwheel(int(255 / 12) * 1)
}

text_colors = {
    "normal": { "text_color": 0xFFAA00, "background_color": 0x0000FF },
    "strong": { "text_color": 0x0000FF, "background_color": 0xFFAA00 },
}

"""
text = "Hello world CircuitPython scrolling label"
my_scrolling_label = ScrollingLabel(
    terminalio.FONT, text=text, max_characters=20, animate_time=0.3, color=0x0000FF, background_color=0xFFAA00
)
my_scrolling_label_2 = ScrollingLabel(
    terminalio.FONT, text=text, max_characters=20, animate_time=0.3, color=0x0000FF, background_color=0xFFAA00
)


my_scrolling_label.x = 100
my_scrolling_label.y = 0
board.DISPLAY.show(my_scrolling_label)


my_scrolling_label_2.x = 10
my_scrolling_label_2.y = 20
board.DISPLAY.show(my_scrolling_label_2)
"""


DISPLAY_WIDTH = 64
DISPLAY_HEIGHT = 128
TEXT = "Hello"

labels = []
text_group = displayio.Group()

current_selected_item = 0

for index, scale in enumerate(SCALES_AND_MODES[10:17]):
    if index == current_selected_item:
        text_area = ScrollingLabel(
            terminalio.FONT,
            text=scale["name"],
            max_characters=20,
            animate_time=0.3,
            color=0x0000FF,
            background_color=0xFFAA00
        )
    else:
        text_area = label.Label(
            terminalio.FONT,
            text=scale["name"],
            color=text_colors["normal"]["text_color"],
            background_color=text_colors["normal"]["background_color"]
        )
    text_area.anchor_point = (0.0, 0.0)
    text_area.anchored_position = (0, (DISPLAY_HEIGHT / 8) * (index + 1))
    text_group.append(text_area)

"""
text_area_top_left = label.Label(terminalio.FONT, text=SCALES_AND_MODES[2]["name"])
text_area_top_left.anchor_point = (0.0, 0.0)
text_area_top_left.anchored_position = (0, 0)

text_area_middle_left = label.Label(terminalio.FONT, text=TEXT)
text_area_middle_left.anchor_point = (0.0, 0.0)
text_area_middle_left.anchored_position = (0, DISPLAY_HEIGHT / 8)

text_area_bottom_left = label.Label(terminalio.FONT, text=TEXT)
text_area_bottom_left.anchor_point = (0.0, 0.0)
text_area_bottom_left.anchored_position = (0, DISPLAY_HEIGHT)

#text_group = displayio.Group()
text_group.append(text_area_top_left)
text_group.append(text_area_middle_left)
text_group.append(text_area_bottom_left)
"""

board.DISPLAY.show(text_group)




"""

text_group = displayio.Group()
for index, scale in enumerate(SCALES_AND_MODES):
    text_area = label.Label(terminalio.FONT, text=scale["name"])
    text_area.anchor_point = (0.0, index)
    text_area.anchored_position = (0, index)
    text_group.append(text_area)

board.DISPLAY.show(text_group)
"""



while True:
    """
    my_scrolling_label.update()
    my_scrolling_label_2.update()
    """
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



