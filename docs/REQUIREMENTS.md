# RANDOMI

## Description

RANDOMI is a MIDI plugin/tool that randomly generates random melodies or "phrases" (succession of music notes).
The phrases has pseudo randomized based on a serie of parameters.

## Input parameters

The goal of RANDOMI is to keep the random melodies "musical", they need to feel human and alive

List of parameters:

- Host app transport (tick, bpm, start, stop) - used internally to sync the phrases
- Root note
- scale / mode / chord notes
- note velocity range (min and max value)
- note octave range (min and max octave from which the note is pitch)
- note length (min and max release duration)
- Freeze mode (on/off when 'on' the generated phrase keeps repeating itself,
  if 'off' a new phrase is generated after the current one)
- Phrase length (number of steps)

## Target distributions

RANDOMI is offered in 4 different builds to fit users preferences:

- Simple pure data patch - the plain patch for pure data users to enjoy
- VST - pure data patch wrapped into a VST plugin - usable in DAWs
- Max/Msp - Max4live patch - usable in Ableton live as a custom Max device
- VCV Rack plugin (including 4ms meta module support)
- Hardware mode - the app is embedded on micro-controllers - on Adafruit MacroPAD with for complete
user interface - 'light' version that could be deployed on arduino or raspberry PI zero

## Technical implementation

### Max/Msp and PureData