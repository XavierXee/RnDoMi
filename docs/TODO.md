To Do
- implement swing
- implement drft
- implement adding notes to phrase that stays while the rest regens
- implement seeding

To Fix
-  fix live loop bug

To Test
1. Root: put a MIDI clip on the RNDOMI track with a few notes. Each note should change Root in the controls panel, and the grid should shift to the new root.
2. Parameters: add a clip envelope or CC data, e.g. CC 27 for Length or CC 20 for Scale. The controls panel should follow while the hidden parameters stay where they were.
3. Generate: a CC 34 jump from below 64 to above it should generate a new phrase and turn Freeze on.
4. Drift: the panel should show a Drift slider after Swing.