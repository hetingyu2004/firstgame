# firstgame

A Tetris game written in plain HTML, CSS and JavaScript. There is nothing to install or build.

## Play

Open `index.html` in a browser, then press Enter to start.

## Controls

| Key | Action |
| --- | --- |
| ← → | Move |
| ↑ or X | Rotate clockwise |
| Z | Rotate counter-clockwise |
| ↓ | Soft drop |
| Space | Hard drop |
| C or Shift | Hold |
| P or Esc | Pause |
| Enter | Start, or play again |

## Rules

- Clearing 1, 2, 3 or 4 lines at once scores 100, 300, 500 or 800 points, multiplied by the level.
- Soft drops score 1 point per row and hard drops 2 points per row.
- The level goes up every 10 lines, and pieces fall faster each level.
- The best score is saved in the browser.

## Files

- `index.html`: page layout
- `style.css`: colors and layout
- `game.js`: game logic and drawing
