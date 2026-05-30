/* ========================================
   Chessable — Game Engine
   ======================================== */

// ---- Constants ----
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = [1, 2, 3, 4, 5, 6, 7, 8];
const ALL_SQUARES = [];
for (const f of FILES) {
    for (const r of RANKS) {
        ALL_SQUARES.push(`${f}${r}`);
    }
}

const DIFFICULTY_HINTS = {
    easy: 'Coordinates shown · White perspective',
    normal: 'No coordinates · White perspective',
    hard: 'No coordinates · Perspective flips randomly',
};

const FLIP_MIN = 5;
const FLIP_MAX = 10;

// ---- State ----
const state = {
    screen: 'start',
    mode: 'square',
    difficulty: 'easy',
    timeOption: 60,
    timeRemaining: 60,
    score: 0,
    totalClicks: 0,
    currentPrompt: null,
    promptStartTime: 0,
    reactionTimes: [],
    squareStats: {},       // { 'e5': { prompted: 0, totalTime: 0, misses: 0 } }
    isFlipped: false,
    promptsSinceFlip: 0,
    nextFlipAt: 0,
    timerInterval: null,
    gameActive: false,
    historicalMisses: {},   // persists across rounds in session
    lastPrompt: null,
};

// ---- DOM References ----
const $ = (id) => document.getElementById(id);

const els = {};

function cacheElements() {
    els.startScreen = $('start-screen');
    els.gameScreen = $('game-screen');
    els.resultsScreen = $('results-screen');
    els.startBtn = $('start-btn');
    els.playAgainBtn = $('play-again-btn');
    els.changeModeBtn = $('change-mode-btn');
    els.timerBox = $('timer-box');
    els.timerDisplay = $('timer-display');
    els.promptText = $('prompt-text');
    els.promptBox = $('prompt-box');
    els.scoreDisplay = $('score-display');
    els.board = $('board');
    els.boardWrapper = $('board-wrapper');
    els.rankLabels = $('rank-labels');
    els.fileLabels = $('file-labels');
    els.colorDrillArea = $('color-drill-area');
    els.colorLightBtn = $('color-light-btn');
    els.colorDarkBtn = $('color-dark-btn');
    els.countdownOverlay = $('countdown-overlay');
    els.countdownNumber = $('countdown-number');
    els.difficultyGroup = $('difficulty-group');
    els.difficultyHint = $('difficulty-hint');
    els.perspectiveIndicator = $('perspective-indicator');
    els.perspectiveText = $('perspective-text');
    els.pbDisplay = $('pb-display');
    els.pbText = $('pb-text');
    els.statScore = $('stat-score');
    els.statAccuracy = $('stat-accuracy');
    els.statAvgTime = $('stat-avg-time');
    els.resultsPbBanner = $('results-pb-banner');
    els.heatmapSection = $('heatmap-section');
    els.heatmapGrid = $('heatmap-grid');
    els.heatmapRankLabels = $('heatmap-rank-labels');
    els.heatmapFileLabels = $('heatmap-file-labels');
}

// ---- Initialization ----
function init() {
    cacheElements();
    setupStartScreenListeners();
    setupGameListeners();
    setupResultsListeners();
    updatePersonalBestDisplay();
}

function setupStartScreenListeners() {
    // Mode cards
    document.querySelectorAll('.mode-card').forEach((card) => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.mode-card').forEach((c) => c.classList.remove('active'));
            card.classList.add('active');
            state.mode = card.dataset.mode;
            // Hide difficulty for color mode
            els.difficultyGroup.style.display = state.mode === 'color' ? 'none' : 'flex';
            updatePersonalBestDisplay();
        });
    });

    // Difficulty buttons
    document.querySelectorAll('[data-difficulty]').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-difficulty]').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            state.difficulty = btn.dataset.difficulty;
            els.difficultyHint.textContent = DIFFICULTY_HINTS[state.difficulty];
            updatePersonalBestDisplay();
        });
    });

    // Time buttons
    document.querySelectorAll('[data-time]').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-time]').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            state.timeOption = parseInt(btn.dataset.time);
            updatePersonalBestDisplay();
        });
    });

    // Start button
    els.startBtn.addEventListener('click', startGame);
}

function setupGameListeners() {
    // Board click (event delegation)
    els.board.addEventListener('click', (e) => {
        const square = e.target.closest('.square');
        if (!square || !state.gameActive) return;
        handleSquareClick(square.dataset.square, square);
    });

    // Color drill buttons
    els.colorLightBtn.addEventListener('click', () => handleColorClick('light'));
    els.colorDarkBtn.addEventListener('click', () => handleColorClick('dark'));
}

function setupResultsListeners() {
    els.playAgainBtn.addEventListener('click', startGame);
    els.changeModeBtn.addEventListener('click', () => showScreen('start'));
}

// ---- Screen Management ----
function showScreen(name) {
    state.screen = name;
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    const screen = $(`${name}-screen`);
    if (screen) screen.classList.add('active');
}

// ---- Personal Best ----
function getPBKey() {
    const diff = state.mode === 'color' ? 'all' : state.difficulty;
    return `chessable-pb-${state.mode}-${diff}-${state.timeOption}`;
}

function getPersonalBest() {
    try {
        return parseInt(localStorage.getItem(getPBKey())) || 0;
    } catch {
        return 0;
    }
}

function savePersonalBest(score) {
    try {
        localStorage.setItem(getPBKey(), score.toString());
    } catch { /* silent */ }
}

function updatePersonalBestDisplay() {
    const pb = getPersonalBest();
    if (pb > 0) {
        els.pbDisplay.style.display = 'flex';
        const diff = state.mode === 'color' ? '' : ` · ${capitalize(state.difficulty)}`;
        els.pbText.textContent = `Best: ${pb}${diff} · ${state.timeOption}s`;
    } else {
        els.pbDisplay.style.display = 'none';
    }
}

// ---- Game Flow ----
function startGame() {
    // Reset state
    state.timeRemaining = state.timeOption;
    state.score = 0;
    state.totalClicks = 0;
    state.currentPrompt = null;
    state.promptStartTime = 0;
    state.reactionTimes = [];
    state.squareStats = {};
    state.isFlipped = false;
    state.promptsSinceFlip = 0;
    state.nextFlipAt = randomInt(FLIP_MIN, FLIP_MAX);
    state.gameActive = false;
    state.lastPrompt = null;

    // Update UI
    els.scoreDisplay.textContent = '0';
    els.timerDisplay.textContent = state.timeOption;
    els.timerBox.classList.remove('danger');

    // Show correct drill area
    if (state.mode === 'square') {
        els.boardWrapper.style.display = 'grid';
        els.colorDrillArea.style.display = 'none';
        // Apply difficulty
        if (state.difficulty === 'easy') {
            els.boardWrapper.classList.remove('hide-coords');
        } else {
            els.boardWrapper.classList.add('hide-coords');
        }
        renderBoard();
    } else {
        els.boardWrapper.style.display = 'none';
        els.colorDrillArea.style.display = 'flex';
    }

    // Perspective indicator for hard mode
    if (state.difficulty === 'hard' && state.mode === 'square') {
        els.perspectiveIndicator.style.display = 'block';
        updatePerspectiveText();
    } else {
        els.perspectiveIndicator.style.display = 'none';
    }

    showScreen('game');
    runCountdown();
}

function runCountdown() {
    els.countdownOverlay.style.display = 'flex';
    let count = 3;
    els.countdownNumber.textContent = count;
    els.countdownNumber.style.animation = 'none';
    void els.countdownNumber.offsetWidth; // trigger reflow
    els.countdownNumber.style.animation = '';

    const interval = setInterval(() => {
        count--;
        if (count > 0) {
            els.countdownNumber.textContent = count;
            els.countdownNumber.style.animation = 'none';
            void els.countdownNumber.offsetWidth;
            els.countdownNumber.style.animation = '';
        } else if (count === 0) {
            els.countdownNumber.textContent = 'GO!';
            els.countdownNumber.style.animation = 'none';
            void els.countdownNumber.offsetWidth;
            els.countdownNumber.style.animation = '';
        } else {
            clearInterval(interval);
            els.countdownOverlay.style.display = 'none';
            beginRound();
        }
    }, 700);
}

function beginRound() {
    state.gameActive = true;
    generatePrompt();
    startTimer();
}

// ---- Timer ----
function startTimer() {
    const startTime = Date.now();
    const totalMs = state.timeOption * 1000;

    state.timerInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, totalMs - elapsed);
        state.timeRemaining = remaining / 1000;

        els.timerDisplay.textContent = Math.ceil(state.timeRemaining);

        if (state.timeRemaining <= 10) {
            els.timerBox.classList.add('danger');
        }

        if (remaining <= 0) {
            endGame();
        }
    }, 100);
}

// ---- Board Rendering ----
function renderBoard() {
    els.board.innerHTML = '';
    els.rankLabels.innerHTML = '';
    els.fileLabels.innerHTML = '';

    const ranks = state.isFlipped ? [...RANKS] : [...RANKS].reverse();
    const files = state.isFlipped ? [...FILES].reverse() : [...FILES];

    // Rank labels
    for (const r of ranks) {
        const label = document.createElement('span');
        label.textContent = r;
        els.rankLabels.appendChild(label);
    }

    // File labels
    for (const f of files) {
        const label = document.createElement('span');
        label.textContent = f;
        els.fileLabels.appendChild(label);
    }

    // Squares
    for (const rank of ranks) {
        for (const file of files) {
            const sq = document.createElement('div');
            const fileIdx = FILES.indexOf(file);
            const isLight = (fileIdx + rank) % 2 === 0;
            sq.className = `square ${isLight ? 'light' : 'dark'}`;
            sq.dataset.square = `${file}${rank}`;
            els.board.appendChild(sq);
        }
    }
}

// ---- Prompt Generation ----
function generatePrompt() {
    let square;
    const hasHistory = Object.keys(state.historicalMisses).length > 0;

    if (hasHistory) {
        square = getWeightedSquare();
    } else {
        square = ALL_SQUARES[randomInt(0, ALL_SQUARES.length - 1)];
    }

    // Avoid repeating the same square
    let attempts = 0;
    while (square === state.lastPrompt && attempts < 10) {
        if (hasHistory) {
            square = getWeightedSquare();
        } else {
            square = ALL_SQUARES[randomInt(0, ALL_SQUARES.length - 1)];
        }
        attempts++;
    }

    state.currentPrompt = square;
    state.lastPrompt = square;
    state.promptStartTime = Date.now();

    // Initialize stats for this square
    if (!state.squareStats[square]) {
        state.squareStats[square] = { prompted: 0, totalTime: 0, misses: 0 };
    }
    state.squareStats[square].prompted++;

    // Update prompt display
    els.promptText.textContent = square;
    els.promptText.classList.remove('pop');
    void els.promptText.offsetWidth;
    els.promptText.classList.add('pop');

    // Check if we should flip (hard mode)
    if (state.difficulty === 'hard' && state.mode === 'square') {
        state.promptsSinceFlip++;
        if (state.promptsSinceFlip >= state.nextFlipAt) {
            flipBoard();
        }
    }
}

function getWeightedSquare() {
    let totalWeight = 0;
    const weights = ALL_SQUARES.map((sq) => {
        const misses = state.historicalMisses[sq] || 0;
        const weight = 1 + misses * 2;
        totalWeight += weight;
        return weight;
    });

    let random = Math.random() * totalWeight;
    for (let i = 0; i < ALL_SQUARES.length; i++) {
        random -= weights[i];
        if (random <= 0) return ALL_SQUARES[i];
    }
    return ALL_SQUARES[ALL_SQUARES.length - 1];
}

// ---- Board Flip (Hard Mode) ----
function flipBoard() {
    state.isFlipped = !state.isFlipped;
    state.promptsSinceFlip = 0;
    state.nextFlipAt = randomInt(FLIP_MIN, FLIP_MAX);

    els.boardWrapper.classList.add('flipping');

    setTimeout(() => {
        renderBoard();
        updatePerspectiveText();
        els.boardWrapper.classList.remove('flipping');
    }, 300);
}

function updatePerspectiveText() {
    els.perspectiveText.textContent = state.isFlipped
        ? "Black's perspective"
        : "White's perspective";
}

// ---- Click Handlers ----
function handleSquareClick(clickedSquare, squareEl) {
    if (!state.gameActive) return;
    state.totalClicks++;

    if (clickedSquare === state.currentPrompt) {
        // Correct!
        const reactionTime = Date.now() - state.promptStartTime;
        state.score++;
        state.reactionTimes.push(reactionTime);

        // Update square stats
        state.squareStats[state.currentPrompt].totalTime += reactionTime;

        // Visual feedback
        squareEl.classList.add('flash-correct');
        setTimeout(() => squareEl.classList.remove('flash-correct'), 350);

        // Score pop
        els.scoreDisplay.textContent = state.score;
        els.scoreDisplay.classList.remove('pop');
        void els.scoreDisplay.offsetWidth;
        els.scoreDisplay.classList.add('pop');

        // Next prompt
        generatePrompt();
    } else {
        // Wrong click
        squareEl.classList.add('flash-wrong');
        setTimeout(() => squareEl.classList.remove('flash-wrong'), 250);

        // Track miss
        if (state.squareStats[state.currentPrompt]) {
            state.squareStats[state.currentPrompt].misses++;
        }
        if (!state.historicalMisses[state.currentPrompt]) {
            state.historicalMisses[state.currentPrompt] = 0;
        }
        state.historicalMisses[state.currentPrompt]++;
    }
}

function handleColorClick(color) {
    if (!state.gameActive) return;
    state.totalClicks++;

    const correctColor = isLightSquare(state.currentPrompt) ? 'light' : 'dark';
    const btn = color === 'light' ? els.colorLightBtn : els.colorDarkBtn;

    if (color === correctColor) {
        // Correct!
        const reactionTime = Date.now() - state.promptStartTime;
        state.score++;
        state.reactionTimes.push(reactionTime);

        if (!state.squareStats[state.currentPrompt]) {
            state.squareStats[state.currentPrompt] = { prompted: 0, totalTime: 0, misses: 0 };
        }
        state.squareStats[state.currentPrompt].totalTime += reactionTime;

        // Visual feedback
        btn.classList.add('flash-correct');
        setTimeout(() => btn.classList.remove('flash-correct'), 300);

        // Score pop
        els.scoreDisplay.textContent = state.score;
        els.scoreDisplay.classList.remove('pop');
        void els.scoreDisplay.offsetWidth;
        els.scoreDisplay.classList.add('pop');

        // Next prompt
        generatePrompt();
    } else {
        // Wrong
        btn.classList.add('flash-wrong');
        setTimeout(() => btn.classList.remove('flash-wrong'), 300);

        if (!state.squareStats[state.currentPrompt]) {
            state.squareStats[state.currentPrompt] = { prompted: 0, totalTime: 0, misses: 0 };
        }
        state.squareStats[state.currentPrompt].misses++;

        if (!state.historicalMisses[state.currentPrompt]) {
            state.historicalMisses[state.currentPrompt] = 0;
        }
        state.historicalMisses[state.currentPrompt]++;
    }
}

// ---- Square Color Helper ----
function isLightSquare(squareName) {
    const file = squareName[0];
    const rank = parseInt(squareName[1]);
    const fileIdx = FILES.indexOf(file);
    return (fileIdx + rank) % 2 === 0;
}

// ---- End Game ----
function endGame() {
    state.gameActive = false;
    clearInterval(state.timerInterval);
    state.timerInterval = null;

    // Calculate stats
    const accuracy = state.totalClicks > 0
        ? Math.round((state.score / state.totalClicks) * 100)
        : 0;

    const avgTime = state.reactionTimes.length > 0
        ? state.reactionTimes.reduce((a, b) => a + b, 0) / state.reactionTimes.length
        : 0;

    // Check personal best
    const pb = getPersonalBest();
    const isNewPB = state.score > pb;
    if (isNewPB) {
        savePersonalBest(state.score);
    }

    // Update results UI
    els.statScore.textContent = state.score;
    els.statAccuracy.textContent = `${accuracy}%`;
    els.statAvgTime.textContent = `${(avgTime / 1000).toFixed(2)}s`;

    if (isNewPB && state.score > 0) {
        els.resultsPbBanner.style.display = 'block';
    } else {
        els.resultsPbBanner.style.display = 'none';
    }

    // Render heatmap
    if (state.mode === 'square') {
        els.heatmapSection.style.display = 'flex';
        renderHeatmap();
    } else {
        els.heatmapSection.style.display = 'none';
    }

    showScreen('results');
}

// ---- Heatmap ----
function renderHeatmap() {
    els.heatmapGrid.innerHTML = '';
    els.heatmapRankLabels.innerHTML = '';
    els.heatmapFileLabels.innerHTML = '';

    const ranks = [8, 7, 6, 5, 4, 3, 2, 1];
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

    // Rank labels
    for (const r of ranks) {
        const label = document.createElement('span');
        label.textContent = r;
        els.heatmapRankLabels.appendChild(label);
    }

    // File labels
    for (const f of files) {
        const label = document.createElement('span');
        label.textContent = f;
        els.heatmapFileLabels.appendChild(label);
    }

    // Find max reaction time for scaling
    let maxTime = 0;
    for (const sq of ALL_SQUARES) {
        const stats = state.squareStats[sq];
        if (stats && stats.prompted > 0) {
            const avgTime = stats.totalTime / stats.prompted;
            if (avgTime > maxTime) maxTime = avgTime;
        }
    }

    // Render cells
    for (const rank of ranks) {
        for (const file of files) {
            const sq = `${file}${rank}`;
            const cell = document.createElement('div');
            cell.className = 'heatmap-cell';

            const stats = state.squareStats[sq];
            if (stats && stats.prompted > 0) {
                const avgTime = stats.totalTime / stats.prompted;
                // Color from green (fast) to red (slow)
                const ratio = maxTime > 0 ? Math.min(avgTime / Math.max(maxTime, 3000), 1) : 0;
                const color = heatmapColor(ratio);
                cell.style.background = color;
                cell.title = `${sq}: ${(avgTime / 1000).toFixed(2)}s avg, ${stats.misses} miss${stats.misses !== 1 ? 'es' : ''}`;
            } else {
                cell.classList.add('neutral');
                cell.title = `${sq}: not tested`;
            }

            els.heatmapGrid.appendChild(cell);
        }
    }
}

function heatmapColor(ratio) {
    // 0 = green, 0.5 = yellow/orange, 1 = red
    if (ratio <= 0.5) {
        // Green to yellow
        const r = Math.round(46 + (255 - 46) * (ratio * 2));
        const g = Math.round(213 + (165 - 213) * (ratio * 2));
        const b = Math.round(115 + (2 - 115) * (ratio * 2));
        return `rgb(${r}, ${g}, ${b})`;
    } else {
        // Yellow/orange to red
        const t = (ratio - 0.5) * 2;
        const r = Math.round(255);
        const g = Math.round(165 - 165 * t);
        const b = Math.round(2 + (87 - 2) * t);
        return `rgb(${r}, ${g}, ${b})`;
    }
}

// ---- Utilities ----
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// ---- Boot ----
document.addEventListener('DOMContentLoaded', init);
