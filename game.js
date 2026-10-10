'use strict';

// ---------- Constants ----------

const COLS = 10;
const ROWS = 20;
const HIDDEN = 2; // extra rows above the visible board where pieces spawn
const TOTAL_ROWS = ROWS + HIDDEN;
const CELL = 30;

const PREVIEW_CELL = 22;
const PREVIEW_SLOT = 90;
const NEXT_COUNT = 3;

const DAS = 150; // ms a direction is held before it auto-repeats
const ARR = 40; // ms between auto-repeat steps
const SOFT_DROP_INTERVAL = 40;
const LOCK_DELAY = 500;
const MAX_LOCK_RESETS = 15;

const CLEAR_DURATION = 420; // ms the line clear animation holds up play
const CLEAR_FLASH = 0.3; // fraction of the animation spent flashing before the wipe
const CLEAR_NAMES = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS!'];
const SHAKE_DURATION = 320;
const POPUP_DURATION = 1100;
const PARTICLES_PER_BLOCK = 5;

const LINE_SCORES = [0, 100, 300, 500, 800];
const BEST_KEY = 'firstgame.tetris.best';

const COLORS = {
  I: '#22d3ee',
  O: '#facc15',
  T: '#a855f7',
  S: '#4ade80',
  Z: '#ef4444',
  J: '#3b82f6',
  L: '#f97316',
};

const SHAPES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
};

// Wall kick offsets (standard rotation system), keyed by "<from><to>" rotation
// state. Offsets are [x, y] with y pointing up, so y is negated when applied.
const KICKS_JLSTZ = {
  '01': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '10': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '12': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '21': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '23': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '32': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '30': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '03': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
};

const KICKS_I = {
  '01': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '10': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '12': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  '21': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '23': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '32': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '30': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '03': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
};

// ---------- DOM ----------

const boardCanvas = document.getElementById('board');
const holdCanvas = document.getElementById('hold');
const nextCanvas = document.getElementById('next');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayText = document.getElementById('overlay-text');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const levelEl = document.getElementById('level');
const linesEl = document.getElementById('lines');

const boardCtx = setupCanvas(boardCanvas, COLS * CELL, ROWS * CELL);
const holdCtx = setupCanvas(holdCanvas, 118, PREVIEW_SLOT);
const nextCtx = setupCanvas(nextCanvas, 118, PREVIEW_SLOT * NEXT_COUNT);

function setupCanvas(canvas, width, height) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return ctx;
}

// ---------- Game state ----------

let state = 'start'; // 'start' | 'playing' | 'paused' | 'over'
let board;
let current;
let bag;
let queue;
let hold;
let canHold;
let score;
let lines;
let level;
let best = loadBest();

let dropTimer;
let lockTimer;
let lockResets;

const keysDown = { left: false, right: false, down: false };
let shiftDir = 0;
let shiftTimer = 0;

// Visual effects
let clearing = null; // { rows, timer, emitted } while full rows are animating out
let particles = [];
let popups = [];
let shakeTime = 0;
let shakeStrength = 0;
const reducedMotion =
  !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function resetGame() {
  clearing = null;
  particles = [];
  popups = [];
  shakeTime = 0;
  board = [];
  for (let y = 0; y < TOTAL_ROWS; y++) board.push(emptyRow());
  bag = [];
  queue = [];
  while (queue.length < NEXT_COUNT) queue.push(drawFromBag());
  hold = null;
  canHold = true;
  score = 0;
  lines = 0;
  level = 1;
  spawn(nextType());
  updateStats();
}

function emptyRow() {
  return new Array(COLS).fill(null);
}

// 7-bag randomizer: every piece appears once per shuffled set of seven.
function drawFromBag() {
  if (bag.length === 0) {
    bag = Object.keys(SHAPES);
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
  }
  return bag.pop();
}

function nextType() {
  queue.push(drawFromBag());
  return queue.shift();
}

function spawn(type) {
  const matrix = SHAPES[type];
  current = {
    type,
    matrix,
    rot: 0,
    x: Math.floor((COLS - matrix.length) / 2),
    y: 0,
  };
  dropTimer = 0;
  lockTimer = 0;
  lockResets = 0;
  if (collides(current.matrix, current.x, current.y)) gameOver();
}

// ---------- Piece logic ----------

function collides(matrix, px, py) {
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (!matrix[r][c]) continue;
      const x = px + c;
      const y = py + r;
      if (x < 0 || x >= COLS || y >= TOTAL_ROWS) return true;
      if (y >= 0 && board[y][x]) return true;
    }
  }
  return false;
}

function rotateMatrix(matrix, dir) {
  const n = matrix.length;
  const result = [];
  for (let r = 0; r < n; r++) {
    result.push([]);
    for (let c = 0; c < n; c++) {
      result[r].push(dir > 0 ? matrix[n - 1 - c][r] : matrix[c][n - 1 - r]);
    }
  }
  return result;
}

function isGrounded() {
  return collides(current.matrix, current.x, current.y + 1);
}

// Moving or rotating a piece that is resting on the stack gives it a little
// more time before it locks, up to a limit so it cannot be stalled forever.
function onPieceShifted() {
  if (lockResets < MAX_LOCK_RESETS) {
    lockTimer = 0;
    lockResets++;
  }
}

function move(dx) {
  if (collides(current.matrix, current.x + dx, current.y)) return false;
  current.x += dx;
  onPieceShifted();
  return true;
}

function rotate(dir) {
  if (current.type === 'O') return;
  const from = current.rot;
  const to = (from + dir + 4) % 4;
  const rotated = rotateMatrix(current.matrix, dir);
  const kicks = (current.type === 'I' ? KICKS_I : KICKS_JLSTZ)['' + from + to];
  for (const [kx, ky] of kicks) {
    if (!collides(rotated, current.x + kx, current.y - ky)) {
      current.matrix = rotated;
      current.x += kx;
      current.y -= ky;
      current.rot = to;
      onPieceShifted();
      return;
    }
  }
}

function stepDown() {
  if (isGrounded()) return false;
  current.y++;
  lockTimer = 0;
  lockResets = 0;
  return true;
}

function ghostY() {
  let y = current.y;
  while (!collides(current.matrix, current.x, y + 1)) y++;
  return y;
}

function hardDrop() {
  const target = ghostY();
  score += (target - current.y) * 2;
  current.y = target;
  lockPiece();
}

function holdPiece() {
  if (!canHold) return;
  const swapped = hold;
  hold = current.type;
  canHold = false;
  spawn(swapped || nextType());
}

function lockPiece() {
  const { matrix, type } = current;
  let lowestRow = -1;
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (!matrix[r][c]) continue;
      const y = current.y + r;
      if (y >= 0) board[y][current.x + c] = type;
      lowestRow = Math.max(lowestRow, y);
    }
  }

  const fullRows = [];
  for (let y = 0; y < TOTAL_ROWS; y++) {
    if (board[y].every(Boolean)) fullRows.push(y);
  }

  // Full rows stay on the board while they animate out; finishClear() removes
  // them and brings in the next piece.
  if (fullRows.length > 0) {
    const points = LINE_SCORES[fullRows.length] * level;
    score += points;
    lines += fullRows.length;
    level = Math.floor(lines / 10) + 1;
    updateStats();
    startClearEffect(fullRows, points);
    return;
  }
  updateStats();

  // The piece locked entirely above the visible board.
  if (lowestRow < HIDDEN) {
    gameOver();
    return;
  }

  nextPiece();
}

function nextPiece() {
  canHold = true;
  spawn(nextType());
}

function finishClear() {
  const remaining = board.filter((row, y) => !clearing.rows.includes(y));
  while (remaining.length < TOTAL_ROWS) remaining.unshift(emptyRow());
  board = remaining;
  clearing = null;
  nextPiece();
}

// ---------- Line clear effects ----------

function startClearEffect(rows, points) {
  clearing = { rows, timer: 0, emitted: 0 };
  const middleRow = (rows[0] + rows[rows.length - 1]) / 2 + 0.5 - HIDDEN;
  popups.push({
    title: CLEAR_NAMES[rows.length],
    points: '+' + points.toLocaleString(),
    big: rows.length === 4,
    y: Math.max(middleRow * CELL, 70),
    age: 0,
  });
  if (!reducedMotion) {
    shakeTime = SHAKE_DURATION;
    shakeStrength = rows.length === 4 ? 8 : rows.length * 1.5;
  }
}

// How many columns from the middle of the board a block is (0 to 4).
function distanceFromCenter(x) {
  return x < COLS / 2 ? COLS / 2 - 1 - x : x - COLS / 2;
}

// The wipe starts in the middle of each cleared row and spreads to both edges.
function wipeRadius() {
  const progress = clearing.timer / CLEAR_DURATION;
  return (Math.max(0, progress - CLEAR_FLASH) / (1 - CLEAR_FLASH)) * (COLS / 2);
}

function updateClearing(dt) {
  clearing.timer += dt;
  const radius = wipeRadius();
  while (clearing.emitted < COLS / 2 && radius > clearing.emitted) {
    const d = clearing.emitted++;
    for (const y of clearing.rows) {
      burst(COLS / 2 - 1 - d, y, -1);
      burst(COLS / 2 + d, y, 1);
    }
  }
  if (clearing.timer >= CLEAR_DURATION) finishClear();
}

// Shatters one block into particles that fly outward in the wipe direction.
function burst(x, y, side) {
  const color = COLORS[board[y][x]];
  const cx = (x + 0.5) * CELL;
  const cy = (y - HIDDEN + 0.5) * CELL;
  for (let i = 0; i < PARTICLES_PER_BLOCK; i++) {
    const life = 450 + Math.random() * 500;
    particles.push({
      x: cx + (Math.random() - 0.5) * CELL,
      y: cy + (Math.random() - 0.5) * CELL,
      vx: side * Math.random() * 0.22 + (Math.random() - 0.5) * 0.2,
      vy: -0.08 - Math.random() * 0.3,
      size: 3 + Math.random() * 5,
      color: i === 0 ? '#ffffff' : color,
      life,
      maxLife: life,
    });
  }
}

function updateEffects(dt) {
  for (const p of particles) {
    p.vy += 0.0011 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  }
  particles = particles.filter((p) => p.life > 0);

  for (const popup of popups) popup.age += dt;
  popups = popups.filter((popup) => popup.age < POPUP_DURATION);

  shakeTime = Math.max(0, shakeTime - dt);
}

function gravityInterval() {
  const n = Math.min(level, 20) - 1;
  return Math.max(Math.pow(0.8 - n * 0.007, n) * 1000, 16);
}

// ---------- Game flow ----------

function startGame() {
  resetGame();
  shiftDir = 0;
  state = 'playing';
  hideOverlay();
}

function togglePause() {
  if (state === 'playing') {
    state = 'paused';
    showOverlay('PAUSED', 'Press P to resume');
  } else if (state === 'paused') {
    state = 'playing';
    hideOverlay();
  }
}

function gameOver() {
  state = 'over';
  const isNewBest = score > best;
  if (isNewBest) {
    best = score;
    saveBest(best);
  }
  updateStats();
  showOverlay(
    'GAME OVER',
    (isNewBest ? 'New best score: ' : 'Score: ') +
      score.toLocaleString() +
      '\nPress Enter to play again'
  );
}

function showOverlay(title, text) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlay.hidden = false;
}

function hideOverlay() {
  overlay.hidden = true;
}

function updateStats() {
  scoreEl.textContent = score.toLocaleString();
  bestEl.textContent = Math.max(best, score).toLocaleString();
  levelEl.textContent = level;
  linesEl.textContent = lines;
}

function loadBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch (err) {
    return 0;
  }
}

function saveBest(value) {
  try {
    localStorage.setItem(BEST_KEY, String(value));
  } catch (err) {
    // Storage is unavailable (e.g. private browsing); the score just isn't kept.
  }
}

// ---------- Input ----------

const KEY_ACTIONS = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowDown: 'down',
  ArrowUp: 'rotateCW',
  KeyX: 'rotateCW',
  KeyZ: 'rotateCCW',
  Space: 'hardDrop',
  KeyC: 'hold',
  ShiftLeft: 'hold',
  ShiftRight: 'hold',
  KeyP: 'pause',
  Escape: 'pause',
  Enter: 'start',
};

document.addEventListener('keydown', (e) => {
  const action = KEY_ACTIONS[e.code];
  if (!action) return;
  e.preventDefault();
  if (e.repeat) return;

  if (action === 'start') {
    if (state === 'start' || state === 'over') startGame();
    else if (state === 'paused') togglePause();
    return;
  }
  if (action === 'pause') {
    togglePause();
    return;
  }
  if (state !== 'playing') return;

  switch (action) {
    case 'left':
    case 'right':
      keysDown[action] = true;
      shiftDir = action === 'left' ? -1 : 1;
      shiftTimer = 0;
      if (!clearing) move(shiftDir);
      break;
    case 'down':
      keysDown.down = true;
      dropTimer = SOFT_DROP_INTERVAL;
      break;
    case 'rotateCW':
      if (!clearing) rotate(1);
      break;
    case 'rotateCCW':
      if (!clearing) rotate(-1);
      break;
    case 'hardDrop':
      if (!clearing) hardDrop();
      break;
    case 'hold':
      if (!clearing) holdPiece();
      break;
  }
});

document.addEventListener('keyup', (e) => {
  const action = KEY_ACTIONS[e.code];
  if (action === 'down') {
    keysDown.down = false;
  } else if (action === 'left' || action === 'right') {
    keysDown[action] = false;
    const other = action === 'left' ? 'right' : 'left';
    const otherDir = other === 'left' ? -1 : 1;
    if (keysDown[other]) {
      if (shiftDir !== otherDir) {
        shiftDir = otherDir;
        shiftTimer = 0;
      }
    } else {
      shiftDir = 0;
    }
  }
});

window.addEventListener('blur', () => {
  keysDown.left = keysDown.right = keysDown.down = false;
  shiftDir = 0;
  if (state === 'playing') togglePause();
});

overlay.addEventListener('click', () => {
  if (state === 'start' || state === 'over') startGame();
  else if (state === 'paused') togglePause();
});

// ---------- Update ----------

function update(dt) {
  // Play waits while cleared rows animate out.
  if (clearing) {
    updateClearing(dt);
    return;
  }

  if (shiftDir !== 0) {
    shiftTimer += dt;
    while (shiftTimer >= DAS) {
      shiftTimer -= ARR;
      if (!move(shiftDir)) {
        shiftTimer = DAS;
        break;
      }
    }
  }

  if (isGrounded()) {
    dropTimer = 0;
    lockTimer += dt;
    if (lockTimer >= LOCK_DELAY) lockPiece();
    return;
  }

  const interval = keysDown.down
    ? Math.min(SOFT_DROP_INTERVAL, gravityInterval())
    : gravityInterval();
  dropTimer += dt;
  while (dropTimer >= interval) {
    dropTimer -= interval;
    if (!stepDown()) break;
    if (keysDown.down) {
      score += 1;
      updateStats();
    }
  }
}

// ---------- Rendering ----------

function drawBlock(ctx, x, y, size, color) {
  const bevel = Math.max(2, Math.round(size * 0.12));
  ctx.fillStyle = color;
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.fillRect(x, y, size, bevel);
  ctx.fillRect(x, y, bevel, size);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(x, y + size - bevel, size, bevel);
  ctx.fillRect(x + size - bevel, y, bevel, size);
}

function drawBoard() {
  const ctx = boardCtx;
  const width = COLS * CELL;
  const height = ROWS * CELL;

  ctx.fillStyle = '#10131f';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#1c2138';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 1; c < COLS; c++) {
    ctx.moveTo(c * CELL + 0.5, 0);
    ctx.lineTo(c * CELL + 0.5, height);
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.moveTo(0, r * CELL + 0.5);
    ctx.lineTo(width, r * CELL + 0.5);
  }
  ctx.stroke();

  if (!board) return;

  ctx.save();
  if (shakeTime > 0) {
    const strength = shakeStrength * (shakeTime / SHAKE_DURATION);
    ctx.translate((Math.random() - 0.5) * 2 * strength, (Math.random() - 0.5) * 2 * strength);
  }

  const radius = clearing ? wipeRadius() : 0;
  const flashAlpha = clearing
    ? 0.55 + 0.35 * Math.cos((clearing.timer / CLEAR_DURATION) * Math.PI * 8)
    : 0;
  for (let y = HIDDEN; y < TOTAL_ROWS; y++) {
    const isClearing = clearing && clearing.rows.includes(y);
    for (let x = 0; x < COLS; x++) {
      const type = board[y][x];
      if (!type) continue;
      if (isClearing && distanceFromCenter(x) < radius) continue;
      drawBlock(ctx, x * CELL, (y - HIDDEN) * CELL, CELL, COLORS[type]);
      if (isClearing) {
        ctx.fillStyle = 'rgba(255, 255, 255, ' + flashAlpha + ')';
        ctx.fillRect(x * CELL, (y - HIDDEN) * CELL, CELL, CELL);
      }
    }
  }

  if (state !== 'over' && !clearing) drawCurrentPiece(ctx);
  drawEffects(ctx, radius);
  ctx.restore();
}

function drawEffects(ctx, radius) {
  const width = COLS * CELL;

  // A beam of light that follows the wipe outward and thins as it goes.
  if (clearing && radius > 0) {
    const q = Math.min(radius / (COLS / 2), 1);
    const beamHeight = CELL * (1 - q * 0.85);
    ctx.fillStyle = 'rgba(255, 255, 255, ' + 0.75 * (1 - q) + ')';
    for (const y of clearing.rows) {
      ctx.fillRect(
        width / 2 - radius * CELL,
        (y - HIDDEN + 0.5) * CELL - beamHeight / 2,
        radius * 2 * CELL,
        beamHeight
      );
    }
  }

  ctx.globalCompositeOperation = 'lighter';
  for (const p of particles) {
    ctx.globalAlpha = Math.min(1, (p.life / p.maxLife) * 1.5);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalCompositeOperation = 'source-over';

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (const popup of popups) {
    const t = popup.age / POPUP_DURATION;
    const pop = 1 + 0.5 * Math.max(0, 1 - popup.age / 160); // starts large, settles fast
    const y = popup.y - t * 45;
    ctx.globalAlpha = 1 - t * t * t;
    drawPopupText(ctx, popup.title, width / 2, y, (popup.big ? 34 : 24) * pop, popup.big ? '#fde047' : '#ffffff');
    drawPopupText(ctx, popup.points, width / 2, y + (popup.big ? 34 : 28), 17, '#ffffff');
  }
  ctx.globalAlpha = 1;
}

function drawPopupText(ctx, text, x, y, size, color) {
  ctx.font = '800 ' + size + 'px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.lineWidth = Math.max(4, size / 5);
  ctx.strokeStyle = 'rgba(11, 13, 23, 0.9)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function drawCurrentPiece(ctx) {
  const color = COLORS[current.type];
  const gy = ghostY();
  forEachCell(current.matrix, (c, r) => {
    const x = (current.x + c) * CELL;
    const y = (gy + r - HIDDEN) * CELL;
    if (y < 0) return;
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, CELL, CELL);
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, CELL - 2, CELL - 2);
    ctx.globalAlpha = 1;
  });

  forEachCell(current.matrix, (c, r) => {
    const y = (current.y + r - HIDDEN) * CELL;
    if (y < 0) return;
    drawBlock(ctx, (current.x + c) * CELL, y, CELL, color);
  });
}

function forEachCell(matrix, fn) {
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (matrix[r][c]) fn(c, r);
    }
  }
}

// Draws a piece centered in a preview slot whose top edge is at slotTop.
function drawPreview(ctx, type, slotTop) {
  const matrix = SHAPES[type];
  let minC = Infinity;
  let maxC = -Infinity;
  let minR = Infinity;
  let maxR = -Infinity;
  forEachCell(matrix, (c, r) => {
    minC = Math.min(minC, c);
    maxC = Math.max(maxC, c);
    minR = Math.min(minR, r);
    maxR = Math.max(maxR, r);
  });
  const pieceWidth = (maxC - minC + 1) * PREVIEW_CELL;
  const pieceHeight = (maxR - minR + 1) * PREVIEW_CELL;
  const left = (118 - pieceWidth) / 2;
  const top = slotTop + (PREVIEW_SLOT - pieceHeight) / 2;
  forEachCell(matrix, (c, r) => {
    drawBlock(
      ctx,
      left + (c - minC) * PREVIEW_CELL,
      top + (r - minR) * PREVIEW_CELL,
      PREVIEW_CELL,
      COLORS[type]
    );
  });
}

function drawSidePanels() {
  holdCtx.clearRect(0, 0, 118, PREVIEW_SLOT);
  if (hold) {
    holdCtx.globalAlpha = canHold ? 1 : 0.35;
    drawPreview(holdCtx, hold, 0);
    holdCtx.globalAlpha = 1;
  }

  nextCtx.clearRect(0, 0, 118, PREVIEW_SLOT * NEXT_COUNT);
  if (queue) {
    queue.forEach((type, i) => drawPreview(nextCtx, type, i * PREVIEW_SLOT));
  }
}

// ---------- Main loop ----------

let lastTime = 0;

function frame(time) {
  const dt = Math.min(time - lastTime, 100);
  lastTime = time;
  if (state === 'playing') update(dt);
  if (state !== 'paused') updateEffects(dt);
  drawBoard();
  drawSidePanels();
  requestAnimationFrame(frame);
}

bestEl.textContent = best.toLocaleString();
requestAnimationFrame(frame);
