# Design references

Exports of the Claude Design boards and screenshots taken from them. The build specs are the handoff files in `specs/`; build from those. These files exist so the feel of a control can be checked against the board.

| Path | What it is |
|---|---|
| `potty-tracking-v2.html` | Board "Potty Tracking v2", frames 2a–2f, exported 2026-10-01. One self-contained file |
| `img/potty-edit-time/` | Screenshots of board frame 2g, the edit-time minute stepper (2026-11-12): open row, editor showing, new entry. No live export of this frame is kept |

## Adding a reference

- Board exports go in this folder, named after the board, as one self-contained file. Skip the export when screenshots and the handoff are enough.
- Screenshots go in `img/<feature>/`, numbered in the order a person would meet them (`01-…png`, `02-…png`).
- Link both from the handoff section that specifies the feature. A file nothing links to will not be read.
- Say in the handoff where the board and the build differ. The boards are prototypes and carry details that are not instructions.
