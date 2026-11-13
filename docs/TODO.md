To Do
- implement swing
- implement adding notes to phrase that stays while the rest regens
- implement seeding + fix seed text input in the left most panel

To Fix
-  fix live loop bug

To Test
1. Root: put a MIDI clip on the RNDOMI track with a few notes. Each note should change Root in the controls panel, and the grid should shift to the new root.
2. Parameters: add a clip envelope or CC data, e.g. CC 27 for Length or CC 20 for Scale. The controls panel should follow while the hidden parameters stay where they were.
3. Generate: a CC 34 jump from below 64 to above it should generate a new phrase and turn Freeze on.
4. Drift: the panel should show a Drift slider after Swing.
5. Drift static: set Drift to 100 % with Shape on Static. Notes should be audibly up to about ¼ semitone sharp or flat with the default weighted distribution, or up to ½ semitone with Distribution on uniform.
6. Bend Range: set it to match your instrument's pitch bend range, e.g. ±2 or ±12, otherwise the detune amount will be off.
7. Glide: notes should start in tune and slide to their offset.
8. Drift 0 %: pitch should snap back to centre.
9. MPE: only with an MPE-enabled instrument. Notes should go out on channels 2–16, and no notes should hang.
10. Notes in general: notes should still start and stop normally, now that [makenote] is gone.