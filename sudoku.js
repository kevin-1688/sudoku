// ═══════════════════════════════════════════════════════
//  SUDOKU GENERATOR
// ═══════════════════════════════════════════════════════

// A valid base Sudoku solution
const BASE = [
  [1,2,3,4,5,6,7,8,9],
  [4,5,6,7,8,9,1,2,3],
  [7,8,9,1,2,3,4,5,6],
  [2,3,4,5,6,7,8,9,1],
  [5,6,7,8,9,1,2,3,4],
  [8,9,1,2,3,4,5,6,7],
  [3,4,5,6,7,8,9,1,2],
  [6,7,8,9,1,2,3,4,5],
  [9,1,2,3,4,5,6,7,8]
];

function shuffle(a) {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function deepCopy(b) { return b.map(r => [...r]); }

function generateSolved() {
  let b = deepCopy(BASE);

  // Relabel numbers
  const map = shuffle([1,2,3,4,5,6,7,8,9]);
  b = b.map(row => row.map(v => map[v - 1]));

  // Shuffle rows within each band
  for (let band = 0; band < 3; band++) {
    const order = shuffle([0,1,2]);
    const rows = order.map(i => [...b[band*3 + i]]);
    for (let i = 0; i < 3; i++) b[band*3 + i] = rows[i];
  }

  // Shuffle cols within each stack
  for (let stack = 0; stack < 3; stack++) {
    const order = shuffle([0,1,2]);
    for (let r = 0; r < 9; r++) {
      const vals = order.map(i => b[r][stack*3 + i]);
      for (let i = 0; i < 3; i++) b[r][stack*3 + i] = vals[i];
    }
  }

  // Shuffle bands
  const bOrder = shuffle([0,1,2]);
  const nb = [];
  for (const bn of bOrder) for (let r = 0; r < 3; r++) nb.push([...b[bn*3 + r]]);

  // Shuffle stacks
  const sOrder = shuffle([0,1,2]);
  for (let r = 0; r < 9; r++) {
    const nr = [];
    for (const s of sOrder) for (let c = 0; c < 3; c++) nr.push(nb[r][s*3 + c]);
    nb[r] = nr;
  }

  return nb;
}

function canPlace(b, r, c, n) {
  for (let i = 0; i < 9; i++) {
    if (b[r][i] === n || b[i][c] === n) return false;
  }
  const br = (r/3|0)*3, bc = (c/3|0)*3;
  for (let dr = 0; dr < 3; dr++)
    for (let dc = 0; dc < 3; dc++)
      if (b[br+dr][bc+dc] === n) return false;
  return true;
}

// Count solutions (stop at `limit`)
function countSols(b, limit = 2) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (b[r][c] === 0) {
        let cnt = 0;
        for (let n = 1; n <= 9; n++) {
          if (canPlace(b, r, c, n)) {
            b[r][c] = n;
            cnt += countSols(b, limit);
            b[r][c] = 0;
            if (cnt >= limit) return cnt;
          }
        }
        return cnt;
      }
    }
  }
  return 1;
}

const CLUES = { easy: 40, medium: 32, hard: 25 };

function generatePuzzle(diff) {
  const solved = generateSolved();
  const clues = CLUES[diff];
  const toRemove = 81 - clues;
  const puzzle = deepCopy(solved);
  const positions = shuffle([...Array(81).keys()]);
  let removed = 0;

  for (const pos of positions) {
    if (removed >= toRemove) break;
    const r = (pos / 9) | 0, c = pos % 9;
    const backup = puzzle[r][c];
    puzzle[r][c] = 0;
    const test = deepCopy(puzzle);
    if (countSols(test) === 1) { removed++; }
    else { puzzle[r][c] = backup; }
  }
  return { puzzle, solved };
}

// ═══════════════════════════════════════════════════════
//  GAME STATE
// ═══════════════════════════════════════════════════════

const G = {
  puzzle: [], solved: [], board: [],
  notes: [],      // [r][c] = Set
  given: [],      // [r][c] = bool
  hintCell: [],   // [r][c] = bool (hint-revealed)
  selected: null,
  diff: 'easy',
  mistakes: 0, maxMistakes: 3,
  hintsUsed: 0,
  seconds: 0, timerID: null,
  notesMode: false,
  history: [],
  gameOver: false, won: false
};

// ═══════════════════════════════════════════════════════
//  INIT / NEW GAME
// ═══════════════════════════════════════════════════════

function startNewGame(diff) {
  if (diff) G.diff = diff;
  clearInterval(G.timerID);
  document.getElementById('loading').classList.add('show');
  document.getElementById('win-overlay').classList.remove('show');

  // Generate in next tick so loading spinner paints
  setTimeout(() => {
    const { puzzle, solved } = generatePuzzle(G.diff);
    G.puzzle = puzzle;
    G.solved = solved;
    G.board  = deepCopy(puzzle);
    G.notes  = Array.from({length:9}, () => Array.from({length:9}, () => new Set()));
    G.given  = puzzle.map(r => r.map(v => v !== 0));
    G.hintCell = Array.from({length:9}, () => Array(9).fill(false));
    G.selected = null;
    G.mistakes = 0;
    G.hintsUsed = 0;
    G.seconds = 0;
    G.notesMode = false;
    G.history = [];
    G.gameOver = false;
    G.won = false;

    document.getElementById('loading').classList.remove('show');
    renderBoard();
    renderNumpad();
    refreshPips();
    refreshStats();
    updateTimer();
    updateNotesBtn();
    startTimer();
  }, 30);
}

function startTimer() {
  clearInterval(G.timerID);
  G.timerID = setInterval(() => {
    if (!G.gameOver && !G.won) { G.seconds++; updateTimer(); }
  }, 1000);
}

function updateTimer() {
  const m = String((G.seconds / 60) | 0).padStart(2,'0');
  const s = String(G.seconds % 60).padStart(2,'0');
  document.getElementById('timer').textContent = `${m}:${s}`;
}

function refreshStats() {
  const empty = G.board.flat().filter(v => v === 0).length;
  document.getElementById('remaining').textContent = empty;
}

function refreshPips() {
  for (let i = 0; i < 3; i++) {
    document.getElementById(`p${i}`).className = 'pip' + (i < G.mistakes ? ' used' : '');
  }
}

// ═══════════════════════════════════════════════════════
//  RENDER
// ═══════════════════════════════════════════════════════

function renderBoard() {
  const boardEl = document.getElementById('board');
  boardEl.innerHTML = '';
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.r = r;
      cell.dataset.c = c;
      cell.addEventListener('click', () => onCellClick(r, c));
      boardEl.appendChild(cell);
    }
  }
  refreshAllCells();
}

function cellEl(r, c) {
  return document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
}

function refreshAllCells() {
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      refreshCell(r, c);
}

function refreshCell(r, c) {
  const el = cellEl(r, c);
  if (!el) return;
  el.innerHTML = '';

  // ── Classes ──
  let cls = 'cell';
  const sel = G.selected;
  const val = G.board[r][c];

  if (sel) {
    const {r:sr, c:sc} = sel;
    const selVal = G.board[sr][sc];

    if (sr===r && sc===c) {
      cls += ' selected';
    } else if (sr===r || sc===c || ((sr/3|0)===(r/3|0) && (sc/3|0)===(c/3|0))) {
      cls += ' peer';
    }
    if (selVal !== 0 && val === selVal && !(sr===r && sc===c)) {
      cls += ' same-num';
    }
    // Highlight conflicting cells
    if (sel && selVal !== 0 && !G.given[r][c] && val !== 0 && val !== G.solved[r][c]) {
      cls += ' conflict-hi';
    }
  }

  if (G.given[r][c]) cls += ' given';
  else if (G.hintCell[r][c]) cls += ' hint-fill';
  else if (val !== 0) {
    cls += ' user-fill';
    if (val !== G.solved[r][c]) cls += ' error-val';
  }

  el.className = cls;

  // ── Content ──
  if (val !== 0) {
    el.textContent = val;
  } else {
    const ns = G.notes[r][c];
    if (ns.size > 0) {
      const grid = document.createElement('div');
      grid.className = 'notes-grid';
      for (let n = 1; n <= 9; n++) {
        const nd = document.createElement('div');
        nd.className = 'note-n';
        nd.textContent = ns.has(n) ? n : '';
        grid.appendChild(nd);
      }
      el.appendChild(grid);
    }
  }
}

function renderNumpad() {
  const np = document.getElementById('numpad');
  np.innerHTML = '';
  for (let n = 1; n <= 9; n++) {
    const btn = document.createElement('button');
    btn.className = 'num-btn';
    btn.dataset.num = n;
    btn.addEventListener('click', () => inputNum(n));
    np.appendChild(btn);
  }
  updateNumpad();
}

function updateNumpad() {
  // Count how many of each number are placed
  const counts = Array(10).fill(0);
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (G.board[r][c]) counts[G.board[r][c]]++;

  for (let n = 1; n <= 9; n++) {
    const btn = document.querySelector(`.num-btn[data-num="${n}"]`);
    if (!btn) continue;
    const left = 9 - counts[n];
    btn.innerHTML = `${n}<span class="count-badge">${left}</span>`;
    btn.classList.toggle('depleted', left <= 0);
  }
}

// ═══════════════════════════════════════════════════════
//  INPUT
// ═══════════════════════════════════════════════════════

function onCellClick(r, c) {
  if (G.gameOver || G.won) return;
  G.selected = { r, c };
  refreshAllCells();
}

function inputNum(n) {
  if (!G.selected || G.gameOver || G.won) return;
  const {r, c} = G.selected;
  if (G.given[r][c] || G.hintCell[r][c]) return;

  // Save history
  G.history.push({
    r, c,
    prevVal: G.board[r][c],
    prevNotes: new Set(G.notes[r][c]),
    prevMistakes: G.mistakes
  });

  if (G.notesMode) {
    if (G.board[r][c] === 0) {
      const ns = G.notes[r][c];
      ns.has(n) ? ns.delete(n) : ns.add(n);
    }
  } else {
    // Placing a number
    if (n !== 0) {
      G.notes[r][c] = new Set();
      if (n !== G.solved[r][c]) {
        G.mistakes++;
        refreshPips();
        if (G.mistakes >= G.maxMistakes) {
          G.board[r][c] = n;
          G.gameOver = true;
          refreshAllCells();
          clearInterval(G.timerID);
          setTimeout(() => alert('💀 Game over — too many mistakes!\n\nStart a new game to try again.'), 200);
          return;
        }
      } else {
        clearNotesAround(r, c, n);
      }
      G.board[r][c] = n;
    } else {
      G.board[r][c] = 0;
    }
    refreshStats();
    updateNumpad();
    checkWin();
  }

  refreshAllCells();
}

function clearNotesAround(r, c, n) {
  for (let i = 0; i < 9; i++) {
    G.notes[r][i].delete(n);
    G.notes[i][c].delete(n);
  }
  const br = (r/3|0)*3, bc = (c/3|0)*3;
  for (let dr = 0; dr < 3; dr++)
    for (let dc = 0; dc < 3; dc++)
      G.notes[br+dr][bc+dc].delete(n);
}

function eraseCell() {
  if (!G.selected || G.gameOver || G.won) return;
  const {r, c} = G.selected;
  if (G.given[r][c] || G.hintCell[r][c]) return;
  G.history.push({ r, c, prevVal: G.board[r][c], prevNotes: new Set(G.notes[r][c]), prevMistakes: G.mistakes });
  G.board[r][c] = 0;
  G.notes[r][c] = new Set();
  refreshAllCells();
  refreshStats();
  updateNumpad();
}

function undoMove() {
  if (!G.history.length || G.gameOver || G.won) return;
  const last = G.history.pop();
  G.board[last.r][last.c] = last.prevVal;
  G.notes[last.r][last.c] = last.prevNotes;
  G.mistakes = last.prevMistakes;
  G.selected = { r: last.r, c: last.c };
  refreshAllCells();
  refreshPips();
  refreshStats();
  updateNumpad();
}

function giveHint() {
  if (G.gameOver || G.won) return;
  const empties = [];
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (!G.given[r][c] && !G.hintCell[r][c] && G.board[r][c] !== G.solved[r][c])
        empties.push({r, c});
  if (!empties.length) return;

  const {r, c} = empties[(Math.random() * empties.length) | 0];
  const val = G.solved[r][c];
  G.history.push({ r, c, prevVal: G.board[r][c], prevNotes: new Set(G.notes[r][c]), prevMistakes: G.mistakes });
  G.board[r][c] = val;
  G.notes[r][c] = new Set();
  G.hintCell[r][c] = true;
  G.hintsUsed++;
  clearNotesAround(r, c, val);
  G.selected = { r, c };
  refreshAllCells();
  refreshStats();
  updateNumpad();
  checkWin();
}

function toggleNotes() {
  G.notesMode = !G.notesMode;
  updateNotesBtn();
}

function updateNotesBtn() {
  const btn = document.getElementById('notesBtn');
  btn.classList.toggle('notes-on', G.notesMode);
  btn.querySelector('.icon').textContent = G.notesMode ? '✏️' : '✏️';
  btn.childNodes[1].textContent = G.notesMode ? 'Notes ON' : 'Notes';
}

// ═══════════════════════════════════════════════════════
//  WIN CHECK
// ═══════════════════════════════════════════════════════

function checkWin() {
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (G.board[r][c] !== G.solved[r][c]) return;

  G.won = true;
  clearInterval(G.timerID);

  const m = (G.seconds / 60) | 0;
  const s = G.seconds % 60;
  const timeStr = m > 0 ? `${m}m ${s}s` : `${s}s`;

  document.getElementById('win-time').textContent = timeStr;
  document.getElementById('win-mistakes').textContent = G.mistakes;
  document.getElementById('win-hints').textContent = G.hintsUsed;

  const msgs = ['Excellent work!', 'You nailed it!', 'Brilliant solving!', 'Logic master!'];
  document.getElementById('win-subtitle').textContent = msgs[(Math.random()*msgs.length)|0];

  setTimeout(() => {
    document.getElementById('win-overlay').classList.add('show');
    launchConfetti();
  }, 400);
}

// ═══════════════════════════════════════════════════════
//  CONFETTI
// ═══════════════════════════════════════════════════════

function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = innerWidth;
  canvas.height = innerHeight;

  const colors = ['#ff8906','#e53170','#2cb67d','#7f5af0','#fffffe','#f9c74f'];
  const pieces = Array.from({length: 120}, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * -canvas.height,
    r: Math.random() * 6 + 4,
    d: Math.random() * 120 + 60,
    color: colors[(Math.random()*colors.length)|0],
    tilt: Math.random() * 10 - 10,
    tiltAngle: 0,
    tiltSpeed: Math.random() * 0.1 + 0.05,
    speed: Math.random() * 3 + 2
  }));

  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of pieces) {
      p.tiltAngle += p.tiltSpeed;
      p.y += p.speed;
      p.tilt = Math.sin(p.tiltAngle) * 12;
      if (p.y > canvas.height + 20) {
        p.x = Math.random() * canvas.width;
        p.y = -20;
      }
      ctx.beginPath();
      ctx.lineWidth = p.r;
      ctx.strokeStyle = p.color;
      ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
      ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
      ctx.stroke();
    }
    frame++;
    if (frame < 250) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  draw();
}

// ═══════════════════════════════════════════════════════
//  KEYBOARD
// ═══════════════════════════════════════════════════════

document.addEventListener('keydown', e => {
  if (G.won || G.gameOver) return;

  if (e.key >= '1' && e.key <= '9') { inputNum(+e.key); return; }
  if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') { eraseCell(); return; }
  if (e.key === 'z' && (e.ctrlKey || e.metaKey)) { undoMove(); return; }
  if (e.key === 'n' || e.key === 'N') { toggleNotes(); return; }

  if (!G.selected) return;
  const {r, c} = G.selected;
  const moves = { ArrowUp:[-1,0], ArrowDown:[1,0], ArrowLeft:[0,-1], ArrowRight:[0,1] };
  if (moves[e.key]) {
    e.preventDefault();
    const [dr, dc] = moves[e.key];
    const nr = Math.max(0, Math.min(8, r+dr));
    const nc = Math.max(0, Math.min(8, c+dc));
    G.selected = { r:nr, c:nc };
    refreshAllCells();
  }
});

// Click outside board to deselect
document.addEventListener('click', e => {
  if (!e.target.closest('.board') && !e.target.closest('.numpad') && !e.target.closest('.actions')) {
    G.selected = null;
    refreshAllCells();
  }
});

// ═══════════════════════════════════════════════════════
//  BUTTON WIRING
// ═══════════════════════════════════════════════════════

document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    startNewGame(btn.dataset.diff);
  });
});

document.getElementById('newGameBtn').addEventListener('click', () => startNewGame());
document.getElementById('undoBtn').addEventListener('click', undoMove);
document.getElementById('eraseBtn').addEventListener('click', eraseCell);
document.getElementById('notesBtn').addEventListener('click', toggleNotes);
document.getElementById('hintBtn').addEventListener('click', giveHint);

// ═══════════════════════════════════════════════════════
//  START
// ═══════════════════════════════════════════════════════

startNewGame('easy');
