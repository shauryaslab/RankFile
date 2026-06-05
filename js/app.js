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
    square: {
        easy: 'Coordinates shown · White perspective',
        normal: 'No coordinates · White perspective',
        hard: 'No coordinates · Perspective flips randomly',
    },
    name: {
        easy: 'White perspective',
        normal: 'White perspective',
        hard: 'Perspective flips randomly',
    },
};

const MODE_HINTS = {
    square: 'Click the highlighted coordinate on the board',
    name: 'Tap or type the name of the lit-up square',
    color: 'Is the named square light or dark?',
};

const FLIP_MIN = 5;
const FLIP_MAX = 10;
const SURVIVAL_LIVES = 3;

const SETTINGS_KEY = 'chessable-settings';
const STATS_KEY = 'chessable-stats';
const DEFAULT_SETTINGS = {
    boardTheme: 'classic',
    sound: true,
    haptics: true,
    animations: true,
    countdown: true,
};

// ---- Persistent Settings ----
let settings = { ...DEFAULT_SETTINGS };

function loadSettings() {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch { /* use defaults */ }
}

function saveSettings() {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch { /* silent */ }
}

function applySettings() {
    document.body.dataset.boardTheme = settings.boardTheme;
    document.body.classList.toggle('no-anim', !settings.animations);
}

// ---- Lifetime Stats ----
const DEFAULT_STATS = { drills: 0, correct: 0, attempts: 0, bestStreak: 0, timeTrained: 0 };
let lifetime = { ...DEFAULT_STATS };

function loadLifetime() {
    try {
        const raw = localStorage.getItem(STATS_KEY);
        if (raw) lifetime = { ...DEFAULT_STATS, ...JSON.parse(raw) };
    } catch { /* use defaults */ }
}

function saveLifetime() {
    try {
        localStorage.setItem(STATS_KEY, JSON.stringify(lifetime));
    } catch { /* silent */ }
}

// ---- State ----
const state = {
    screen: 'start',
    mode: 'square',
    difficulty: 'easy',
    session: 60,           // 30 | 60 | 120 | 'survival'
    timeRemaining: 60,
    lives: SURVIVAL_LIVES,
    score: 0,
    totalClicks: 0,
    streak: 0,
    bestStreak: 0,
    currentPrompt: null,
    promptStartTime: 0,
    reactionTimes: [],
    squareStats: {},       // { 'e5': { prompted: 0, totalTime: 0, misses: 0 } }
    isFlipped: false,
    promptsSinceFlip: 0,
    nextFlipAt: 0,
    timerInterval: null,
    gameStartTime: 0,
    gameActive: false,
    historicalMisses: {},  // persists across rounds in session
    lastPrompt: null,
    pendingFile: null,     // Name mode partial answer
    pendingRank: null,
    ended: false,
};

// ---- DOM References ----
const $ = (id) => document.getElementById(id);
const els = {};

function cacheElements() {
    [
        'start-screen', 'game-screen', 'results-screen', 'start-btn', 'play-again-btn',
        'change-mode-btn', 'timer-box', 'timer-display', 'prompt-text', 'prompt-box',
        'score-display', 'board', 'board-wrapper', 'rank-labels', 'file-labels',
        'color-drill-area', 'color-light-btn', 'color-dark-btn', 'countdown-overlay',
        'countdown-number', 'difficulty-group', 'difficulty-hint', 'perspective-indicator',
        'perspective-text', 'pb-display', 'pb-text', 'stat-score', 'stat-accuracy',
        'stat-avg-time', 'stat-streak', 'results-pb-banner', 'heatmap-section', 'heatmap-grid',
        'heatmap-rank-labels', 'heatmap-file-labels', 'lives-box', 'streak-display',
        'streak-value', 'quit-btn', 'prompt-hint', 'name-answer-area', 'file-pad', 'rank-pad',
        'settings-btn', 'stats-btn', 'settings-modal', 'stats-modal', 'close-settings-btn',
        'close-stats-btn', 'theme-grid', 'toggle-sound', 'toggle-haptics', 'toggle-animations',
        'toggle-countdown', 'reset-progress-btn', 'lt-drills', 'lt-correct', 'lt-accuracy',
        'lt-best-streak', 'lt-time', 'lt-empty',
    ].forEach((id) => {
        // camelCase key from kebab id
        const key = id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        els[key] = $(id);
    });
}

// ---- Initialization ----
function init() {
    cacheElements();
    loadSettings();
    loadLifetime();
    applySettings();
    buildNamePads();
    setupStartScreenListeners();
    setupGameListeners();
    setupResultsListeners();
    setupSettingsListeners();
    setupKeyboard();
    syncSettingsUI();
    updatePersonalBestDisplay();
    registerServiceWorker();
    // Unlock audio on the first user gesture so start-screen taps are audible.
    document.addEventListener('pointerdown', ensureAudio, { once: true });
}

function setupStartScreenListeners() {
    document.querySelectorAll('.mode-card').forEach((card) => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.mode-card').forEach((c) => c.classList.remove('active'));
            card.classList.add('active');
            state.mode = card.dataset.mode;
            // Difficulty only matters for board-based modes
            const showDiff = state.mode === 'square' || state.mode === 'name';
            els.difficultyGroup.style.display = showDiff ? 'flex' : 'none';
            if (showDiff) els.difficultyHint.textContent = DIFFICULTY_HINTS[state.mode][state.difficulty];
            updatePersonalBestDisplay();
            sfx('click');
        });
    });

    document.querySelectorAll('[data-difficulty]').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-difficulty]').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            state.difficulty = btn.dataset.difficulty;
            const hintSet = DIFFICULTY_HINTS[state.mode] || DIFFICULTY_HINTS.square;
            els.difficultyHint.textContent = hintSet[state.difficulty];
            updatePersonalBestDisplay();
            sfx('click');
        });
    });

    document.querySelectorAll('[data-session]').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-session]').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            const val = btn.dataset.session;
            state.session = val === 'survival' ? 'survival' : parseInt(val);
            updatePersonalBestDisplay();
            sfx('click');
        });
    });

    els.startBtn.addEventListener('click', startGame);
}

function setupGameListeners() {
    els.board.addEventListener('click', (e) => {
        if (state.mode !== 'square') return;       // Name mode board is display-only
        const square = e.target.closest('.square');
        if (!square || !state.gameActive) return;
        answerSquare(square.dataset.square, square);
    });

    els.colorLightBtn.addEventListener('click', () => handleColorClick('light'));
    els.colorDarkBtn.addEventListener('click', () => handleColorClick('dark'));
    els.quitBtn.addEventListener('click', quitGame);
}

function setupResultsListeners() {
    els.playAgainBtn.addEventListener('click', startGame);
    els.changeModeBtn.addEventListener('click', () => { sfx('click'); showScreen('start'); });
}

// ---- Name-mode coordinate pads ----
function buildNamePads() {
    els.filePad.innerHTML = '';
    els.rankPad.innerHTML = '';
    FILES.forEach((f) => {
        const b = document.createElement('button');
        b.className = 'pad-btn';
        b.textContent = f;
        b.dataset.file = f;
        b.addEventListener('click', () => pickFile(f));
        els.filePad.appendChild(b);
    });
    RANKS.forEach((r) => {
        const b = document.createElement('button');
        b.className = 'pad-btn';
        b.textContent = r;
        b.dataset.rank = r;
        b.addEventListener('click', () => pickRank(r));
        els.rankPad.appendChild(b);
    });
}

function pickFile(f) {
    if (!state.gameActive || state.mode !== 'name') return;
    state.pendingFile = f;
    highlightPad();
    maybeSubmitName();
}

function pickRank(r) {
    if (!state.gameActive || state.mode !== 'name') return;
    state.pendingRank = r;
    highlightPad();
    maybeSubmitName();
}

function highlightPad() {
    els.filePad.querySelectorAll('.pad-btn').forEach((b) =>
        b.classList.toggle('selected', b.dataset.file === state.pendingFile));
    els.rankPad.querySelectorAll('.pad-btn').forEach((b) =>
        b.classList.toggle('selected', String(state.pendingRank) === String(b.dataset.rank)));
}

function clearPad() {
    state.pendingFile = null;
    state.pendingRank = null;
    highlightPad();
}

function maybeSubmitName() {
    if (state.pendingFile && state.pendingRank) {
        const answer = `${state.pendingFile}${state.pendingRank}`;
        const correct = answer === state.currentPrompt;
        flashPad(correct);
        answerSquare(answer, null);
        clearPad();
    }
}

function flashPad(correct) {
    const cls = correct ? 'flash-correct' : 'flash-wrong';
    [...els.filePad.querySelectorAll('.selected'), ...els.rankPad.querySelectorAll('.selected')]
        .forEach((b) => {
            b.classList.add(cls);
            setTimeout(() => b.classList.remove(cls), 300);
        });
}

// ---- Screen Management ----
function showScreen(name) {
    state.screen = name;
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    const screen = $(`${name}-screen`);
    if (screen) screen.classList.add('active');
    // Hide top-bar utility buttons during active play
    document.body.classList.toggle('in-game', name === 'game');
}

// ---- Personal Best ----
function getPBKey() {
    const diff = (state.mode === 'square' || state.mode === 'name') ? state.difficulty : 'all';
    return `chessable-pb-${state.mode}-${diff}-${state.session}`;
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
        const showDiff = state.mode === 'square' || state.mode === 'name';
        const diff = showDiff ? ` · ${capitalize(state.difficulty)}` : '';
        const session = state.session === 'survival' ? 'Survival' : `${state.session}s`;
        els.pbText.textContent = `Best: ${pb}${diff} · ${session}`;
    } else {
        els.pbDisplay.style.display = 'none';
    }
}

// ---- Game Flow ----
function startGame() {
    ensureAudio();

    state.timeRemaining = state.session === 'survival' ? Infinity : state.session;
    state.lives = SURVIVAL_LIVES;
    state.score = 0;
    state.totalClicks = 0;
    state.streak = 0;
    state.bestStreak = 0;
    state.currentPrompt = null;
    state.promptStartTime = 0;
    state.reactionTimes = [];
    state.squareStats = {};
    state.isFlipped = false;
    state.promptsSinceFlip = 0;
    state.nextFlipAt = randomInt(FLIP_MIN, FLIP_MAX);
    state.gameActive = false;
    state.lastPrompt = null;
    state.ended = false;
    clearPad();

    const isSurvival = state.session === 'survival';
    const usesBoard = state.mode === 'square' || state.mode === 'name';

    els.scoreDisplay.textContent = '0';
    els.timerBox.classList.remove('danger');
    els.streakValue.textContent = '0';
    els.streakDisplay.style.opacity = '0';
    els.promptHint.textContent = MODE_HINTS[state.mode];

    // Timer vs lives display
    if (isSurvival) {
        els.timerBox.style.display = 'none';
        els.livesBox.style.display = 'flex';
        renderLives();
    } else {
        els.timerBox.style.display = 'flex';
        els.livesBox.style.display = 'none';
        els.timerDisplay.textContent = state.session;
    }

    // Choose the answer surface
    els.boardWrapper.style.display = usesBoard ? 'grid' : 'none';
    els.nameAnswerArea.style.display = state.mode === 'name' ? 'flex' : 'none';
    els.colorDrillArea.style.display = state.mode === 'color' ? 'flex' : 'none';

    if (usesBoard) {
        // Name mode always hides coords; Find Square hides on normal/hard
        const hideCoords = state.mode === 'name' || state.difficulty !== 'easy';
        els.boardWrapper.classList.toggle('hide-coords', hideCoords);
        renderBoard();
    }

    // Perspective indicator only when the board can flip
    if (state.difficulty === 'hard' && usesBoard) {
        els.perspectiveIndicator.style.display = 'block';
        updatePerspectiveText();
    } else {
        els.perspectiveIndicator.style.display = 'none';
    }

    showScreen('game');
    if (settings.countdown) {
        runCountdown();
    } else {
        beginRound();
    }
}

function quitGame() {
    state.gameActive = false;
    state.ended = true;
    clearInterval(state.timerInterval);
    state.timerInterval = null;
    sfx('click');
    showScreen('start');
}

function runCountdown() {
    els.countdownOverlay.style.display = 'flex';
    let count = 3;
    const show = (txt) => {
        els.countdownNumber.textContent = txt;
        els.countdownNumber.style.animation = 'none';
        void els.countdownNumber.offsetWidth;
        els.countdownNumber.style.animation = '';
    };
    show(count);
    sfx('tick');

    const interval = setInterval(() => {
        count--;
        if (count > 0) {
            show(count);
            sfx('tick');
        } else if (count === 0) {
            show('GO!');
            sfx('go');
        } else {
            clearInterval(interval);
            els.countdownOverlay.style.display = 'none';
            beginRound();
        }
    }, 700);
}

function beginRound() {
    state.gameActive = true;
    state.gameStartTime = Date.now();
    generatePrompt();
    if (state.session !== 'survival') startTimer();
}

// ---- Timer ----
function startTimer() {
    const startTime = Date.now();
    const totalMs = state.session * 1000;
    let lastWhole = state.session;

    state.timerInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, totalMs - elapsed);
        state.timeRemaining = remaining / 1000;

        const whole = Math.ceil(state.timeRemaining);
        els.timerDisplay.textContent = whole;

        if (state.timeRemaining <= 10) {
            els.timerBox.classList.add('danger');
            if (whole !== lastWhole && whole <= 5 && whole > 0) sfx('tick');
        }
        lastWhole = whole;

        if (remaining <= 0) endGame();
    }, 100);
}

// ---- Board Rendering ----
function renderBoard() {
    els.board.innerHTML = '';
    els.rankLabels.innerHTML = '';
    els.fileLabels.innerHTML = '';

    const ranks = state.isFlipped ? [...RANKS] : [...RANKS].reverse();
    const files = state.isFlipped ? [...FILES].reverse() : [...FILES];

    for (const r of ranks) {
        const label = document.createElement('span');
        label.textContent = r;
        els.rankLabels.appendChild(label);
    }
    for (const f of files) {
        const label = document.createElement('span');
        label.textContent = f;
        els.fileLabels.appendChild(label);
    }

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

    // In Name mode, re-light the current target after a re-render (e.g. flip)
    if (state.mode === 'name' && state.currentPrompt) highlightTarget();
}

function highlightTarget() {
    els.board.querySelectorAll('.square.target').forEach((s) => s.classList.remove('target'));
    const el = els.board.querySelector(`[data-square="${state.currentPrompt}"]`);
    if (el) el.classList.add('target');
}

// ---- Prompt Generation ----
function generatePrompt() {
    const pick = () => Object.keys(state.historicalMisses).length > 0
        ? getWeightedSquare()
        : ALL_SQUARES[randomInt(0, ALL_SQUARES.length - 1)];

    let square = pick();
    let attempts = 0;
    while (square === state.lastPrompt && attempts < 10) {
        square = pick();
        attempts++;
    }

    state.currentPrompt = square;
    state.lastPrompt = square;
    state.promptStartTime = Date.now();

    if (!state.squareStats[square]) {
        state.squareStats[square] = { prompted: 0, totalTime: 0, misses: 0 };
    }
    state.squareStats[square].prompted++;

    // Flip check (board modes, hard difficulty) — do before lighting target
    if (state.difficulty === 'hard' && (state.mode === 'square' || state.mode === 'name')) {
        state.promptsSinceFlip++;
        if (state.promptsSinceFlip >= state.nextFlipAt) {
            flipBoard();
        }
    }

    if (state.mode === 'name') {
        els.promptText.textContent = '?';
        els.promptText.classList.add('mystery');
        highlightTarget();
    } else {
        els.promptText.classList.remove('mystery');
        els.promptText.textContent = square;
    }

    els.promptText.classList.remove('pop');
    void els.promptText.offsetWidth;
    els.promptText.classList.add('pop');
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
    }, settings.animations ? 300 : 0);
}

function updatePerspectiveText() {
    els.perspectiveText.textContent = state.isFlipped
        ? "Black's perspective"
        : "White's perspective";
}

// ---- Answer Handling (square + name modes) ----
function answerSquare(answer, clickedEl) {
    if (!state.gameActive) return;
    state.totalClicks++;

    if (answer === state.currentPrompt) {
        registerCorrect();
        // Green flash on the correct board square (clicked or target)
        const el = clickedEl || els.board.querySelector(`[data-square="${state.currentPrompt}"]`);
        if (el && state.mode === 'square') flashSquare(el, true);
        generatePrompt();
    } else {
        registerWrong();
        if (clickedEl && state.mode === 'square') {
            flashSquare(clickedEl, false);
        } else {
            shakePrompt();
        }
    }
}

function flashSquare(el, correct) {
    const cls = correct ? 'flash-correct' : 'flash-wrong';
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), correct ? 350 : 250);
}

function shakePrompt() {
    els.promptBox.classList.add('shake');
    setTimeout(() => els.promptBox.classList.remove('shake'), 300);
}

function handleColorClick(color) {
    if (!state.gameActive) return;
    state.totalClicks++;

    const correctColor = isLightSquare(state.currentPrompt) ? 'light' : 'dark';
    const btn = color === 'light' ? els.colorLightBtn : els.colorDarkBtn;

    if (color === correctColor) {
        registerCorrect();
        btn.classList.add('flash-correct');
        setTimeout(() => btn.classList.remove('flash-correct'), 300);
        generatePrompt();
    } else {
        registerWrong();
        btn.classList.add('flash-wrong');
        setTimeout(() => btn.classList.remove('flash-wrong'), 300);
    }
}

// ---- Correct / Wrong bookkeeping ----
function registerCorrect() {
    const reactionTime = Date.now() - state.promptStartTime;
    state.score++;
    state.streak++;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    state.reactionTimes.push(reactionTime);
    state.squareStats[state.currentPrompt].totalTime += reactionTime;

    els.scoreDisplay.textContent = state.score;
    bump(els.scoreDisplay);
    updateStreakDisplay();
    sfx('correct');
}

function registerWrong() {
    const sq = state.currentPrompt;
    if (state.squareStats[sq]) state.squareStats[sq].misses++;
    state.historicalMisses[sq] = (state.historicalMisses[sq] || 0) + 1;
    state.streak = 0;
    updateStreakDisplay();
    sfx('wrong');
    haptic(40);

    if (state.session === 'survival') {
        state.lives--;
        renderLives();
        if (state.lives <= 0) {
            state.gameActive = false;   // block further input during the death pause
            setTimeout(endGame, 250);
        }
    }
}

function updateStreakDisplay() {
    els.streakValue.textContent = state.streak;
    els.streakDisplay.style.opacity = state.streak >= 2 ? '1' : '0';
    els.streakDisplay.classList.toggle('hot', state.streak >= 5);
    if (state.streak >= 2) bump(els.streakDisplay);
}

function renderLives() {
    els.livesBox.innerHTML = '';
    for (let i = 0; i < SURVIVAL_LIVES; i++) {
        const h = document.createElement('span');
        h.className = 'life' + (i < state.lives ? '' : ' lost');
        h.textContent = '♥';
        els.livesBox.appendChild(h);
    }
}

function bump(el) {
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
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
    if (state.ended) return;
    state.ended = true;
    state.gameActive = false;
    clearInterval(state.timerInterval);
    state.timerInterval = null;
    sfx('gameover');

    const accuracy = state.totalClicks > 0
        ? Math.round((state.score / state.totalClicks) * 100)
        : 0;
    const avgTime = state.reactionTimes.length > 0
        ? state.reactionTimes.reduce((a, b) => a + b, 0) / state.reactionTimes.length
        : 0;

    // Lifetime stats
    lifetime.drills++;
    lifetime.correct += state.score;
    lifetime.attempts += state.totalClicks;
    lifetime.bestStreak = Math.max(lifetime.bestStreak, state.bestStreak);
    lifetime.timeTrained += Math.round((Date.now() - state.gameStartTime) / 1000);
    saveLifetime();

    const pb = getPersonalBest();
    const isNewPB = state.score > pb;
    if (isNewPB) savePersonalBest(state.score);

    els.statScore.textContent = state.score;
    els.statAccuracy.textContent = `${accuracy}%`;
    els.statAvgTime.textContent = `${(avgTime / 1000).toFixed(2)}s`;
    els.statStreak.textContent = state.bestStreak;
    els.resultsPbBanner.style.display = (isNewPB && state.score > 0) ? 'block' : 'none';

    // Heatmap available for board modes (keyed by square + reaction time)
    if (state.mode === 'square' || state.mode === 'name') {
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

    for (const r of ranks) {
        const label = document.createElement('span');
        label.textContent = r;
        els.heatmapRankLabels.appendChild(label);
    }
    for (const f of files) {
        const label = document.createElement('span');
        label.textContent = f;
        els.heatmapFileLabels.appendChild(label);
    }

    let maxTime = 0;
    for (const sq of ALL_SQUARES) {
        const stats = state.squareStats[sq];
        if (stats && stats.prompted > 0) {
            const avgTime = stats.totalTime / stats.prompted;
            if (avgTime > maxTime) maxTime = avgTime;
        }
    }

    for (const rank of ranks) {
        for (const file of files) {
            const sq = `${file}${rank}`;
            const cell = document.createElement('div');
            cell.className = 'heatmap-cell';

            const stats = state.squareStats[sq];
            if (stats && stats.prompted > 0 && stats.totalTime > 0) {
                const avgTime = stats.totalTime / stats.prompted;
                const ratio = maxTime > 0 ? Math.min(avgTime / Math.max(maxTime, 3000), 1) : 0;
                cell.style.background = heatmapColor(ratio);
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
    if (ratio <= 0.5) {
        const r = Math.round(46 + (255 - 46) * (ratio * 2));
        const g = Math.round(213 + (165 - 213) * (ratio * 2));
        const b = Math.round(115 + (2 - 115) * (ratio * 2));
        return `rgb(${r}, ${g}, ${b})`;
    }
    const t = (ratio - 0.5) * 2;
    const g = Math.round(165 - 165 * t);
    const b = Math.round(2 + (87 - 2) * t);
    return `rgb(255, ${g}, ${b})`;
}

/* ========================================
   SETTINGS & STATS MODALS
   ======================================== */
function setupSettingsListeners() {
    els.settingsBtn.addEventListener('click', () => openModal(els.settingsModal));
    els.closeSettingsBtn.addEventListener('click', () => closeModal(els.settingsModal));
    els.statsBtn.addEventListener('click', () => { syncStatsUI(); openModal(els.statsModal); });
    els.closeStatsBtn.addEventListener('click', () => closeModal(els.statsModal));

    [els.settingsModal, els.statsModal].forEach((m) => {
        m.addEventListener('click', (e) => { if (e.target === m) closeModal(m); });
    });

    els.themeGrid.querySelectorAll('.theme-swatch').forEach((sw) => {
        sw.addEventListener('click', () => {
            settings.boardTheme = sw.dataset.theme;
            saveSettings();
            applySettings();
            syncSettingsUI();
            sfx('click');
        });
    });

    bindToggle(els.toggleSound, 'sound', () => { if (settings.sound) { ensureAudio(); sfx('correct'); } });
    bindToggle(els.toggleHaptics, 'haptics', () => { if (settings.haptics) haptic(30); });
    bindToggle(els.toggleAnimations, 'animations');
    bindToggle(els.toggleCountdown, 'countdown');

    els.resetProgressBtn.addEventListener('click', resetProgress);
}

function bindToggle(btn, key, after) {
    btn.addEventListener('click', () => {
        settings[key] = !settings[key];
        saveSettings();
        applySettings();
        syncSettingsUI();
        if (after) after();
    });
}

function syncSettingsUI() {
    els.themeGrid.querySelectorAll('.theme-swatch').forEach((sw) =>
        sw.classList.toggle('active', sw.dataset.theme === settings.boardTheme));
    setSwitch(els.toggleSound, settings.sound);
    setSwitch(els.toggleHaptics, settings.haptics);
    setSwitch(els.toggleAnimations, settings.animations);
    setSwitch(els.toggleCountdown, settings.countdown);
}

function setSwitch(btn, on) {
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-checked', on ? 'true' : 'false');
}

function syncStatsUI() {
    const acc = lifetime.attempts > 0 ? Math.round((lifetime.correct / lifetime.attempts) * 100) : 0;
    els.ltDrills.textContent = lifetime.drills;
    els.ltCorrect.textContent = lifetime.correct;
    els.ltAccuracy.textContent = `${acc}%`;
    els.ltBestStreak.textContent = lifetime.bestStreak;
    els.ltTime.textContent = formatDuration(lifetime.timeTrained);
    els.ltEmpty.style.display = lifetime.drills === 0 ? 'block' : 'none';
}

function resetProgress() {
    if (!confirm('Reset all personal bests and lifetime stats? This cannot be undone.')) return;
    try {
        Object.keys(localStorage)
            .filter((k) => k.startsWith('chessable-pb-') || k === STATS_KEY)
            .forEach((k) => localStorage.removeItem(k));
    } catch { /* silent */ }
    lifetime = { ...DEFAULT_STATS };
    syncStatsUI();
    updatePersonalBestDisplay();
    sfx('wrong');
}

function openModal(m) {
    m.style.display = 'flex';
    void m.offsetWidth;
    m.classList.add('open');
    sfx('click');
}

function closeModal(m) {
    m.classList.remove('open');
    setTimeout(() => { m.style.display = 'none'; }, settings.animations ? 200 : 0);
}

/* ========================================
   KEYBOARD CONTROLS
   ======================================== */
function setupKeyboard() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (els.settingsModal.classList.contains('open')) return closeModal(els.settingsModal);
            if (els.statsModal.classList.contains('open')) return closeModal(els.statsModal);
            if (state.screen === 'game') return quitGame();
            return;
        }

        // Start a drill with Enter from start / results (unless a modal is open)
        const modalOpen = els.settingsModal.classList.contains('open') || els.statsModal.classList.contains('open');
        if (e.key === 'Enter' && !modalOpen && (state.screen === 'start' || state.screen === 'results')) {
            startGame();
            return;
        }

        if (state.screen !== 'game' || !state.gameActive) return;
        const k = e.key.toLowerCase();

        if (state.mode === 'color') {
            if (k === 'l' || e.key === 'ArrowLeft') handleColorClick('light');
            else if (k === 'd' || e.key === 'ArrowRight') handleColorClick('dark');
            return;
        }

        // Find Square / Name Square: type a coordinate
        if (k >= 'a' && k <= 'h') {
            state.pendingFile = k;
            if (state.mode === 'name') highlightPad();
            tryTypedAnswer();
        } else if (k >= '1' && k <= '8') {
            state.pendingRank = parseInt(k);
            if (state.mode === 'name') highlightPad();
            tryTypedAnswer();
        } else if (e.key === 'Backspace') {
            clearPad();
        }
    });
}

function tryTypedAnswer() {
    if (state.pendingFile && state.pendingRank) {
        const answer = `${state.pendingFile}${state.pendingRank}`;
        if (state.mode === 'name') flashPad(answer === state.currentPrompt);
        answerSquare(answer, null);
        clearPad();
    }
}

/* ========================================
   AUDIO (Web Audio API — no asset files)
   ======================================== */
let audioCtx = null;

function ensureAudio() {
    if (!settings.sound) return;
    if (!audioCtx) {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch { audioCtx = null; }
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

function tone(freq, dur, type = 'sine', gain = 0.08, slideTo = null) {
    if (!settings.sound || !audioCtx) return;
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
}

function sfx(name) {
    if (!settings.sound || !audioCtx) return;
    switch (name) {
        case 'correct':  tone(660, 0.12, 'sine', 0.07, 990); break;
        case 'wrong':    tone(180, 0.18, 'sawtooth', 0.06, 110); break;
        case 'click':    tone(420, 0.05, 'triangle', 0.04); break;
        case 'tick':     tone(880, 0.05, 'square', 0.03); break;
        case 'go':       tone(520, 0.18, 'sine', 0.08, 780); break;
        case 'gameover': tone(440, 0.4, 'sine', 0.08, 160); break;
    }
}

function haptic(ms) {
    if (settings.haptics && navigator.vibrate) {
        try { navigator.vibrate(ms); } catch { /* unsupported */ }
    }
}

/* ========================================
   UTILITIES
   ======================================== */
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatDuration(seconds) {
    if (seconds < 60) return `${seconds}s`;
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').catch(() => { /* offline unavailable */ });
        });
    }
}

// ---- Boot ----
document.addEventListener('DOMContentLoaded', init);
