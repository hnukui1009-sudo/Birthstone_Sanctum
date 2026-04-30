"use strict";

const GRID_SIZE = 7;
const GAME_SECONDS = 60;
const BASE_TILE_SCORE = 100;
const MOVE_TIME = 230;
const CLEAR_TIME = 560;
const INVALID_TIME = 330;
const RESHUFFLE_TIME = 560;
const HINT_DELAY = 7000;
const RESONANCE_MAX = 100;
const RESONANCE_DURATION = 7000;
const RESONANCE_TIME_SCALE = 0.35;
const RESONANCE_SCORE_MULTIPLIER = 1.65;
const MATCH_STREAK_WINDOW = 2600;
const COMBO_MUSIC_MAX_LEVEL = 6;
const SPECIAL_STONE_INTERVAL = 50;
const TIME_UP_HOLD = 3000;
const PIXEL_TEMPLE_HOLD = 5000;
const PIXEL_TEMPLE_DRAW_UNTIL = 4850;
const PIXEL_TEMPLE_FADE_START = 4200;
const TEMPLE_STORAGE_KEY = "birthstone-columns-temple-progress";
const BGM_VOLUME_KEY = "birthstone-columns-bgm-volume";
const SFX_VOLUME_KEY = "birthstone-columns-sfx-volume";
const STONE_PITCHES = [146.83, 164.81, 196.00, 220.00, 246.94, 261.63, 293.66];

const BIRTHSTONES = [
  { id: "garnet", name: "Garnet", short: "Ga", color: "#b4092f", dark: "#41000f", light: "#ff8a9a" },
  { id: "amethyst", name: "Amethyst", short: "Am", color: "#a238ff", dark: "#35007f", light: "#f3c2ff" },
  { id: "aquamarine", name: "Aquamarine", short: "Aq", color: "#00ddff", dark: "#005d76", light: "#d6fbff" },
  { id: "emerald", name: "Emerald", short: "Em", color: "#00ef74", dark: "#005c35", light: "#baffcb" },
  { id: "ruby", name: "Ruby", short: "Ru", color: "#ff1456", dark: "#8c001f", light: "#ffc0ce" },
  { id: "sapphire", name: "Sapphire", short: "Sa", color: "#235bff", dark: "#001c91", light: "#a9c8ff" },
  { id: "topaz", name: "Topaz", short: "To", color: "#ffcf24", dark: "#975400", light: "#fff09a" },
  { id: "diamond", name: "Diamond", short: "Di", color: "#f7fdff", dark: "#83baff", light: "#ffffff" },
  { id: "pearl", name: "Pearl", short: "Pe", color: "#fff4c7", dark: "#c7a75c", light: "#ffffff" },
  { id: "peridot", name: "Peridot", short: "Pr", color: "#c8ff2e", dark: "#558500", light: "#f5ff96" },
  { id: "opal", name: "Opal", short: "Op", color: "#ff71dc", dark: "#8d006d", light: "#fff0fb" },
  { id: "turquoise", name: "Turquoise", short: "Tu", color: "#00f0cf", dark: "#007469", light: "#b2fff3" }
];

const ACTIVE_STONE_COUNT = 7;
const ACTIVE_STONES = BIRTHSTONES.slice(0, ACTIVE_STONE_COUNT);
const BACKDROP_STAGES = [
  { id: "moon", phase: "calm", art: "assets/bg-moon-gate.svg" },
  { id: "jade", phase: "lit", art: "assets/bg-jade-courtyard.svg" },
  { id: "lantern", phase: "peak", art: "assets/bg-lantern-hall.svg" }
];
const TEMPLE_LEVELS = [
  { name: "Sealed Gate", threshold: 0 },
  { name: "Amber Steps", threshold: 120 },
  { name: "Jade Court", threshold: 320 },
  { name: "Ruby Altar", threshold: 620 },
  { name: "Moon Vault", threshold: 1040 },
  { name: "Astral Sanctum", threshold: 1600 }
];
const SCORE_TEMPLE_MILESTONES = [
  { score: 20000, title: "Gate Opens", subtitle: "Bronze pillars wake", tier: 0 },
  { score: 50000, title: "Jade Court", subtitle: "The arcade shrine rises", tier: 1 },
  { score: 85000, title: "Ruby Altar", subtitle: "Columns of light align", tier: 2 },
  { score: 125000, title: "Moon Vault", subtitle: "The sanctum reveals itself", tier: 3 },
  { score: 145000, title: "Star Pavilion", subtitle: "Twin halls unfold", tier: 4 },
  { score: 165000, title: "Dragon Corridor", subtitle: "Outer gates ignite", tier: 5 },
  { score: 185000, title: "Celestial Spire", subtitle: "The tower pierces night", tier: 6 },
  { score: 200000, title: "Astral Sanctum", subtitle: "The full temple awakens", tier: 7 }
];

const qs = (selector, root = document) => root.querySelector(selector);
const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
const randomInt = (max) => Math.floor(Math.random() * max);
const randomBetween = (min, max) => min + Math.random() * (max - min);
const randomChoice = (items) => items[randomInt(items.length)];

class Tile {
  constructor(id, type, row, col) {
    this.id = id;
    this.type = type;
    this.row = row;
    this.col = col;
    this.spawnRow = row;
    this.el = null;
    this.special = false;
  }
}

class BoardLogic {
  constructor(size, typeCount) {
    this.size = size;
    this.typeCount = typeCount;
    this.grid = [];
    this.nextTileId = 1;
  }

  reset() {
    let attempts = 0;
    do {
      this.grid = Array.from({ length: this.size }, () => Array(this.size).fill(null));
      this.nextTileId = 1;

      for (let row = 0; row < this.size; row += 1) {
        for (let col = 0; col < this.size; col += 1) {
          const type = this.pickSafeType(row, col);
          this.grid[row][col] = this.createTile(type, row, col);
        }
      }

      attempts += 1;
    } while ((this.findMatches().tiles.length > 0 || !this.hasPossibleMove()) && attempts < 100);
  }

  createTile(type, row, col) {
    const tile = new Tile(this.nextTileId, type, row, col);
    this.nextTileId += 1;
    return tile;
  }

  randomType() {
    return randomInt(this.typeCount);
  }

  pickSafeType(row, col) {
    const options = Array.from({ length: this.typeCount }, (_, index) => index);
    this.shuffleArray(options);

    return options.find((type) => !this.wouldCreateMatch(row, col, type)) ?? options[0];
  }

  wouldCreateMatch(row, col, type) {
    const hasSame = (...coords) => coords.every(([checkRow, checkCol]) => {
      const tile = this.tileAt(checkRow, checkCol);
      return tile && tile.type === type;
    });

    const makesLine = [
      [[row, col - 1], [row, col - 2]],
      [[row - 1, col], [row - 2, col]],
      [[row - 1, col - 1], [row - 2, col - 2]],
      [[row - 1, col + 1], [row - 2, col + 2]]
    ].some((coords) => hasSame(...coords));

    const makesSquare = [
      [[row, col + 1], [row + 1, col], [row + 1, col + 1]],
      [[row, col - 1], [row + 1, col - 1], [row + 1, col]],
      [[row - 1, col], [row - 1, col + 1], [row, col + 1]],
      [[row - 1, col - 1], [row - 1, col], [row, col - 1]]
    ].some((coords) => hasSame(...coords));

    return makesLine || makesSquare;
  }

  tileAt(row, col) {
    if (row < 0 || row >= this.size || col < 0 || col >= this.size) {
      return null;
    }

    return this.grid[row][col];
  }

  allTiles() {
    return this.grid.flat().filter(Boolean);
  }

  areAdjacent(tileA, tileB) {
    return Math.abs(tileA.row - tileB.row) + Math.abs(tileA.col - tileB.col) === 1;
  }

  neighbor(tile, direction) {
    const offsets = {
      left: [0, -1],
      right: [0, 1],
      up: [-1, 0],
      down: [1, 0]
    };
    const [rowOffset, colOffset] = offsets[direction] ?? [0, 0];
    return this.tileAt(tile.row + rowOffset, tile.col + colOffset);
  }

  swapTiles(tileA, tileB) {
    const aRow = tileA.row;
    const aCol = tileA.col;
    const bRow = tileB.row;
    const bCol = tileB.col;

    this.grid[aRow][aCol] = tileB;
    this.grid[bRow][bCol] = tileA;
    tileA.row = bRow;
    tileA.col = bCol;
    tileB.row = aRow;
    tileB.col = aCol;
  }

  findMatches() {
    const matched = new Set();
    const groups = [];
    const addGroup = (direction, tiles) => {
      groups.push({ direction, tiles: [...tiles] });
      tiles.forEach((tile) => matched.add(tile));
    };
    const scanLine = (line, direction) => {
      let run = [];

      for (let index = 0; index <= line.length; index += 1) {
        const current = index < line.length ? line[index] : null;
        const previous = run[0];

        if (current && previous && current.type === previous.type) {
          run.push(current);
        } else {
          if (run.length >= 3 && previous) {
            addGroup(direction, run);
          }
          run = current ? [current] : [];
        }
      }
    };

    for (let row = 0; row < this.size; row += 1) {
      scanLine(this.grid[row], "horizontal");
    }

    for (let col = 0; col < this.size; col += 1) {
      scanLine(Array.from({ length: this.size }, (_, row) => this.grid[row][col]), "vertical");
    }

    for (let startCol = 0; startCol < this.size; startCol += 1) {
      scanLine(this.diagonalFrom(0, startCol, 1, 1), "diagonal-down-right");
      scanLine(this.diagonalFrom(0, startCol, 1, -1), "diagonal-down-left");
    }

    for (let startRow = 1; startRow < this.size; startRow += 1) {
      scanLine(this.diagonalFrom(startRow, 0, 1, 1), "diagonal-down-right");
      scanLine(this.diagonalFrom(startRow, this.size - 1, 1, -1), "diagonal-down-left");
    }

    for (let row = 0; row < this.size - 1; row += 1) {
      for (let col = 0; col < this.size - 1; col += 1) {
        const square = [
          this.grid[row][col],
          this.grid[row][col + 1],
          this.grid[row + 1][col],
          this.grid[row + 1][col + 1]
        ];
        const first = square[0];

        if (first && square.every((tile) => tile && tile.type === first.type)) {
          addGroup("square", square);
        }
      }
    }

    return { groups, tiles: [...matched] };
  }

  findMatchesTouching(tiles) {
    const touched = new Set(tiles.filter(Boolean));
    const matches = this.findMatches();
    const groups = matches.groups.filter((group) => group.tiles.some((tile) => touched.has(tile)));
    const groupedTiles = new Set();

    groups.forEach((group) => {
      group.tiles.forEach((tile) => groupedTiles.add(tile));
    });

    return { groups, tiles: [...groupedTiles] };
  }

  diagonalFrom(row, col, rowStep, colStep) {
    const line = [];

    while (row >= 0 && row < this.size && col >= 0 && col < this.size) {
      line.push(this.grid[row][col]);
      row += rowStep;
      col += colStep;
    }

    return line;
  }

  clearTiles(tiles) {
    tiles.forEach((tile) => {
      if (this.grid[tile.row]?.[tile.col] === tile) {
        this.grid[tile.row][tile.col] = null;
      }
    });
  }

  collapse() {
    const moved = [];
    const spawned = [];

    for (let col = 0; col < this.size; col += 1) {
      const survivors = [];

      for (let row = this.size - 1; row >= 0; row -= 1) {
        const tile = this.grid[row][col];
        if (tile) {
          survivors.push(tile);
        }
      }

      for (let row = 0; row < this.size; row += 1) {
        this.grid[row][col] = null;
      }

      let writeRow = this.size - 1;
      survivors.forEach((tile) => {
        const oldRow = tile.row;
        tile.row = writeRow;
        tile.col = col;
        this.grid[writeRow][col] = tile;

        if (oldRow !== writeRow) {
          moved.push({ tile, distance: Math.abs(writeRow - oldRow) });
        }

        writeRow -= 1;
      });

      const missing = writeRow + 1;
      for (let row = writeRow; row >= 0; row -= 1) {
        const tile = this.createTile(this.randomType(), row, col);
        tile.spawnRow = row - missing;
        this.grid[row][col] = tile;
        spawned.push({ tile, distance: Math.abs(row - tile.spawnRow) });
      }
    }

    return { moved, spawned };
  }

  hasPossibleMove() {
    return Boolean(this.findPossibleMove());
  }

  findPossibleMove() {
    for (let row = 0; row < this.size; row += 1) {
      for (let col = 0; col < this.size; col += 1) {
        const tile = this.grid[row][col];
        const candidates = [this.tileAt(row, col + 1), this.tileAt(row + 1, col)].filter(Boolean);

        for (const other of candidates) {
          this.swapTiles(tile, other);
          const hasMatch = this.findMatchesTouching([tile, other]).tiles.length > 0;
          this.swapTiles(tile, other);

          if (hasMatch) {
            return { from: tile, to: other };
          }
        }
      }
    }

    return null;
  }

  rerollUntilPlayable() {
    let attempts = 0;
    const tilesByPosition = this.grid.map((row) => [...row]);

    do {
      this.grid = Array.from({ length: this.size }, () => Array(this.size).fill(null));

      for (let row = 0; row < this.size; row += 1) {
        for (let col = 0; col < this.size; col += 1) {
          const tile = tilesByPosition[row][col];
          tile.row = row;
          tile.col = col;
          tile.spawnRow = row;
          tile.type = this.pickSafeType(row, col);
          this.grid[row][col] = tile;
        }
      }

      attempts += 1;
    } while ((this.findMatches().tiles.length > 0 || !this.hasPossibleMove()) && attempts < 250);

    if (attempts >= 250) {
      this.reset();
      return false;
    }

    return true;
  }

  shuffleArray(items) {
    for (let index = items.length - 1; index > 0; index -= 1) {
      const swapIndex = randomInt(index + 1);
      [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
    }
  }
}

class Game {
  constructor() {
    this.logic = new BoardLogic(GRID_SIZE, ACTIVE_STONES.length);
    this.state = "start";
    this.score = 0;
    this.bestScore = Number(window.localStorage.getItem("birthstone-columns-best") || 0);
    this.remaining = GAME_SECONDS;
    this.displayCombo = 1;
    this.startedAt = 0;
    this.lastTickAt = 0;
    this.timerFrame = 0;
    this.hintTimer = 0;
    this.timeUpTimer = 0;
    this.pixelTempleTimer = 0;
    this.pixelTempleFrame = 0;
    this.selectedTile = null;
    this.pointerStart = null;
    this.processingMatches = false;
    this.pendingResolution = false;
    this.boardLocked = false;
    this.swapInProgress = false;
    this.swappingTiles = new Set();
    this.clearingTiles = new Set();
    this.fallingTiles = new Set();
    this.hintTiles = new Set();
    this.soundEnabled = true;
    this.bgmVolume = this.loadVolume(BGM_VOLUME_KEY, 0.72);
    this.sfxVolume = this.loadVolume(SFX_VOLUME_KEY, 0.88);
    this.audioContext = null;
    this.musicGain = null;
    this.musicTimer = 0;
    this.musicStep = 0;
    this.musicMode = null;
    this.musicIntensity = 1;
    this.musicIntervalMs = 0;
    this.musicProfile = this.createMusicProfile();
    this.resonance = 0;
    this.resonanceActive = false;
    this.resonanceTimer = 0;
    this.themePhase = "";
    this.stageId = "";
    this.matchStreak = 0;
    this.lastMatchAt = 0;
    this.clearedStoneTotal = 0;
    this.nextSpecialAt = SPECIAL_STONE_INTERVAL;
    this.pendingSpecialStones = 0;
    this.runStats = this.createRunStats();
    this.templeProgress = this.loadTempleProgress();
    this.missionSet = this.createMissionSet();
    this.missionsResolved = false;

    this.screens = {
      start: qs("#startScreen"),
      game: qs("#gameScreen"),
      over: qs("#gameOverScreen")
    };
    this.appShell = qs(".app-shell");
    this.boardEl = qs("#board");
    this.boardShell = qs("#boardShell");
    this.resonanceLayer = qs("#resonanceLayer");
    this.timeUpOverlay = qs("#timeUpOverlay");
    this.pixelTempleOverlay = qs("#pixelTempleOverlay");
    this.pixelTempleCanvas = qs("#pixelTempleCanvas");
    this.pixelTempleTitle = qs("#pixelTempleTitle");
    this.pixelTempleScore = qs("#pixelTempleScore");
    this.timerText = qs("#timerText");
    this.scoreText = qs("#scoreText");
    this.comboText = qs("#comboText");
    this.specialText = qs("#specialText");
    this.resonanceText = qs("#resonanceText");
    this.resonanceFill = qs("#resonanceFill");
    this.resonanceButton = qs("#resonanceButton");
    this.resonanceHud = qs(".resonance-hud");
    this.comboRibbon = qs("#comboRibbon");
    this.backdropEl = qs("#sceneBackdrop");
    this.finalScoreText = qs("#finalScoreText");
    this.bestScoreText = qs("#bestScoreText");
    this.resultTitleText = qs("#resultTitleText");
    this.resultStats = qs("#resultStats");
    this.startMissionList = qs("#startMissionList");
    this.missionResults = qs("#missionResults");
    this.missionSummaryText = qs("#missionSummaryText");
    this.templeRankText = qs("#templeRankText");
    this.templeProgressText = qs("#templeProgressText");
    this.templeFill = qs("#templeFill");
    this.templeRewardText = qs("#templeRewardText");
    this.resultTempleRankText = qs("#resultTempleRankText");
    this.resultTempleProgressText = qs("#resultTempleProgressText");
    this.resultTempleFill = qs("#resultTempleFill");
    this.soundButton = qs("#soundButton");
    this.bgmVolumeInput = qs("#bgmVolume");
    this.sfxVolumeInput = qs("#sfxVolume");
    this.titleButton = qs("#titleButton");
    this.stoneList = qs("#stoneList");

    this.syncAudioControls();
    this.bindEvents();
    this.renderStoneList();
    this.setBackdrop();
    this.updateHud();
    this.renderMissionPreview();
    this.renderTempleProgress();
  }

  bindEvents() {
    qs("#startButton").addEventListener("click", () => this.startGame());
    qs("#restartButton").addEventListener("click", () => this.startGame());
    this.titleButton.addEventListener("click", () => this.returnToTitle());
    this.soundButton.addEventListener("click", () => this.toggleSound());
    this.bgmVolumeInput?.addEventListener("input", () => this.setBgmVolume(this.bgmVolumeInput.value));
    this.sfxVolumeInput?.addEventListener("input", () => this.setSfxVolume(this.sfxVolumeInput.value));
    this.resonanceButton.addEventListener("click", () => this.activateResonance());
    document.addEventListener("pointerdown", () => this.unlockAudio(), { once: true, capture: true });
    this.boardEl.addEventListener("pointerdown", (event) => this.handlePointerDown(event));
    this.boardEl.addEventListener("pointermove", (event) => this.handlePointerMove(event));
    this.boardEl.addEventListener("pointerup", (event) => this.handlePointerUp(event));
    this.boardEl.addEventListener("pointercancel", () => {
      this.pointerStart = null;
    });
    this.boardEl.addEventListener("keydown", (event) => this.handleKeyDown(event));
    window.addEventListener("resize", () => this.syncAllPositions(true));
  }

  loadVolume(key, fallback) {
    const stored = Number(window.localStorage.getItem(key));
    if (!Number.isFinite(stored)) {
      return fallback;
    }

    return Math.max(0, Math.min(1, stored));
  }

  syncAudioControls() {
    if (this.bgmVolumeInput) {
      this.bgmVolumeInput.value = String(Math.round(this.bgmVolume * 100));
    }
    if (this.sfxVolumeInput) {
      this.sfxVolumeInput.value = String(Math.round(this.sfxVolume * 100));
    }
  }

  setBgmVolume(rawValue) {
    this.bgmVolume = Math.max(0, Math.min(1, Number(rawValue) / 100));
    window.localStorage.setItem(BGM_VOLUME_KEY, String(this.bgmVolume));

    if (this.musicGain && this.audioContext && this.musicMode) {
      const now = this.audioContext.currentTime;
      this.musicGain.gain.cancelScheduledValues(now);
      this.musicGain.gain.setTargetAtTime(Math.max(0.0001, this.musicVolumeForMode(this.musicMode)), now, 0.08);
    }
  }

  setSfxVolume(rawValue) {
    this.sfxVolume = Math.max(0, Math.min(1, Number(rawValue) / 100));
    window.localStorage.setItem(SFX_VOLUME_KEY, String(this.sfxVolume));
  }

  renderStoneList() {
    this.stoneList.innerHTML = "";

    ACTIVE_STONES.forEach((stone, index) => {
      const chip = document.createElement("div");
      chip.className = "stone-chip";
      chip.dataset.type = String(index);
      chip.style.setProperty("--stone", stone.color);
      chip.textContent = stone.name;
      this.stoneList.appendChild(chip);
    });
  }

  createRunStats() {
    return {
      score: 0,
      cleared: 0,
      totalGroups: 0,
      diagonalMatches: 0,
      squareMatches: 0,
      lineMatches: 0,
      maxChain: 1,
      maxClear: 0,
      maxMultiplier: 1,
      specialUses: 0,
      resonanceUses: 0,
      resonanceMatches: 0,
      stoneClears: Array.from({ length: ACTIVE_STONES.length }, () => 0)
    };
  }

  loadTempleProgress() {
    try {
      const stored = JSON.parse(window.localStorage.getItem(TEMPLE_STORAGE_KEY) || "{}");
      return { points: Math.max(0, Number(stored.points) || 0) };
    } catch (error) {
      return { points: 0 };
    }
  }

  saveTempleProgress() {
    window.localStorage.setItem(TEMPLE_STORAGE_KEY, JSON.stringify(this.templeProgress));
  }

  templeState(points = this.templeProgress.points) {
    let levelIndex = 0;
    for (let index = 0; index < TEMPLE_LEVELS.length; index += 1) {
      if (points >= TEMPLE_LEVELS[index].threshold) {
        levelIndex = index;
      }
    }
    const level = TEMPLE_LEVELS[levelIndex];
    const next = TEMPLE_LEVELS[levelIndex + 1] ?? null;
    const span = next ? next.threshold - level.threshold : 1;
    const earned = next ? points - level.threshold : span;
    const percent = next ? Math.max(0, Math.min(100, (earned / span) * 100)) : 100;

    return { level, next, levelIndex, earned, span, percent };
  }

  createMissionSet() {
    const tier = this.templeState().levelIndex;
    const scale = 1 + Math.min(5, tier) * 0.06;
    const stoneIndex = randomInt(ACTIVE_STONES.length);
    const stone = ACTIVE_STONES[stoneIndex];
    const scoreTarget = Math.round((12500 * scale) / 500) * 500;
    const clearTarget = Math.round(62 * scale);
    const groupTarget = Math.round(14 * scale);

    const easy = [
      {
        id: "clear-stones",
        label: `Awaken ${clearTarget} stones`,
        target: clearTarget,
        reward: 24,
        metric: (stats) => stats.cleared
      },
      {
        id: "score-offering",
        label: `Score ${this.formatNumber(scoreTarget)}`,
        target: scoreTarget,
        reward: 26,
        metric: (stats) => stats.score,
        formatter: (value) => this.formatNumber(value)
      },
      {
        id: "match-groups",
        label: `Complete ${groupTarget} matches`,
        target: groupTarget,
        reward: 22,
        metric: (stats) => stats.totalGroups
      }
    ];
    const skill = [
      {
        id: "chain-three",
        label: "Reach CHAIN 3x",
        target: 3,
        reward: 30,
        metric: (stats) => stats.maxChain,
        suffix: "x"
      },
      {
        id: "diagonal-seer",
        label: "Make 3 diagonal matches",
        target: 3,
        reward: 34,
        metric: (stats) => stats.diagonalMatches
      },
      {
        id: "square-sigil",
        label: "Make 3 square seals",
        target: 3,
        reward: 34,
        metric: (stats) => stats.squareMatches
      },
      {
        id: "large-clear",
        label: "Clear 8 stones at once",
        target: 8,
        reward: 32,
        metric: (stats) => stats.maxClear
      }
    ];
    const style = [
      {
        id: "special-call",
        label: "Use SPECIAL once",
        target: 1,
        reward: 36,
        metric: (stats) => stats.specialUses
      },
      {
        id: "resonance-call",
        label: "Trigger Resonance",
        target: 1,
        reward: 38,
        metric: (stats) => stats.resonanceUses
      },
      {
        id: `stone-${stone.id}`,
        label: `Clear ${stone.name} x14`,
        target: 14,
        reward: 30,
        metric: (stats) => stats.stoneClears[stoneIndex] ?? 0
      },
      {
        id: "line-rites",
        label: "Make 8 line matches",
        target: 8,
        reward: 28,
        metric: (stats) => stats.lineMatches
      }
    ];

    return [randomChoice(easy), randomChoice(skill), randomChoice(style)];
  }

  renderTempleProgress() {
    const state = this.templeState();
    const progressText = state.next
      ? `${Math.floor(state.earned)} / ${state.span}`
      : "MAX";
    const fillWidth = `${state.percent.toFixed(1)}%`;

    [this.templeRankText, this.resultTempleRankText].forEach((element) => {
      if (element) {
        element.textContent = state.level.name;
      }
    });
    [this.templeProgressText, this.resultTempleProgressText].forEach((element) => {
      if (element) {
        element.textContent = progressText;
      }
    });
    [this.templeFill, this.resultTempleFill].forEach((element) => {
      if (element) {
        element.style.width = fillWidth;
      }
    });
  }

  formatMissionProgress(mission, value) {
    const capped = Math.min(mission.target, Math.floor(value));
    const valueText = mission.formatter ? mission.formatter(capped) : String(capped);
    const targetText = mission.formatter ? mission.formatter(mission.target) : String(mission.target);
    return `${valueText}${mission.suffix ?? ""} / ${targetText}${mission.suffix ?? ""}`;
  }

  renderMissionList(container, entries, showRewards = true) {
    if (!container) {
      return;
    }

    container.innerHTML = "";
    entries.forEach((entry) => {
      const mission = entry.mission ?? entry;
      const value = entry.value ?? 0;
      const completed = Boolean(entry.completed);
      const item = document.createElement("li");
      const label = document.createElement("span");
      const progress = document.createElement("strong");
      const reward = document.createElement("em");

      item.className = "mission-item";
      item.classList.toggle("is-complete", completed);
      label.textContent = mission.label;
      progress.textContent = this.formatMissionProgress(mission, value);
      reward.textContent = showRewards ? `+${mission.reward}` : "";
      item.append(label, progress);
      if (showRewards) {
        item.append(reward);
      }
      container.appendChild(item);
    });
  }

  renderMissionPreview() {
    this.renderMissionList(this.startMissionList, this.missionSet, true);
  }

  recordMatchStats(matches, chain, scoreResult) {
    const stats = this.runStats;

    stats.score = this.score;
    stats.cleared += matches.tiles.length;
    stats.totalGroups += matches.groups.length;
    stats.maxChain = Math.max(stats.maxChain, chain);
    stats.maxClear = Math.max(stats.maxClear, matches.tiles.length);
    stats.maxMultiplier = Math.max(stats.maxMultiplier, scoreResult.multiplier);

    if (this.resonanceActive) {
      stats.resonanceMatches += 1;
    }

    matches.tiles.forEach((tile) => {
      if (typeof stats.stoneClears[tile.type] === "number") {
        stats.stoneClears[tile.type] += 1;
      }
    });

    matches.groups.forEach((group) => {
      if (group.direction.startsWith("diagonal")) {
        stats.diagonalMatches += 1;
      } else if (group.direction === "square") {
        stats.squareMatches += 1;
      } else if (group.direction === "horizontal" || group.direction === "vertical") {
        stats.lineMatches += 1;
      }
    });
  }

  resolveRunProgress() {
    this.runStats.score = this.score;

    const missionResults = this.missionSet.map((mission) => {
      const value = Math.floor(mission.metric(this.runStats));
      return {
        mission,
        value,
        completed: value >= mission.target
      };
    });
    const completedCount = missionResults.filter((result) => result.completed).length;
    const missionBonus = missionResults.reduce((sum, result) => (
      sum + (result.completed ? result.mission.reward : 0)
    ), 0);
    const baseLight = this.calculateSanctumLight();
    const totalLight = baseLight + missionBonus;

    this.templeProgress.points += totalLight;
    this.saveTempleProgress();
    this.missionsResolved = true;

    return { missionResults, completedCount, baseLight, missionBonus, totalLight };
  }

  calculateSanctumLight() {
    return 5
      + Math.floor(this.runStats.cleared / 12)
      + Math.floor(this.score / 7000)
      + Math.max(0, this.runStats.maxChain - 1) * 3
      + this.runStats.specialUses * 5
      + this.runStats.resonanceUses * 5;
  }

  runTitle() {
    if (this.runStats.maxChain >= 6) {
      return "Echo Hierophant";
    }
    if (this.runStats.resonanceUses > 0) {
      return "Resonance Keeper";
    }
    if (this.runStats.specialUses > 0) {
      return "Stone Caller";
    }
    if (this.runStats.diagonalMatches >= 3) {
      return "Diagonal Seer";
    }
    if (this.runStats.squareMatches >= 3) {
      return "Sigil Mason";
    }
    if (this.runStats.cleared >= 80) {
      return "Gem Harvester";
    }
    return "Gem Acolyte";
  }

  renderRunResults(outcome) {
    if (this.resultTitleText) {
      this.resultTitleText.textContent = this.runTitle();
    }
    if (this.resultStats) {
      const topStoneIndex = this.runStats.stoneClears
        .reduce((best, count, index, list) => (count > list[best] ? index : best), 0);
      const topStone = ACTIVE_STONES[topStoneIndex];
      const stats = [
        ["Stones", this.formatNumber(this.runStats.cleared)],
        ["Best Chain", `${this.runStats.maxChain}x`],
        ["Largest Clear", this.formatNumber(this.runStats.maxClear)],
        ["Top Stone", `${topStone.short} ${this.runStats.stoneClears[topStoneIndex]}`],
        ["SPECIAL", this.formatNumber(this.runStats.specialUses)],
        ["Resonance", this.formatNumber(this.runStats.resonanceUses)]
      ];

      this.resultStats.innerHTML = "";
      stats.forEach(([label, value]) => {
        const item = document.createElement("div");
        const name = document.createElement("span");
        const number = document.createElement("strong");
        name.textContent = label;
        number.textContent = value;
        item.append(name, number);
        this.resultStats.appendChild(item);
      });
    }

    if (this.missionSummaryText) {
      this.missionSummaryText.textContent = `${outcome.completedCount} / ${outcome.missionResults.length}`;
    }
    if (this.templeRewardText) {
      this.templeRewardText.textContent = `+${outcome.totalLight}`;
    }
    this.renderMissionList(this.missionResults, outcome.missionResults, true);
    this.renderTempleProgress();
  }

  setBackdrop() {
    if (!this.backdropEl) {
      return;
    }

    const stage = this.stageForPhase(this.themePhase || "calm");
    this.stageId = stage.id;
    this.backdropEl.style.setProperty("--scene-art", `url("${stage.art}")`);
    this.backdropEl.classList.add("is-visible");
    this.appShell?.classList.add(`stage-${stage.id}`);
  }

  stageForPhase(phase) {
    return BACKDROP_STAGES.find((stage) => stage.phase === phase) ?? BACKDROP_STAGES[0];
  }

  startGame() {
    this.ensureAudio();
    window.cancelAnimationFrame(this.timerFrame);
    this.clearTimeUpTimer();
    this.hideTimeUpOverlay();
    this.hidePixelTemple();
    if (this.missionsResolved) {
      this.missionSet = this.createMissionSet();
      this.missionsResolved = false;
    }
    this.state = "playing";
    this.musicProfile = this.createMusicProfile();
    this.resetMusicIntensity(false);
    this.startMusic("game");
    this.score = 0;
    this.remaining = GAME_SECONDS;
    this.displayCombo = 1;
    this.clearedStoneTotal = 0;
    this.nextSpecialAt = SPECIAL_STONE_INTERVAL;
    this.pendingSpecialStones = 0;
    this.runStats = this.createRunStats();
    this.resetResonance();
    this.resetMatchStreak();
    this.selectedTile = null;
    this.pointerStart = null;
    this.processingMatches = false;
    this.pendingResolution = false;
    this.boardLocked = false;
    this.swapInProgress = false;
    this.swappingTiles.clear();
    this.clearingTiles.clear();
    this.fallingTiles.clear();
    this.clearHint();
    this.logic.reset();
    this.showScreen("game");
    this.renderBoard();
    this.renderMissionPreview();
    this.renderTempleProgress();
    this.updateHud();
    this.startedAt = performance.now();
    this.lastTickAt = this.startedAt;
    this.resetHintTimer();
    this.tickTimer();
    this.playSound("start");
  }

  returnToTitle() {
    this.state = "start";
    this.clearTimeUpTimer();
    this.hideTimeUpOverlay();
    this.hidePixelTemple();
    if (this.missionsResolved) {
      this.missionSet = this.createMissionSet();
      this.missionsResolved = false;
    }
    this.endResonance(false);
    this.resetMusicIntensity();
    this.clearSelection();
    this.clearHintTimer();
    this.clearHint();
    window.cancelAnimationFrame(this.timerFrame);
    this.showScreen("start");
    this.renderMissionPreview();
    this.renderTempleProgress();
    this.startMusic("title");
  }

  showScreen(name) {
    Object.entries(this.screens).forEach(([screenName, screen]) => {
      screen.classList.toggle("is-active", screenName === name);
    });
    this.updateThemePhase();
  }

  tickTimer() {
    if (this.state === "over" || this.state === "start" || this.state === "timeup") {
      return;
    }

    const now = performance.now();
    const delta = Math.min(0.25, Math.max(0, (now - this.lastTickAt) / 1000));
    const timeScale = this.resonanceActive ? RESONANCE_TIME_SCALE : 1;
    this.lastTickAt = now;
    this.remaining = Math.max(0, this.remaining - delta * timeScale);
    this.updateHud();

    if (this.remaining <= 0) {
      this.endGame();
      return;
    }

    this.timerFrame = window.requestAnimationFrame(() => this.tickTimer());
  }

  endGame() {
    if (this.state === "over" || this.state === "timeup") {
      return;
    }

    this.state = "timeup";
    this.remaining = 0;
    this.endResonance(false);
    this.resetMusicIntensity();
    this.clearSelection();
    this.clearHintTimer();
    this.clearHint();
    window.cancelAnimationFrame(this.timerFrame);
    this.updateHud();
    this.showTimeUpOverlay();
    this.playSound("timeup");
    this.timeUpTimer = window.setTimeout(() => this.showGameOver(), TIME_UP_HOLD);
  }

  showGameOver() {
    if (this.state !== "timeup") {
      return;
    }

    this.state = "over";
    this.clearTimeUpTimer();
    this.hideTimeUpOverlay();
    const milestone = this.scoreTempleMilestoneForScore(this.score);

    if (milestone) {
      this.showPixelTemple(milestone, () => this.presentGameOverResults());
      return;
    }

    this.presentGameOverResults();
  }

  presentGameOverResults() {
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      window.localStorage.setItem("birthstone-columns-best", String(this.bestScore));
    }

    this.finalScoreText.textContent = this.formatNumber(this.score);
    this.bestScoreText.textContent = this.formatNumber(this.bestScore);
    this.renderRunResults(this.resolveRunProgress());
    this.showScreen("over");
    this.startMusic("over");
    this.playSound("over");
  }

  showTimeUpOverlay() {
    if (!this.timeUpOverlay) {
      return;
    }

    this.timeUpOverlay.classList.remove("is-visible");
    void this.timeUpOverlay.offsetWidth;
    this.timeUpOverlay.classList.add("is-visible");
    this.timeUpOverlay.setAttribute("aria-hidden", "false");
  }

  hideTimeUpOverlay() {
    this.timeUpOverlay?.classList.remove("is-visible");
    this.timeUpOverlay?.setAttribute("aria-hidden", "true");
  }

  clearTimeUpTimer() {
    if (this.timeUpTimer) {
      window.clearTimeout(this.timeUpTimer);
      this.timeUpTimer = 0;
    }
  }

  addScore(points) {
    this.score += points;
  }

  scoreTempleMilestoneForScore(score) {
    let selected = null;
    SCORE_TEMPLE_MILESTONES.forEach((milestone, index) => {
      if (score >= milestone.score) {
        selected = { ...milestone, index };
      }
    });

    return selected;
  }

  showPixelTemple(milestone, onComplete = null) {
    if (!this.pixelTempleOverlay || !this.pixelTempleCanvas) {
      onComplete?.();
      return;
    }

    window.cancelAnimationFrame(this.pixelTempleFrame);
    if (this.pixelTempleTimer) {
      window.clearTimeout(this.pixelTempleTimer);
      this.pixelTempleTimer = 0;
    }

    if (this.pixelTempleTitle) {
      this.pixelTempleTitle.textContent = milestone.title;
    }
    if (this.pixelTempleScore) {
      this.pixelTempleScore.textContent = `${this.formatNumber(milestone.score)} - ${milestone.subtitle}`;
    }

    this.pixelTempleOverlay.classList.remove("is-visible");
    void this.pixelTempleOverlay.offsetWidth;
    this.pixelTempleOverlay.classList.add("is-visible");
    this.pixelTempleOverlay.setAttribute("aria-hidden", "false");
    this.playSound("temple");

    const startedAt = performance.now();
    const animate = (now) => {
      const elapsed = now - startedAt;
      this.drawPixelTempleScene(milestone, elapsed);

      if (elapsed < PIXEL_TEMPLE_DRAW_UNTIL && this.pixelTempleOverlay?.classList.contains("is-visible")) {
        this.pixelTempleFrame = window.requestAnimationFrame(animate);
      }
    };

    this.pixelTempleFrame = window.requestAnimationFrame(animate);
    this.pixelTempleTimer = window.setTimeout(() => {
      this.hidePixelTemple();
      onComplete?.();
    }, PIXEL_TEMPLE_HOLD);
  }

  hidePixelTemple() {
    window.cancelAnimationFrame(this.pixelTempleFrame);
    this.pixelTempleFrame = 0;
    if (this.pixelTempleTimer) {
      window.clearTimeout(this.pixelTempleTimer);
      this.pixelTempleTimer = 0;
    }
    this.pixelTempleOverlay?.classList.remove("is-visible");
    this.pixelTempleOverlay?.setAttribute("aria-hidden", "true");
  }

  drawPixelTempleScene(milestone, elapsed = 0, targetCanvas = this.pixelTempleCanvas) {
    const canvas = targetCanvas;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return;
    }

    const width = canvas.width;
    const height = canvas.height;
    const tier = Math.max(0, Math.min(7, Number(milestone.tier) || 0));
    const reveal = Math.min(1, elapsed / 760);
    const pulse = Math.floor(elapsed / 120) % 2;
    const shimmer = Math.floor(elapsed / 80);
    const palettes = [
      ["#09070d", "#251018", "#5a2b2c", "#b76c3d", "#ffd77a", "#54d9b0", "#a934ff"],
      ["#071012", "#102c2a", "#176b58", "#3cc994", "#ffe18a", "#ad51ff", "#ff4f71"],
      ["#10070b", "#35101a", "#7a1729", "#df493e", "#ffd77a", "#7ce8ff", "#ff9ec6"],
      ["#070a16", "#111d3a", "#273f77", "#a87cff", "#fff0b3", "#5ee7ff", "#ff4f71"],
      ["#090816", "#1c1640", "#4f2c7e", "#c778ff", "#ffe6a3", "#6fffe8", "#ff6d9a"],
      ["#080b13", "#1d2b31", "#3c5b5f", "#78d5bd", "#ffd77a", "#7ad7ff", "#ff5b45"],
      ["#090712", "#21133d", "#493880", "#7f8cff", "#fff1b8", "#90f7ff", "#ff4f9a"],
      ["#06050a", "#251331", "#684080", "#e0a0ff", "#fff4c1", "#85fff2", "#ff4f71"]
    ];
    const palette = palettes[tier] ?? palettes[0];
    const px = (x, y, w, h, color) => {
      context.fillStyle = color;
      context.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };
    const mirror = (x, y, w, h, color) => {
      px(x, y, w, h, color);
      px(width - x - w, y, w, h, color);
    };
    const visibleRows = Math.floor(height * reveal);
    const center = width / 2;

    context.imageSmoothingEnabled = false;
    px(0, 0, width, height, palette[0]);

    for (let y = 0; y < height; y += 4) {
      px(0, y, width, 2, y % 8 === 0 ? "#120a12" : "#050408");
    }
    for (let i = 0; i < 42 + tier * 5; i += 1) {
      const x = (i * 23 + shimmer * (i % 3 + 1)) % width;
      const y = (i * 17 + tier * 11) % 58;
      px(x, y, 1 + (i % 2), 1, i % 5 === 0 ? palette[4] : "#6e5a8c");
    }

    const groundHeight = 18 + Math.min(8, tier);
    px(0, height - groundHeight, width, groundHeight, "#0b0708");
    for (let x = 0; x < width; x += 8) {
      px(x, height - groundHeight + ((x / 8) % 2) * 2, 7, 2, "#2a1a1b");
      px(x, height - 12, 7, 2, "#3b2420");
    }

    context.save();
    context.beginPath();
    context.rect(0, height - visibleRows, width, visibleRows);
    context.clip();

    const baseLevels = 3 + Math.min(5, tier);
    for (let level = 0; level < baseLevels; level += 1) {
      const y = 97 - level * 4;
      const levelWidth = Math.min(154, 58 + tier * 7 + level * 16);
      const x = center - levelWidth / 2;
      px(x, y, levelWidth, 3, level % 2 ? palette[5] : palette[4]);
      px(x + 4, y + 3, Math.max(8, levelWidth - 8), 2, level % 2 ? palette[2] : palette[3]);
    }

    const coreWidth = 26 + tier * 5;
    const coreHeight = 24 + tier * 5;
    const coreX = center - coreWidth / 2;
    const coreY = 88 - coreHeight;
    px(coreX, coreY, coreWidth, coreHeight, palette[2]);
    px(coreX + 4, coreY + 3, Math.max(4, coreWidth - 8), 4, palette[3]);
    px(coreX + coreWidth - 6, coreY + 6, 2, Math.max(4, coreHeight - 10), "#12080b");

    const entranceWidth = 12 + tier * 2;
    const entranceHeight = 12 + tier;
    const entranceX = center - entranceWidth / 2;
    const entranceY = 88 - entranceHeight;
    px(entranceX - 3, entranceY - 3, entranceWidth + 6, 4, palette[4]);
    px(entranceX, entranceY, entranceWidth, entranceHeight, palette[0]);
    px(entranceX + 3, entranceY + 4, Math.max(4, entranceWidth - 6), entranceHeight - 4, pulse ? palette[6] : palette[5]);

    const roofRows = 2 + Math.min(4, Math.floor(tier / 2) + 1);
    for (let row = 0; row < roofRows; row += 1) {
      const y = coreY - 5 - row * 7;
      const roofWidth = Math.max(16, coreWidth + 18 - row * 5);
      px(center - roofWidth / 2, y, roofWidth, 4, row % 2 ? palette[3] : palette[4]);
      px(center - (roofWidth - 8) / 2, y + 4, Math.max(8, roofWidth - 8), 3, palette[2]);
    }

    const spireHeight = 10 + tier * 4;
    const spireY = Math.max(6, coreY - 10 - roofRows * 7 - spireHeight);
    px(center - 2, spireY, 4, spireHeight, palette[4]);
    px(center - 5, spireY + spireHeight, 10, 4, palette[3]);
    px(center - 3, Math.max(2, spireY - 7), 6, 7, pulse ? palette[6] : palette[5]);

    const columnSpecs = [
      { offset: -50, min: 0 }, { offset: 50, min: 0 },
      { offset: -36, min: 1 }, { offset: 36, min: 1 },
      { offset: -64, min: 4 }, { offset: 64, min: 4 },
      { offset: -23, min: 6 }, { offset: 23, min: 6 }
    ];
    columnSpecs.forEach((spec) => {
      if (tier < spec.min) {
        return;
      }

      const x = center + spec.offset;
      const innerColumn = Math.abs(spec.offset) < 30;
      const columnHeight = 31 + tier * 3 - (innerColumn ? 6 : 0);
      const columnY = 89 - columnHeight;
      px(x - 3, columnY, 7, columnHeight, palette[2]);
      px(x - 5, columnY - 4, 11, 4, palette[4]);
      px(x - 5, 89, 11, 4, palette[3]);
      for (let y = columnY + 5; y < 86; y += 8) {
        px(x - 2, y, 2, 4, palette[3]);
        px(x + 2, y + 2, 1, 3, "#1a0b0d");
      }
    });

    if (tier >= 3) {
      [-42, 42].forEach((offset) => {
        const hallWidth = 22 + Math.min(12, tier * 2);
        const hallX = center + offset - hallWidth / 2;
        const hallY = 72 - tier * 2;
        px(hallX, hallY, hallWidth, 17 + tier, palette[2]);
        px(hallX - 4, hallY - 5, hallWidth + 8, 5, palette[4]);
        px(hallX + 5, hallY + 6, hallWidth - 10, 10, palette[0]);
      });
    }

    if (tier >= 5) {
      mirror(8, 53, 12, 36, palette[2]);
      mirror(5, 49, 18, 5, palette[4]);
      mirror(3, 89, 24, 4, palette[3]);
      mirror(14, 60, 3, 18, pulse ? palette[6] : palette[5]);
    }

    if (tier >= 7) {
      for (let ring = 0; ring < 5; ring += 1) {
        const ringWidth = 104 + ring * 10;
        px(center - ringWidth / 2, 19 + ring * 5, ringWidth, 1, ring % 2 ? palette[5] : palette[4]);
      }
      px(2, 98, width - 4, 3, palette[4]);
    }

    for (let i = 0; i < 12 + tier * 8; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const x = center + side * (16 + ((i * 7 + shimmer) % (42 + tier * 3)));
      const y = 22 + ((i * 11 + shimmer * 2) % 62);
      const size = 2 + (i % 3 === 0 ? 1 : 0);
      px(x, y, size, size, i % 4 === 0 ? palette[6] : palette[5]);
    }

    mirror(10, 76 - Math.min(14, tier * 2), 10 + Math.min(8, tier), 16 + tier, palette[2]);
    mirror(12, 70 - Math.min(14, tier * 2), 6 + Math.min(6, tier), 6, palette[4]);
    mirror(6, 92, 22 + Math.min(12, tier * 2), 4, palette[3]);

    context.restore();

    if (elapsed < 260) {
      for (let y = 0; y < height; y += 4) {
        px(0, y, width, 1, "rgba(255, 255, 255, 0.16)");
      }
    }
    if (elapsed > PIXEL_TEMPLE_FADE_START) {
      const fadeWindow = Math.max(1, PIXEL_TEMPLE_HOLD - PIXEL_TEMPLE_FADE_START);
      const fade = Math.min(0.72, (elapsed - PIXEL_TEMPLE_FADE_START) / fadeWindow);
      px(0, 0, width, height, `rgba(7, 6, 5, ${fade})`);
    }
  }

  updateHud(combo = this.displayCombo) {
    this.timerText.textContent = this.remaining.toFixed(1);
    this.scoreText.textContent = this.formatNumber(this.score);
    this.comboText.textContent = `${combo}x`;
    if (this.specialText) {
      const hasSpecial = this.hasAvailableSpecial();
      const progress = this.clearedStoneTotal % SPECIAL_STONE_INTERVAL;
      this.specialText.textContent = hasSpecial
        ? "SPECIAL"
        : `${progress}/${SPECIAL_STONE_INTERVAL}`;
      this.specialText.closest(".hud-item")?.classList.toggle("is-ready", hasSpecial || this.pendingSpecialStones > 0);
    }
    this.timerText.closest(".hud-item").classList.toggle("is-low", this.remaining <= 10 && this.state === "playing");
    this.updateResonanceUi();
    this.updateThemePhase();
  }

  renderBoard() {
    this.boardEl.innerHTML = "";
    this.logic.allTiles().forEach((tile) => this.createTileElement(tile, tile.row, false));
    this.syncAllPositions(true);
  }

  createTileElement(tile, startRow = tile.row, animateIn = true) {
    const stone = BIRTHSTONES[tile.type];
    const el = document.createElement("button");
    el.type = "button";
    el.className = animateIn ? "tile is-new" : "tile";
    el.dataset.tileId = String(tile.id);
    el.setAttribute("role", "gridcell");
    el.setAttribute("aria-label", stone.name);
    el.innerHTML = `<span class="tile-core"><span class="tile-label">${stone.short}</span></span>`;
    tile.el = el;
    this.applyStoneStyle(tile);
    this.boardEl.appendChild(el);
    this.placeTile(tile, startRow, true);

    if (animateIn) {
      window.setTimeout(() => el.classList.remove("is-new"), 460);
    }

    return el;
  }

  applyStoneStyle(tile) {
    if (!tile.el) {
      return;
    }

    const stone = BIRTHSTONES[tile.type];
    tile.el.style.setProperty("--stone", stone.color);
    tile.el.style.setProperty("--stone-dark", stone.dark);
    tile.el.style.setProperty("--stone-light", stone.light);
    tile.el.dataset.stone = stone.id;
    tile.el.classList.toggle("is-special", Boolean(tile.special));
    tile.el.dataset.special = tile.special ? "true" : "false";
    tile.el.setAttribute("aria-label", tile.special ? `Special ${stone.name}. Click to clear all ${stone.name}.` : stone.name);
    const label = tile.el.querySelector(".tile-label");
    if (label) {
      label.textContent = tile.special ? "SP" : stone.short;
    }
  }

  placeTile(tile, row = tile.row, instant = false, distance = 1) {
    if (!tile.el) {
      return;
    }

    const rect = this.boardEl.getBoundingClientRect();
    const cell = rect.width / GRID_SIZE;
    const gap = Math.max(4, Math.min(10, cell * 0.11));
    const size = Math.max(22, cell - gap);

    tile.el.style.width = `${size}px`;
    tile.el.style.height = `${size}px`;
    tile.el.style.left = `${tile.col * cell + gap / 2}px`;
    tile.el.style.top = `${row * cell + gap / 2}px`;
    tile.el.style.setProperty("--move-ms", `${instant ? 1 : Math.min(560, MOVE_TIME + distance * 44)}ms`);
  }

  syncAllPositions(instant = false) {
    this.logic.allTiles().forEach((tile) => {
      this.placeTile(tile, tile.row, instant);
    });
  }

  handlePointerDown(event) {
    if (!this.canInteract()) {
      return;
    }

    const tile = this.tileFromEvent(event);
    if (!this.isTileAvailable(tile)) {
      return;
    }

    this.pointerStart = {
      tile,
      x: event.clientX,
      y: event.clientY,
      id: event.pointerId
    };
    tile.el.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  handlePointerMove(event) {
    if (!this.canInteract() || !this.pointerStart || this.pointerStart.id !== event.pointerId) {
      return;
    }

    const swipe = this.swipeFromPointer(this.pointerStart, event);
    if (!swipe) {
      return;
    }

    const start = this.pointerStart;
    this.pointerStart = null;

    if (!this.isTileAvailable(start.tile)) {
      return;
    }

    const target = this.logic.neighbor(start.tile, swipe.direction);
    if (target) {
      this.trySwap(start.tile, target);
    } else {
      this.invalidFeedback([start.tile]);
    }

    event.preventDefault();
  }

  handlePointerUp(event) {
    if (!this.canInteract() || !this.pointerStart) {
      this.pointerStart = null;
      return;
    }

    const start = this.pointerStart;
    this.pointerStart = null;

    if (!this.isTileAvailable(start.tile)) {
      return;
    }

    const swipe = this.swipeFromPointer(start, event);

    if (swipe) {
      const target = this.logic.neighbor(start.tile, swipe.direction);

      if (target) {
        this.trySwap(start.tile, target);
      } else {
        this.invalidFeedback([start.tile]);
      }
      event.preventDefault();
      return;
    }

    const tile = this.tileFromEvent(event) ?? start.tile;
    this.handleTileTap(tile);
    event.preventDefault();
  }

  swipeFromPointer(start, event) {
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const distance = Math.hypot(dx, dy);
    const threshold = this.swipeThreshold();

    if (distance <= threshold) {
      return null;
    }

    const direction = Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? "right" : "left")
      : (dy > 0 ? "down" : "up");

    return { direction, distance };
  }

  swipeThreshold() {
    const boardWidth = this.boardEl.getBoundingClientRect().width || 360;
    return Math.max(14, Math.min(28, boardWidth / 22));
  }

  handleTileTap(tile) {
    if (!this.isTileAvailable(tile)) {
      return;
    }

    if (tile.special) {
      this.activateSpecialStone(tile);
      return;
    }

    if (!this.selectedTile) {
      this.selectTile(tile);
      return;
    }

    if (this.selectedTile === tile) {
      this.clearSelection();
      return;
    }

    if (this.logic.areAdjacent(this.selectedTile, tile)) {
      this.trySwap(this.selectedTile, tile);
      return;
    }

    this.selectTile(tile);
  }

  handleKeyDown(event) {
    if (!this.canInteract()) {
      return;
    }

    const tile = this.tileFromEvent(event);
    if (!tile) {
      return;
    }

    const keyToDirection = {
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "up",
      ArrowDown: "down"
    };
    const direction = keyToDirection[event.key];

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      this.handleTileTap(tile);
      return;
    }

    if (direction) {
      event.preventDefault();
      const target = this.logic.neighbor(tile, direction);
      if (target) {
        this.trySwap(tile, target);
      }
    }
  }

  tileFromEvent(event) {
    const tileEl = event.target.closest?.(".tile");
    if (!tileEl) {
      return null;
    }

    const id = Number(tileEl.dataset.tileId);
    return this.logic.allTiles().find((tile) => tile.id === id) ?? null;
  }

  selectTile(tile) {
    if (!this.isTileAvailable(tile)) {
      return;
    }

    this.clearSelection();
    this.selectedTile = tile;
    tile.el?.classList.add("is-selected");
    this.playSound("select");
  }

  clearSelection() {
    if (this.selectedTile?.el) {
      this.selectedTile.el.classList.remove("is-selected");
    }
    this.selectedTile = null;
  }

  canInteract() {
    return this.state === "playing";
  }

  isTileAvailable(tile) {
    return Boolean(
      this.canInteract() &&
      tile &&
      tile.el &&
      this.logic.tileAt(tile.row, tile.col) === tile &&
      !this.boardLocked &&
      !this.swappingTiles.has(tile) &&
      !this.clearingTiles.has(tile) &&
      !this.fallingTiles.has(tile)
    );
  }

  async trySwap(tileA, tileB) {
    if ((tileA?.special || tileB?.special) && this.canInteract() && !this.swapInProgress) {
      this.activateSpecialStone(tileA?.special ? tileA : tileB);
      return;
    }

    if (
      !this.canInteract() ||
      this.swapInProgress ||
      !this.logic.areAdjacent(tileA, tileB) ||
      !this.isTileAvailable(tileA) ||
      !this.isTileAvailable(tileB)
    ) {
      return;
    }

    this.swapInProgress = true;
    this.swappingTiles.add(tileA);
    this.swappingTiles.add(tileB);
    this.clearHint();
    this.clearSelection();
    this.logic.swapTiles(tileA, tileB);
    this.playSound("swap");
    await this.animateTiles([tileA, tileB], MOVE_TIME);

    if (!this.canInteract()) {
      this.swapInProgress = false;
      this.swappingTiles.delete(tileA);
      this.swappingTiles.delete(tileB);
      return;
    }

    const localMatches = this.logic.findMatchesTouching([tileA, tileB]);

    if (!localMatches.tiles.length) {
      this.logic.swapTiles(tileA, tileB);
      await this.animateTiles([tileA, tileB], MOVE_TIME);
      this.invalidFeedback([tileA, tileB]);
      await sleep(INVALID_TIME);
      this.swapInProgress = false;
      this.swappingTiles.delete(tileA);
      this.swappingTiles.delete(tileB);
      this.resetHintTimer();

      if (this.canInteract() && this.logic.findMatches().tiles.length) {
        this.requestResolution();
      }

      if (this.remaining <= 0) {
        this.endGame();
      }
      return;
    }

    this.swapInProgress = false;
    this.swappingTiles.delete(tileA);
    this.swappingTiles.delete(tileB);
    this.requestResolution();
  }

  requestResolution() {
    this.pendingResolution = true;

    if (!this.processingMatches) {
      this.resolveMatches();
    }
  }

  async resolveMatches() {
    if (this.processingMatches) {
      this.pendingResolution = true;
      return;
    }

    this.processingMatches = true;
    this.pendingResolution = false;
    let chain = Math.max(1, this.displayCombo);

    while (this.canInteract()) {
      let currentMatches = this.logic.findMatches();
      currentMatches = this.filterClearableMatches(currentMatches);

      if (!currentMatches.tiles.length) {
        if (this.pendingResolution) {
          this.pendingResolution = false;
          continue;
        }
        break;
      }

      this.displayCombo = chain;
      this.updateHud(chain);
      await this.animateMatches(currentMatches, chain);

      if (!this.canInteract()) {
        break;
      }

      const scoreResult = this.calculateScore(currentMatches, chain);
      this.addScore(scoreResult.points);
      this.recordMatchStats(currentMatches, chain, scoreResult);
      this.registerStoneClears(currentMatches.tiles.length);
      this.addResonance(currentMatches, chain);
      this.resetHintTimer();
      this.updateHud(this.displayCombo);
      this.showScorePop(scoreResult, currentMatches.tiles);
      this.flashMatchedStones(currentMatches.tiles);

      this.logic.clearTiles(currentMatches.tiles);
      currentMatches.tiles.forEach((tile) => {
        this.clearingTiles.delete(tile);
        tile.el?.remove();
        tile.el = null;
      });

      const collapseResult = this.logic.collapse();
      await this.animateCollapse(collapseResult);
      chain += 1;
    }

    if (this.canInteract()) {
      this.promotePendingSpecials();
    }

    this.processingMatches = false;
    this.pendingResolution = false;
    this.displayCombo = 1;
    this.updateHud(1);

    if (this.canInteract() && !this.hasAvailableSpecial() && !this.logic.hasPossibleMove()) {
      await this.reshuffleBoard();
    }

    if (this.canInteract()) {
      this.resetHintTimer();
    }
  }

  registerStoneClears(count) {
    this.clearedStoneTotal += count;

    while (this.clearedStoneTotal >= this.nextSpecialAt) {
      this.pendingSpecialStones += 1;
      this.nextSpecialAt += SPECIAL_STONE_INTERVAL;
    }
  }

  hasAvailableSpecial() {
    return this.logic.allTiles().some((tile) => (
      tile.special &&
      tile.el &&
      this.logic.tileAt(tile.row, tile.col) === tile &&
      !this.clearingTiles.has(tile) &&
      !this.fallingTiles.has(tile)
    ));
  }

  promotePendingSpecials() {
    let promoted = 0;

    while (this.pendingSpecialStones > 0) {
      const candidates = this.logic.allTiles().filter((tile) => (
        !tile.special &&
        tile.el &&
        this.logic.tileAt(tile.row, tile.col) === tile &&
        !this.clearingTiles.has(tile) &&
        !this.fallingTiles.has(tile)
      ));

      if (!candidates.length) {
        break;
      }

      const tile = randomChoice(candidates);
      tile.special = true;
      this.applyStoneStyle(tile);
      tile.el?.classList.remove("is-special-born");
      void tile.el?.offsetWidth;
      tile.el?.classList.add("is-special-born");
      window.setTimeout(() => tile.el?.classList.remove("is-special-born"), 760);
      this.pendingSpecialStones -= 1;
      promoted += 1;
    }

    if (promoted > 0) {
      this.showComboRibbon(promoted > 1 ? `SPECIAL x${promoted}` : "SPECIAL STONE");
      this.playSound("special");
      this.updateHud(this.displayCombo);
    }
  }

  async activateSpecialStone(tile) {
    if (!this.isTileAvailable(tile) || !tile.special || this.processingMatches || this.swapInProgress) {
      return;
    }

    const type = tile.type;
    const targets = this.logic.allTiles().filter((candidate) => (
      candidate.type === type &&
      this.isTileAvailable(candidate)
    ));

    if (!targets.length) {
      return;
    }

    this.boardLocked = true;
    this.runStats.specialUses += 1;
    this.clearHint();
    this.clearSelection();
    this.showComboRibbon("STONE CALL");
    this.playSound("special");
    this.emitSpecialSweep(targets, type);

    try {
      const chain = Math.max(2, this.displayCombo, this.matchStreak || 1);
      const specialMatches = {
        groups: [{ direction: "special", tiles: targets }],
        tiles: targets
      };

      await this.animateMatches(specialMatches, chain);

      if (!this.canInteract()) {
        return;
      }

      const scoreResult = this.calculateScore(specialMatches, chain);
      this.addScore(scoreResult.points);
      this.recordMatchStats(specialMatches, chain, scoreResult);
      this.registerStoneClears(specialMatches.tiles.length);
      this.addResonance(specialMatches, chain);
      this.showScorePop(scoreResult, specialMatches.tiles);
      this.flashMatchedStones(specialMatches.tiles);
      this.logic.clearTiles(specialMatches.tiles);
      specialMatches.tiles.forEach((matchedTile) => {
        this.clearingTiles.delete(matchedTile);
        matchedTile.el?.remove();
        matchedTile.el = null;
      });

      const collapseResult = this.logic.collapse();
      await this.animateCollapse(collapseResult);
    } finally {
      this.boardLocked = false;
    }

    if (!this.canInteract()) {
      return;
    }

    this.promotePendingSpecials();
    this.updateHud(this.displayCombo);
    this.requestResolution();
    this.resetHintTimer();
  }

  filterClearableMatches(matches) {
    const groups = matches.groups
      .filter((group) => group.tiles.every((tile) => this.isTileAvailable(tile)))
      .map((group) => ({
        direction: group.direction,
        tiles: group.tiles
      }));
    const tiles = new Set();

    groups.forEach((group) => {
      group.tiles.forEach((tile) => tiles.add(tile));
    });

    return { groups, tiles: [...tiles] };
  }

  async animateTiles(tiles, duration = MOVE_TIME) {
    tiles.forEach((tile) => {
      this.placeTile(tile, tile.row, false, 1);
      tile.el?.style.setProperty("--move-ms", `${duration}ms`);
    });
    await sleep(duration + 30);
  }

  async animateMatches(matches, chain) {
    const effectLevel = this.updateMatchStreak(chain);
    this.syncMusicToCombo(effectLevel);
    this.playSound(effectLevel > 1 ? "combo" : "match");
    this.playMatchResonance(matches, effectLevel);
    this.pulseBoard();

    if (chain > 1) {
      this.showComboRibbon(chain);
    } else if (effectLevel > 1) {
      this.showComboRibbon(`ECHO ${effectLevel}x`);
    }

    if (effectLevel > 1 || this.resonanceActive) {
      this.emitComboParticles(matches, effectLevel);
    }

    if (this.resonanceActive) {
      this.emitResonanceMatchBurst(matches, effectLevel);
    }

    matches.tiles.forEach((tile, index) => {
      if (!tile.el) {
        return;
      }

      this.clearingTiles.add(tile);
      tile.el.style.setProperty("--match-delay", `${Math.min(index * 18, 120)}ms`);
      tile.el.classList.add("is-matched");
      this.emitMatchBurst(tile, effectLevel);
    });

    await sleep(CLEAR_TIME + Math.min(matches.tiles.length * 10, 120));
  }

  async animateCollapse({ moved, spawned }) {
    spawned.forEach(({ tile }) => {
      this.createTileElement(tile, tile.spawnRow, true);
    });

    await new Promise((resolve) => window.requestAnimationFrame(resolve));

    const distances = [...moved, ...spawned].map((item) => item.distance);
    const maxDistance = Math.max(1, ...distances);
    const fallTime = Math.min(620, MOVE_TIME + maxDistance * 58);

    moved.forEach(({ tile, distance }) => {
      this.fallingTiles.add(tile);
      tile.el?.classList.add("is-falling");
      this.placeTile(tile, tile.row, false, distance);
    });
    spawned.forEach(({ tile, distance }) => {
      this.fallingTiles.add(tile);
      tile.el?.classList.add("is-falling");
      this.placeTile(tile, tile.row, false, distance);
    });

    await sleep(fallTime + 70);

    [...moved, ...spawned].forEach(({ tile }) => {
      this.fallingTiles.delete(tile);
      tile.el?.classList.remove("is-falling");
    });

    if (moved.length + spawned.length > 0) {
      this.playSound("drop");
    }
  }

  async reshuffleBoard() {
    this.boardLocked = true;
    this.clearHint();
    this.showComboRibbon("RESHUFFLE");
    this.boardShell.classList.add("is-shaking");
    await sleep(260);
    const preservedTiles = this.logic.rerollUntilPlayable();
    if (preservedTiles) {
      this.renderBoardAfterReroll();
    } else {
      this.renderBoard();
    }
    this.playSound("shuffle");
    await sleep(RESHUFFLE_TIME);
    this.boardLocked = false;
  }

  renderBoardAfterReroll() {
    this.logic.allTiles().forEach((tile) => {
      if (!tile.el) {
        this.createTileElement(tile, tile.row, true);
        return;
      }

      this.applyStoneStyle(tile);
      tile.el.classList.remove("is-revealed");
      void tile.el.offsetWidth;
      tile.el.classList.add("is-revealed");
    });
    this.syncAllPositions(false);
  }

  invalidFeedback(tiles) {
    this.resetMatchStreak();
    this.playSound("invalid");
    this.boardShell.classList.remove("is-shaking");
    void this.boardShell.offsetWidth;
    this.boardShell.classList.add("is-shaking");
    window.setTimeout(() => this.boardShell.classList.remove("is-shaking"), 380);

    tiles.forEach((tile) => {
      if (!tile.el) {
        return;
      }

      tile.el.classList.remove("is-invalid");
      void tile.el.offsetWidth;
      tile.el.classList.add("is-invalid");
      window.setTimeout(() => tile.el?.classList.remove("is-invalid"), INVALID_TIME);
    });
  }

  pulseBoard() {
    this.boardShell.classList.remove("is-pulsing");
    void this.boardShell.offsetWidth;
    this.boardShell.classList.add("is-pulsing");
    window.setTimeout(() => this.boardShell.classList.remove("is-pulsing"), 430);
  }

  showComboRibbon(value) {
    const label = typeof value === "number" ? `CHAIN ${value}x` : value;
    this.comboRibbon.textContent = label;
    this.comboRibbon.classList.remove("is-visible");
    void this.comboRibbon.offsetWidth;
    this.comboRibbon.classList.add("is-visible");
  }

  updateMatchStreak(chain) {
    const now = performance.now();
    const isContinuous = now - this.lastMatchAt <= MATCH_STREAK_WINDOW;

    this.matchStreak = isContinuous ? Math.min(8, this.matchStreak + 1) : 1;
    this.matchStreak = Math.max(this.matchStreak, chain);
    this.lastMatchAt = now;
    this.boardShell.classList.add("is-echoing");
    window.setTimeout(() => this.boardShell.classList.remove("is-echoing"), 720);

    return Math.min(8, this.matchStreak);
  }

  resetMatchStreak() {
    this.matchStreak = 0;
    this.lastMatchAt = 0;
    this.boardShell?.classList.remove("is-echoing");
  }

  calculateScore(matches, chain) {
    const clearedCount = matches.tiles.length;
    const groupCount = matches.groups.length;
    const chainMultiplier = 1 + Math.pow(Math.max(0, chain - 1), 1.15) * 0.64;
    const clearMultiplier = 1 + Math.max(0, clearedCount - 3) * 0.12;
    const groupMultiplier = 1 + Math.max(0, groupCount - 1) * 0.24;
    const echoMultiplier = 1 + Math.max(0, Math.min(6, this.matchStreak) - chain) * 0.06;
    const resonanceMultiplier = this.resonanceActive ? RESONANCE_SCORE_MULTIPLIER : 1;
    const multiplier = chainMultiplier * clearMultiplier * groupMultiplier * echoMultiplier * resonanceMultiplier;
    const points = Math.round(clearedCount * BASE_TILE_SCORE * multiplier);

    return {
      chain,
      clearedCount,
      groupCount,
      echoMultiplier,
      multiplier,
      resonanceMultiplier,
      points
    };
  }

  showScorePop(scoreResult, tiles) {
    if (!tiles.length) {
      return;
    }

    const boardRect = this.boardEl.getBoundingClientRect();
    const centers = tiles.map((tile) => {
      const rect = tile.el?.getBoundingClientRect();
      if (!rect) {
        return null;
      }
      return {
        x: rect.left - boardRect.left + rect.width / 2,
        y: rect.top - boardRect.top + rect.height / 2
      };
    }).filter(Boolean);

    if (!centers.length) {
      return;
    }

    const center = centers.reduce((acc, point) => ({
      x: acc.x + point.x / centers.length,
      y: acc.y + point.y / centers.length
    }), { x: 0, y: 0 });

    const pop = document.createElement("div");
    const value = document.createElement("span");
    const bonus = document.createElement("small");

    pop.className = "score-pop";
    value.className = "score-pop-value";
    value.textContent = `+${this.formatNumber(scoreResult.points)}`;
    bonus.className = "score-pop-bonus";
    bonus.textContent = `CHAIN ${scoreResult.chain} / ${scoreResult.clearedCount} GEMS / x${scoreResult.multiplier.toFixed(2)}${scoreResult.echoMultiplier > 1 ? " / ECHO" : ""}${scoreResult.resonanceMultiplier > 1 ? " / RES" : ""}`;
    pop.append(value, bonus);
    pop.style.left = `${center.x}px`;
    pop.style.top = `${center.y}px`;
    this.boardEl.appendChild(pop);
    window.setTimeout(() => pop.remove(), 820);
  }

  emitMatchBurst(tile, chain) {
    if (!tile.el) {
      return;
    }

    const rect = tile.el.getBoundingClientRect();
    const boardRect = this.boardEl.getBoundingClientRect();
    const x = rect.left - boardRect.left + rect.width / 2;
    const y = rect.top - boardRect.top + rect.height / 2;
    const chainLevel = Math.min(5, Math.max(1, chain));
    const chainBurstScale = chainLevel > 1 ? 4 : 1;
    const count = Math.min(38, 10 + chainLevel * 6);
    const stone = BIRTHSTONES[tile.type];
    const column = document.createElement("span");
    const ringCount = Math.min(3, chainLevel);

    for (let ringIndex = 0; ringIndex < ringCount; ringIndex += 1) {
      const ring = document.createElement("span");
      ring.className = ringIndex === 0 ? "burst-ring" : "burst-ring is-echo";
      ring.style.left = `${x}px`;
      ring.style.top = `${y}px`;
      ring.style.setProperty("--burst-color", ringIndex === 0 ? stone.light : "#ffd77a");
      ring.style.setProperty("--burst-scale", String(Math.min(2.8, 1.35 + chainLevel * 0.22 + ringIndex * 0.28) * chainBurstScale));
      ring.style.setProperty("--burst-delay", `${ringIndex * 70}ms`);
      this.boardEl.appendChild(ring);
      window.setTimeout(() => ring.remove(), 900 + ringIndex * 90);
    }

    if (chainLevel > 1) {
      const sigil = document.createElement("span");
      sigil.className = "burst-sigil";
      sigil.style.left = `${x}px`;
      sigil.style.top = `${y}px`;
      sigil.style.setProperty("--burst-color", stone.light);
      sigil.style.setProperty("--burst-scale", String(Math.min(2.1, 1.1 + chainLevel * 0.18) * chainBurstScale));
      this.boardEl.appendChild(sigil);
      window.setTimeout(() => sigil.remove(), 980);
    }

    column.className = "burst-column";
    column.style.left = `${x}px`;
    column.style.top = `${y}px`;
    column.style.setProperty("--burst-color", stone.light);
    column.style.setProperty("--column-scale", String(Math.min(1.75, 1 + chainLevel * 0.14) * chainBurstScale));
    this.boardEl.appendChild(column);
    window.setTimeout(() => column.remove(), 820);

    for (let index = 0; index < count; index += 1) {
      const spark = document.createElement("span");
      const angle = (Math.PI * 2 * index) / count + Math.random() * 0.35;
      const distance = (32 + Math.random() * (34 + chainLevel * 14)) * chainBurstScale;
      const isShard = index % (chainLevel > 2 ? 2 : 3) === 1;
      spark.className = isShard ? "burst-shard" : "spark";
      spark.style.left = `${x}px`;
      spark.style.top = `${y}px`;
      spark.style.setProperty("--spark-color", index % 4 === 0 ? "#ffd77a" : stone.light);
      spark.style.setProperty("--spark-x", `${Math.cos(angle) * distance}px`);
      spark.style.setProperty("--spark-y", `${Math.sin(angle) * distance}px`);
      spark.style.setProperty("--spark-rotate", `${Math.round(Math.random() * 220 - 110)}deg`);
      spark.style.setProperty("--spark-scale", String((1 + chainLevel * 0.08) * chainBurstScale));
      this.boardEl.appendChild(spark);
      window.setTimeout(() => spark.remove(), isShard ? 860 : 720);
    }
  }

  emitComboParticles(matches, chain) {
    if (!this.resonanceLayer) {
      return;
    }

    const chainLevel = Math.min(6, Math.max(1, chain));
    const amount = Math.min(72, 10 + chainLevel * 8 + (this.resonanceActive ? 16 : 0));
    const colors = [...new Set(matches.tiles.map((tile) => BIRTHSTONES[tile.type].light))];

    for (let index = 0; index < amount; index += 1) {
      const particle = document.createElement("span");
      const color = colors[index % colors.length] ?? "#ffd77a";
      const startX = 8 + Math.random() * 84;
      const startY = 72 + Math.random() * 26;
      const driftX = (Math.random() - 0.5) * (120 + chainLevel * 22);
      const driftY = -(80 + Math.random() * (140 + chainLevel * 26));
      const size = 3 + Math.random() * (this.resonanceActive ? 6 : 4);

      particle.className = "resonance-particle";
      particle.style.left = `${startX}%`;
      particle.style.top = `${startY}%`;
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.setProperty("--particle-color", color);
      particle.style.setProperty("--particle-x", `${driftX}px`);
      particle.style.setProperty("--particle-y", `${driftY}px`);
      particle.style.setProperty("--particle-glow", String(Math.min(1.8, 0.8 + chainLevel * 0.16)));
      this.resonanceLayer.appendChild(particle);
      window.setTimeout(() => particle.remove(), 1200);
    }
  }

  emitResonanceMatchBurst(matches, chain) {
    if (!this.boardEl || !matches.groups.length) {
      return;
    }

    const boardRect = this.boardEl.getBoundingClientRect();
    const chainLevel = Math.min(6, Math.max(1, chain));
    const groups = matches.groups.slice(0, 5);

    groups.forEach((group, groupIndex) => {
      const centers = group.tiles.map((tile) => {
        const rect = tile.el?.getBoundingClientRect();
        if (!rect) {
          return null;
        }

        return {
          x: rect.left - boardRect.left + rect.width / 2,
          y: rect.top - boardRect.top + rect.height / 2
        };
      }).filter(Boolean);

      if (!centers.length) {
        return;
      }

      const center = centers.reduce((acc, point) => ({
        x: acc.x + point.x / centers.length,
        y: acc.y + point.y / centers.length
      }), { x: 0, y: 0 });
      const color = BIRTHSTONES[group.tiles[0]?.type ?? 0].light;
      const orbit = document.createElement("span");

      orbit.className = "resonance-orbit";
      orbit.style.left = `${center.x}px`;
      orbit.style.top = `${center.y}px`;
      orbit.style.setProperty("--res-color", color);
      orbit.style.setProperty("--res-scale", String(1.05 + chainLevel * 0.16));
      orbit.style.setProperty("--res-delay", `${groupIndex * 42}ms`);
      this.boardEl.appendChild(orbit);
      window.setTimeout(() => orbit.remove(), 1050);

      for (let index = 0; index < 3; index += 1) {
        const lance = document.createElement("span");
        lance.className = "resonance-lance";
        lance.style.left = `${center.x}px`;
        lance.style.top = `${center.y}px`;
        lance.style.setProperty("--res-color", index === 1 ? "#ffd77a" : color);
        lance.style.setProperty("--res-angle", `${index * 60 + groupIndex * 18}deg`);
        lance.style.setProperty("--res-scale", String(1 + chainLevel * 0.12));
        lance.style.setProperty("--res-delay", `${groupIndex * 38 + index * 34}ms`);
        this.boardEl.appendChild(lance);
        window.setTimeout(() => lance.remove(), 980);
      }
    });
  }

  emitSpecialSweep(tiles, type) {
    if (!this.boardEl || !tiles.length) {
      return;
    }

    const stone = BIRTHSTONES[type];
    const sweep = document.createElement("span");
    sweep.className = "special-sweep";
    sweep.style.setProperty("--special-color", stone.light);
    this.boardEl.appendChild(sweep);
    window.setTimeout(() => sweep.remove(), 980);

    tiles.slice(0, 24).forEach((tile, index) => {
      const rect = tile.el?.getBoundingClientRect();
      const boardRect = this.boardEl.getBoundingClientRect();

      if (!rect) {
        return;
      }

      const mark = document.createElement("span");
      mark.className = "special-mark";
      mark.style.left = `${rect.left - boardRect.left + rect.width / 2}px`;
      mark.style.top = `${rect.top - boardRect.top + rect.height / 2}px`;
      mark.style.setProperty("--special-color", stone.light);
      mark.style.setProperty("--special-delay", `${Math.min(index * 22, 180)}ms`);
      this.boardEl.appendChild(mark);
      window.setTimeout(() => mark.remove(), 900);
    });
  }

  addResonance(matches, chain) {
    if (this.resonanceActive) {
      this.updateResonanceUi();
      return;
    }

    const gain = 3.8
      + matches.tiles.length * 1.35
      + matches.groups.length * 0.7
      + Math.max(0, matches.tiles.length - 3) * 1.1
      + Math.max(0, chain - 1) * 5.6;
    this.resonance = Math.min(RESONANCE_MAX, this.resonance + gain);
    this.updateResonanceUi();
  }

  resetResonance() {
    if (this.resonanceTimer) {
      window.clearTimeout(this.resonanceTimer);
      this.resonanceTimer = 0;
    }

    this.resonance = 0;
    this.resonanceActive = false;
    this.appShell?.classList.remove("is-resonance-active");
    this.updateResonanceUi();
  }

  activateResonance() {
    if (!this.canInteract() || this.resonance < RESONANCE_MAX || this.resonanceActive) {
      return;
    }

    this.resonance = 0;
    this.resonanceActive = true;
    this.runStats.resonanceUses += 1;
    this.syncMusicToCombo(COMBO_MUSIC_MAX_LEVEL);
    this.appShell?.classList.add("is-resonance-active");
    this.showComboRibbon("RESONANCE");
    this.emitResonanceWave();
    this.playSound("resonance");
    this.updateHud(this.displayCombo);
    this.resonanceTimer = window.setTimeout(() => this.endResonance(true), RESONANCE_DURATION);
  }

  endResonance(showRibbon = true) {
    if (this.resonanceTimer) {
      window.clearTimeout(this.resonanceTimer);
      this.resonanceTimer = 0;
    }

    if (!this.resonanceActive) {
      this.appShell?.classList.remove("is-resonance-active");
      this.updateResonanceUi();
      return;
    }

    this.resonanceActive = false;
    this.appShell?.classList.remove("is-resonance-active");
    this.updateResonanceUi();

    if (showRibbon && this.canInteract()) {
      this.showComboRibbon("ECHO REMAINS");
    }
  }

  updateResonanceUi() {
    if (!this.resonanceText || !this.resonanceFill || !this.resonanceButton) {
      return;
    }

    const percent = Math.round(this.resonance);
    const levelNumber = this.templeState().levelIndex + 1;
    this.resonanceText.textContent = this.resonanceActive ? "ECHO" : `LV ${levelNumber}`;
    this.resonanceFill.style.width = `${this.resonanceActive ? 100 : percent}%`;
    const isReady = this.canInteract() && this.resonance >= RESONANCE_MAX && !this.resonanceActive;
    this.resonanceButton.disabled = !isReady;
    this.resonanceButton.textContent = this.resonanceActive ? "Resonating" : "Resonate";
    this.resonanceButton.classList.toggle("is-ready", isReady);
    this.resonanceHud?.classList.toggle("is-ready", isReady || this.resonanceActive);
  }

  updateThemePhase() {
    if (!this.appShell) {
      return;
    }

    let phase = "calm";
    if (this.state === "playing") {
      if (this.remaining <= 20) {
        phase = "peak";
      } else if (this.remaining <= 40) {
        phase = "lit";
      }
    } else if (this.state === "over" || this.state === "timeup") {
      phase = "peak";
    }

    const intensity = this.state === "playing" || this.state === "over" || this.state === "timeup"
      ? Math.max(0, Math.min(1, 1 - this.remaining / GAME_SECONDS))
      : 0;
    this.appShell.style.setProperty("--ritual-intensity", intensity.toFixed(3));
    this.appShell.style.setProperty("--ritual-opacity", (0.03 + intensity * 0.18).toFixed(3));
    this.updateBackdropStage(phase);

    if (phase === this.themePhase) {
      return;
    }

    this.themePhase = phase;
    this.appShell.classList.toggle("theme-calm", phase === "calm");
    this.appShell.classList.toggle("theme-lit", phase === "lit");
    this.appShell.classList.toggle("theme-peak", phase === "peak");
  }

  updateBackdropStage(phase) {
    if (!this.backdropEl || !this.appShell) {
      return;
    }

    const stage = this.stageForPhase(phase);

    if (stage.id === this.stageId) {
      return;
    }

    BACKDROP_STAGES.forEach((item) => {
      this.appShell.classList.toggle(`stage-${item.id}`, item.id === stage.id);
    });
    this.backdropEl.style.setProperty("--scene-art", `url("${stage.art}")`);
    this.stageId = stage.id;
  }

  emitResonanceWave() {
    if (!this.resonanceLayer) {
      return;
    }

    const wave = document.createElement("span");
    wave.className = "resonance-wave";
    this.resonanceLayer.appendChild(wave);
    window.setTimeout(() => wave.remove(), 1400);
  }

  flashMatchedStones(tiles) {
    const types = new Set(tiles.map((tile) => String(tile.type)));
    const chips = [...this.stoneList.querySelectorAll(".stone-chip")];

    chips.forEach((chip) => {
      chip.classList.toggle("is-hot", types.has(chip.dataset.type));
    });

    window.setTimeout(() => {
      chips.forEach((chip) => chip.classList.remove("is-hot"));
    }, 620);
  }

  resetHintTimer() {
    this.clearHintTimer();
    this.clearHint();

    if (!this.canInteract()) {
      return;
    }

    this.hintTimer = window.setTimeout(() => this.showHint(), HINT_DELAY);
  }

  clearHintTimer() {
    if (this.hintTimer) {
      window.clearTimeout(this.hintTimer);
      this.hintTimer = 0;
    }
  }

  showHint() {
    this.hintTimer = 0;

    if (!this.canInteract() || this.processingMatches || this.swapInProgress) {
      this.resetHintTimer();
      return;
    }

    if (this.logic.findMatches().tiles.length) {
      this.requestResolution();
      this.resetHintTimer();
      return;
    }

    const move = this.logic.findPossibleMove();
    if (!move || !this.isTileAvailable(move.from) || !this.isTileAvailable(move.to)) {
      this.resetHintTimer();
      return;
    }

    this.hintTiles = new Set([move.from, move.to]);
    this.hintTiles.forEach((tile) => {
      tile.el?.classList.add("is-hint");
    });
  }

  clearHint() {
    this.hintTiles.forEach((tile) => {
      tile.el?.classList.remove("is-hint");
    });
    this.hintTiles.clear();
  }

  unlockAudio() {
    this.ensureAudio();

    if (this.soundEnabled && this.state === "start") {
      this.startMusic("title");
    }
  }

  playMatchResonance(matches, chain) {
    if (!this.soundEnabled) {
      return;
    }

    this.ensureAudio();

    if (!this.audioContext || this.audioContext.state === "suspended") {
      return;
    }

    const start = this.audioContext.currentTime + 0.025;
    const types = [...new Set(matches.tiles.map((tile) => tile.type))].slice(0, 4);
    const chainLift = Math.min(7, Math.max(0, chain - 1));
    const bus = this.createSfxBus(start, this.resonanceActive ? 1.1 : 0.72, this.resonanceActive ? 0.82 : 0.64, {
      lowpass: this.resonanceActive ? 6400 : 5200,
      highpass: 58
    });

    types.forEach((type, index) => {
      const frequency = (STONE_PITCHES[type] ?? 220) * 0.74 * 2 ** ((Math.min(4, chainLift) + index) / 12);
      this.playGemPing(bus, start + index * 0.038, 0.46, {
        frequency,
        shimmer: 1 + type * 0.02,
        accent: index === 0
      });
    });

    if (chain > 1 || this.resonanceActive) {
      this.playComboBloom(bus, start + 0.05, this.resonanceActive ? 0.68 : 0.48, Math.min(6, chain + 1), {
        root: 110 * 2 ** (Math.min(6, chainLift) / 12),
        compact: true
      });
    }

    if (this.resonanceActive) {
      const lift = Math.min(12, chainLift + 5);
      this.playBellTone(196 * 2 ** (lift / 12), 0.42, 0.014, bus, start + 0.16, {
        color: {
          secondRatio: 1.52,
          thirdRatio: 2.38,
          secondVolume: 0.28,
          thirdVolume: 0.12,
          releaseScale: 0.48,
          detuneSpread: 4
        }
      });
    }
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    this.soundButton.setAttribute("aria-pressed", String(this.soundEnabled));

    if (this.soundEnabled) {
      this.startMusic(this.musicModeForState());
      this.playSound("select");
    } else {
      this.stopMusic();
    }
  }

  musicModeForState() {
    if (this.state === "over") {
      return "over";
    }

    if (this.state === "playing") {
      return "game";
    }

    return "title";
  }

  musicVolumeForMode(mode) {
    const volumeByMode = {
      title: 0.28,
      game: 0.24,
      over: 0.26
    };

    return Math.max(0.0001, (volumeByMode[mode] ?? 0.24) * this.bgmVolume);
  }

  createMusicProfile() {
    const bellPatterns = [
      [12, 15, 17, 22, 24, 22, 17, 15],
      [12, 14, 17, 19, 24, 22, 19, 17],
      [7, 12, 15, 19, 22, 19, 15, 12],
      [10, 12, 17, 22, 27, 22, 17, 12]
    ];
    const counterPatterns = [
      [0, 3, 7, 10],
      [0, 5, 7, 12],
      [3, 7, 10, 15],
      [-2, 3, 7, 12]
    ];
    const upperPatterns = [
      [24, 27, 31, 34],
      [22, 26, 29, 34],
      [24, 28, 31, 36],
      [19, 24, 31, 38]
    ];
    const rootMotions = [
      [0, 0, 3, -2],
      [0, 5, 3, -2],
      [0, -2, 3, 7],
      [0, 3, 7, 5]
    ];
    const droneRatios = randomChoice([
      [0.25, 1 / 3],
      [0.2, 0.25],
      [1 / 3, 0.5],
      [0.25, 0.375]
    ]);
    const pipeTypes = ["sine", "triangle"];

    return {
      baseRoot: randomChoice([110, 116.54, 123.47, 130.81, 146.83]),
      rootMotion: randomChoice(rootMotions),
      longMotion: randomChoice([
        [0, -2, 3, 5],
        [0, 3, -2, 7],
        [0, 5, 3, -2],
        [0, -5, 2, 3]
      ]),
      chordColor: randomChoice([
        [0, 3, 7, 10],
        [0, 5, 7, 12],
        [0, 3, 8, 10],
        [0, 2, 7, 10]
      ]),
      tempoOffset: randomBetween(-24, 30),
      tempoLift: randomBetween(10, 18),
      layerVolume: randomBetween(0.82, 1.12),
      layerDelay: randomBetween(-0.014, 0.026),
      bellPattern: randomChoice(bellPatterns),
      bellShift: randomChoice([-2, 0, 0, 2, 3, 5]),
      bellStepOffset: randomInt(8),
      bellColor: {
        secondRatio: randomBetween(1.985, 2.025),
        thirdRatio: randomBetween(2.94, 3.08),
        secondVolume: randomBetween(0.34, 0.5),
        thirdVolume: randomBetween(0.12, 0.24),
        releaseScale: randomBetween(0.48, 0.64),
        detuneSpread: randomBetween(-7, 7)
      },
      counterPattern: randomChoice(counterPatterns),
      counterShift: randomChoice([-5, -2, 0, 0, 3]),
      counterStepOffset: randomInt(4),
      upperPattern: randomChoice(upperPatterns),
      upperShift: randomChoice([-2, 0, 0, 3, 5]),
      upperStepOffset: randomInt(4),
      droneRatios,
      droneStepOffset: randomInt(droneRatios.length),
      percussionOffset: randomInt(4),
      organAttack: randomBetween(0.08, 0.16),
      organRelease: randomBetween(0.24, 0.38),
      organGlide: randomBetween(0.988, 0.998),
      organStops: [
        { ratio: 1, type: randomChoice(pipeTypes), volume: 1, detune: randomBetween(-2, 2) },
        { ratio: 2, type: randomChoice(pipeTypes), volume: randomBetween(0.3, 0.46), detune: randomBetween(-5, 5) },
        { ratio: 3, type: "sine", volume: randomBetween(0.08, 0.18), detune: randomBetween(-4, 4) },
        { ratio: randomChoice([0.5, 0.75]), type: "sine", volume: randomBetween(0.12, 0.22), detune: randomBetween(-3, 3) }
      ]
    };
  }

  musicIntervalForMode(mode) {
    const profile = this.musicProfile ?? this.createMusicProfile();
    const intervalByMode = {
      title: 660,
      game: Math.max(500, 585 + profile.tempoOffset - (this.currentMusicIntensity() - 1) * profile.tempoLift),
      over: 760
    };

    return intervalByMode[mode] ?? 620;
  }

  currentMusicIntensity() {
    return Math.max(1, Math.min(COMBO_MUSIC_MAX_LEVEL, this.musicIntensity));
  }

  syncMusicToCombo(level) {
    const nextLevel = Math.max(
      this.currentMusicIntensity(),
      Math.min(COMBO_MUSIC_MAX_LEVEL, 1 + Math.max(0, level - 1) * 0.82)
    );

    this.musicIntensity = nextLevel;
    const normalized = (nextLevel - 1) / (COMBO_MUSIC_MAX_LEVEL - 1);
    this.appShell?.style.setProperty("--music-intensity", normalized.toFixed(3));
    this.appShell?.style.setProperty("--music-glow", normalized > 0 ? (0.035 + normalized * 0.095).toFixed(3) : "0");
    this.refreshMusicTempo();
  }

  resetMusicIntensity(updateTempo = true) {
    this.musicIntensity = 1;
    this.appShell?.style.setProperty("--music-intensity", "0");
    this.appShell?.style.setProperty("--music-glow", "0");

    if (updateTempo) {
      this.refreshMusicTempo();
    }
  }

  refreshMusicTempo() {
    if (!this.musicTimer || this.musicMode !== "game") {
      return;
    }

    const nextInterval = Math.round(this.musicIntervalForMode("game"));
    if (Math.abs(nextInterval - this.musicIntervalMs) < 18) {
      return;
    }

    window.clearInterval(this.musicTimer);
    this.musicIntervalMs = nextInterval;
    this.musicTimer = window.setInterval(() => this.scheduleMusicStep(), this.musicIntervalMs);
  }

  ensureAudio() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      return null;
    }

    if (!this.audioContext) {
      this.audioContext = new AudioContextClass();
    }

    if (this.audioContext.state === "suspended") {
      this.audioContext.resume().catch(() => {});
    }

    return this.audioContext;
  }

  startMusic(mode = "game") {
    if (!this.soundEnabled) {
      return;
    }

    if (this.musicTimer && this.musicMode === mode) {
      return;
    }

    if (this.musicTimer || this.musicGain) {
      this.stopMusic();
    }

    this.ensureAudio();

    if (!this.audioContext) {
      return;
    }

    if (this.audioContext.state === "suspended") {
      this.audioContext.resume()
        .then(() => this.startMusic(mode))
        .catch(() => {});
      return;
    }

    const now = this.audioContext.currentTime;
    this.musicMode = mode;
    this.musicGain = this.audioContext.createGain();
    this.musicGain.gain.setValueAtTime(0.0001, now);
    this.musicGain.gain.exponentialRampToValueAtTime(this.musicVolumeForMode(mode), now + 0.75);
    this.musicGain.connect(this.audioContext.destination);
    this.musicStep = 0;
    this.scheduleMusicStep();
    this.musicIntervalMs = this.musicIntervalForMode(mode);
    this.musicTimer = window.setInterval(() => this.scheduleMusicStep(), this.musicIntervalMs);
  }

  stopMusic() {
    if (this.musicTimer) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = 0;
    }

    if (!this.musicGain || !this.audioContext) {
      this.musicGain = null;
      return;
    }

    const oldGain = this.musicGain;
    const now = this.audioContext.currentTime;
    oldGain.gain.cancelScheduledValues(now);
    oldGain.gain.setValueAtTime(Math.max(0.0001, oldGain.gain.value), now);
    oldGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    window.setTimeout(() => oldGain.disconnect(), 340);
    this.musicGain = null;
    this.musicMode = null;
    this.musicIntervalMs = 0;
  }

  scheduleMusicStep() {
    if (!this.audioContext || !this.musicGain || !this.soundEnabled) {
      return;
    }

    if (this.musicMode === "title") {
      this.scheduleTitleMusicStep();
      return;
    }

    if (this.musicMode === "over") {
      this.scheduleGameOverMusicStep();
      return;
    }

    this.scheduleGameMusicStep();
  }

  scheduleGameMusicStep() {
    const profile = this.musicProfile ?? this.createMusicProfile();
    const cycle = 64;
    const step = this.musicStep % cycle;
    const bar = Math.floor(step / 4);
    const phraseTurn = Math.floor(step / 16);
    const rootMotion = profile.rootMotion[bar % profile.rootMotion.length] + profile.longMotion[phraseTurn % profile.longMotion.length];
    const root = profile.baseRoot * 2 ** (rootMotion / 12);
    const start = this.audioContext.currentTime + 0.04;
    const intensity = this.currentMusicIntensity();
    const normalized = (intensity - 1) / (COMBO_MUSIC_MAX_LEVEL - 1);
    const layerStart = start + profile.layerDelay;
    const layerVolume = profile.layerVolume;
    const melodyInterval = profile.bellPattern[(step + profile.bellStepOffset) % profile.bellPattern.length] + profile.bellShift;
    const counterInterval = profile.counterPattern[(bar + profile.counterStepOffset) % profile.counterPattern.length] + profile.counterShift;
    const upperInterval = profile.upperPattern[(step + profile.upperStepOffset) % profile.upperPattern.length] + profile.upperShift;

    if (step % 4 === 0) {
      this.playOrganChord(
        profile.chordColor.map((semitones) => root * 2 ** (semitones / 12)),
        1.72,
        0.018 + normalized * 0.012,
        this.musicGain,
        start,
        0.014
      );
      this.playOrganTone(root / 2, 1.52, 0.024 + normalized * 0.012, this.musicGain, start, {
        attack: 0.12,
        release: 0.42
      });
    }

    if (step % 2 === 0) {
      this.playBellTone(root * 2 ** (melodyInterval / 12), 0.46, (0.018 + normalized * 0.014) * layerVolume, this.musicGain, start + 0.08, {
        color: profile.bellColor
      });
    } else if (intensity >= 2.1) {
      this.playBellTone(root * 2 ** ((counterInterval + 12) / 12), 0.34, (0.01 + normalized * 0.012) * layerVolume, this.musicGain, layerStart + 0.06, {
        color: profile.bellColor
      });
    }

    if ((step + profile.percussionOffset) % 2 === 0) {
      this.playStoneClick(this.musicGain, start + 0.015, 0.18 + normalized * 0.12, {
        frequency: root * 1.5,
        noiseFrequency: 900 + normalized * 700,
        compact: true
      });
    }

    if (intensity >= 1.8) {
      const droneRatio = profile.droneRatios[(step + profile.droneStepOffset) % profile.droneRatios.length];
      this.playOrganTone(root * droneRatio, 1.36, (0.01 + normalized * 0.012) * layerVolume, this.musicGain, layerStart + 0.02);
    }

    if (intensity >= 2.4) {
      this.playOrganTone(root * 2 ** (counterInterval / 12), 0.42, (0.012 + normalized * 0.01) * layerVolume, this.musicGain, layerStart + 0.25, {
        attack: 0.018,
        release: 0.16,
        stops: [
          { ratio: 1, type: "triangle", volume: 1, detune: -3 },
          { ratio: 2.01, type: "sine", volume: 0.32, detune: 5 }
        ]
      });
    }

    if (intensity >= 3.2) {
      this.playBellTone(root * 2 ** ((upperInterval + 12) / 12), 0.32, (0.012 + normalized * 0.014) * layerVolume, this.musicGain, layerStart + 0.31, {
        color: profile.bellColor
      });
      this.playStoneClick(this.musicGain, layerStart + 0.36, 0.12 + normalized * 0.1, {
        frequency: root * 2,
        noiseFrequency: 1400,
        compact: true
      });
    }

    if (intensity >= 4 || this.resonanceActive) {
      this.playOrganTone(root * 2 ** (upperInterval / 12), 0.48, (0.012 + normalized * 0.012) * layerVolume, this.musicGain, layerStart + 0.44, {
        attack: 0.024,
        release: 0.2
      });
    }

    if (this.resonanceActive) {
      this.playOrganChord([
        root * 2 ** (7 / 12),
        root * 2 ** (12 / 12),
        root * 2 ** (19 / 12)
      ], 0.82, 0.016 * layerVolume, this.musicGain, layerStart + 0.16, 0.018);
    }

    this.musicStep += 1;
  }

  scheduleTitleMusicStep() {
    const progression = [
      { root: 174.61, chord: [0, 3, 7], toll: 12 },
      { root: 164.81, chord: [0, 3, 8], toll: null },
      { root: 146.83, chord: [0, 5, 8], toll: 12 },
      { root: 130.81, chord: [0, 3, 7], toll: null },
      { root: 116.54, chord: [0, 5, 8], toll: 10 },
      { root: 130.81, chord: [0, 3, 7], toll: null }
    ];
    const step = this.musicStep % progression.length;
    const phrase = progression[step];
    const start = this.audioContext.currentTime + 0.035;
    const longTone = step % 2 === 0 ? 0.9 : 0.72;
    const accent = phrase.melody ?? phrase.toll;

    phrase.chord.forEach((semitones, index) => {
      const frequency = phrase.root * 2 ** (semitones / 12);
      this.playOrganTone(frequency, longTone, index === 0 ? 0.095 : 0.055, this.musicGain, start);
    });
    this.playOrganTone(phrase.root / 2, longTone * 1.05, 0.06, this.musicGain, start);
    if (accent !== null) {
      this.playOrganTone(phrase.root * 2 ** (accent / 12), 0.62, 0.075, this.musicGain, start + 0.03);
    }

    this.musicStep += 1;
  }

  scheduleGameOverMusicStep() {
    const progression = [
      { root: 174.61, chord: [0, 3, 7], melody: 12 },
      { root: 174.61, chord: [0, 3, 7], melody: 15 },
      { root: 220.00, chord: [0, 3, 7], melody: 12 },
      { root: 220.00, chord: [0, 3, 7], melody: 10 },
      { root: 196.00, chord: [0, 4, 7], melody: 11 },
      { root: 196.00, chord: [0, 4, 7], melody: 14 },
      { root: 261.63, chord: [0, 4, 7], melody: 12 },
      { root: 261.63, chord: [0, 4, 7], melody: 7 },
      { root: 146.83, chord: [0, 3, 7], melody: 10 },
      { root: 146.83, chord: [0, 3, 7], melody: 12 },
      { root: 196.00, chord: [0, 4, 7], melody: 11 },
      { root: 196.00, chord: [0, 4, 7], melody: 7 },
      { root: 174.61, chord: [0, 3, 7], melody: 8 },
      { root: 130.81, chord: [0, 4, 7], melody: 7 },
      { root: 174.61, chord: [0, 3, 7], melody: 3 },
      { root: 174.61, chord: [0, 3, 7], melody: 0 }
    ];
    const step = this.musicStep % progression.length;
    const phrase = progression[step];
    const start = this.audioContext.currentTime + 0.04;
    const accent = phrase.toll ?? phrase.melody;

    phrase.chord.forEach((semitones, index) => {
      this.playOrganTone(phrase.root * 2 ** (semitones / 12), 1.08, index === 0 ? 0.075 : 0.045, this.musicGain, start + index * 0.012);
    });
    this.playOrganTone(phrase.root / 2, 1.18, 0.052, this.musicGain, start);

    if (accent !== null) {
      this.playBellTone(phrase.root * 2 ** (accent / 12), 1.1, 0.034, this.musicGain, start + 0.12);
    }

    this.musicStep += 1;
  }

  playOrganTone(frequency, duration, volume, destination, startTime = this.audioContext.currentTime, options = {}) {
    const profile = this.musicProfile ?? {};
    const stops = options.stops ?? profile.organStops ?? [
      { ratio: 1, type: "sine", volume: 1, detune: 0 },
      { ratio: 2, type: "triangle", volume: 0.46, detune: -3 },
      { ratio: 3, type: "sine", volume: 0.18, detune: 2 },
      { ratio: 0.5, type: "sine", volume: 0.22, detune: 0 }
    ];
    const attack = options.attack ?? profile.organAttack ?? 0.11;
    const release = options.release ?? profile.organRelease ?? 0.22;
    const glide = options.glide ?? profile.organGlide ?? 0.985;

    stops.forEach((stop) => {
      this.playTone(
        frequency * stop.ratio,
        duration,
        stop.type,
        volume * stop.volume,
        destination,
        startTime,
        { attack, release, detune: stop.detune, glide }
      );
    });
  }

  playOrganChord(frequencies, duration, volume, destination, startTime = this.audioContext.currentTime, stagger = 0) {
    frequencies.forEach((frequency, index) => {
      this.playOrganTone(
        frequency,
        duration,
        volume * (index === 0 ? 1 : 0.72),
        destination,
        startTime + index * stagger
      );
    });
  }

  playBellTone(frequency, duration, volume, destination, startTime = this.audioContext.currentTime, options = {}) {
    const color = options.color ?? this.musicProfile?.bellColor ?? {};
    const secondRatio = color.secondRatio ?? 2.01;
    const thirdRatio = color.thirdRatio ?? 2.98;
    const secondVolume = color.secondVolume ?? 0.46;
    const thirdVolume = color.thirdVolume ?? 0.22;
    const releaseScale = color.releaseScale ?? 0.62;
    const detuneSpread = color.detuneSpread ?? 0;

    this.playTone(frequency, duration, "triangle", volume, destination, startTime, {
      attack: 0.006,
      release: duration * releaseScale,
      glide: 0.992
    });
    this.playTone(frequency * secondRatio, duration * 0.86, "sine", volume * secondVolume, destination, startTime + 0.004, {
      attack: 0.004,
      release: duration * 0.58,
      detune: 5 + detuneSpread,
      glide: 0.994
    });
    this.playTone(frequency * thirdRatio, duration * 0.54, "sine", volume * thirdVolume, destination, startTime + 0.012, {
      attack: 0.003,
      release: duration * 0.42,
      detune: -6 - detuneSpread,
      glide: 0.996
    });
  }

  playBassImpact(frequency, duration, volume, destination, startTime = this.audioContext.currentTime, options = {}) {
    const bend = options.bend ?? 0.48;
    const sub = Math.max(28, frequency * 0.5);

    this.playTone(frequency, duration, "sawtooth", volume, destination, startTime, {
      attack: 0.004,
      release: duration * 0.62,
      glide: bend,
      detune: options.detune ?? -5
    });
    this.playTone(sub, duration * 1.16, "sine", volume * 0.92, destination, startTime, {
      attack: 0.008,
      release: duration * 0.72,
      glide: Math.max(0.42, bend * 0.92)
    });
    this.playTone(frequency * 1.5, Math.min(0.16, duration * 0.42), "square", volume * 0.32, destination, startTime + 0.012, {
      attack: 0.003,
      release: 0.1,
      glide: 0.62,
      detune: options.detune ?? -8
    });
  }

  playNoiseBurst(duration, volume, destination, startTime = this.audioContext.currentTime, options = {}) {
    if (!this.audioContext) {
      return;
    }

    const sampleRate = this.audioContext.sampleRate;
    const frameCount = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = this.audioContext.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;

    for (let index = 0; index < frameCount; index += 1) {
      const white = Math.random() * 2 - 1;
      last = last * 0.62 + white * 0.38;
      data[index] = last;
    }

    const source = this.audioContext.createBufferSource();
    const filter = this.audioContext.createBiquadFilter();
    const gain = this.audioContext.createGain();
    const endTime = startTime + duration;
    const attack = options.attack ?? 0.006;
    const release = options.release ?? duration * 0.72;

    source.buffer = buffer;
    filter.type = options.filterType ?? "bandpass";
    filter.frequency.setValueAtTime(options.frequency ?? 620, startTime);
    filter.Q.setValueAtTime(options.q ?? 5.5, startTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), startTime + attack);
    gain.gain.setValueAtTime(Math.max(0.0001, volume * 0.72), Math.max(startTime + attack, endTime - release));
    gain.gain.exponentialRampToValueAtTime(0.0001, endTime);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    source.start(startTime);
    source.stop(endTime + 0.02);
  }

  playStoneClick(destination, startTime = this.audioContext.currentTime, intensity = 1, options = {}) {
    const volume = Math.max(0.08, Math.min(1.6, intensity));
    const frequency = options.frequency ?? 196;
    const noiseFrequency = options.noiseFrequency ?? 1200;
    const compact = Boolean(options.compact);

    this.playTone(frequency, compact ? 0.052 : 0.075, "triangle", (compact ? 0.012 : 0.026) * volume, destination, startTime, {
      attack: 0.002,
      release: compact ? 0.032 : 0.048,
      glide: 0.72,
      detune: options.detune ?? randomBetween(-8, 5)
    });
    this.playTone(frequency * 0.48, compact ? 0.075 : 0.12, "sine", (compact ? 0.008 : 0.018) * volume, destination, startTime + 0.003, {
      attack: 0.004,
      release: compact ? 0.044 : 0.075,
      glide: 0.64
    });
    this.playNoiseBurst(compact ? 0.026 : 0.042, (compact ? 0.006 : 0.018) * volume, destination, startTime + 0.001, {
      frequency: noiseFrequency,
      q: compact ? 8 : 10,
      filterType: "bandpass",
      attack: 0.001,
      release: compact ? 0.018 : 0.03
    });
  }

  createSfxBus(startTime = this.audioContext.currentTime, duration = 0.8, volume = 1, options = {}) {
    const input = this.audioContext.createGain();
    const highpass = this.audioContext.createBiquadFilter();
    const lowpass = this.audioContext.createBiquadFilter();
    const compressor = this.audioContext.createDynamicsCompressor();
    const endTime = startTime + duration;

    highpass.type = "highpass";
    highpass.frequency.setValueAtTime(options.highpass ?? 48, startTime);
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(options.lowpass ?? 6200, startTime);
    lowpass.Q.setValueAtTime(options.q ?? 0.6, startTime);
    compressor.threshold.setValueAtTime(-23, startTime);
    compressor.knee.setValueAtTime(16, startTime);
    compressor.ratio.setValueAtTime(3.2, startTime);
    compressor.attack.setValueAtTime(0.004, startTime);
    compressor.release.setValueAtTime(0.12, startTime);
    const mixVolume = volume * (this.sfxVolume ?? 1);
    input.gain.setValueAtTime(0.0001, startTime);
    input.gain.exponentialRampToValueAtTime(Math.max(0.0001, mixVolume), startTime + 0.012);
    input.gain.setValueAtTime(Math.max(0.0001, mixVolume * 0.96), Math.max(startTime + 0.02, endTime - 0.08));
    input.gain.exponentialRampToValueAtTime(0.0001, endTime);
    input.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(compressor);
    compressor.connect(this.audioContext.destination);
    window.setTimeout(() => {
      try {
        input.disconnect();
        highpass.disconnect();
        lowpass.disconnect();
        compressor.disconnect();
      } catch (error) {
        // Some browsers throw if an audio node has already been disconnected.
      }
    }, Math.max(120, (duration + 0.28) * 1000));

    return input;
  }

  playGemPing(destination, startTime = this.audioContext.currentTime, intensity = 1, options = {}) {
    const volume = Math.max(0.25, Math.min(1.65, intensity));
    const frequency = options.frequency ?? 246.94;
    const shimmer = options.shimmer ?? 1;
    const detune = options.detune ?? randomBetween(-5, 5);
    const body = options.accent ? 0.016 : 0.011;

    this.playTone(frequency * 0.5, 0.18, "sine", body * volume, destination, startTime, {
      attack: 0.006,
      release: 0.11,
      glide: 0.94,
      detune: detune * 0.35
    });
    this.playTone(frequency, 0.28, "triangle", 0.023 * volume, destination, startTime + 0.002, {
      attack: 0.004,
      release: 0.16,
      glide: 0.985,
      detune
    });
    this.playTone(frequency * 2.07 * shimmer, 0.2, "sine", 0.010 * volume, destination, startTime + 0.009, {
      attack: 0.003,
      release: 0.12,
      glide: 0.992,
      detune: 4 - detune
    });
    this.playTone(frequency * 2.82, 0.13, "sine", 0.005 * volume, destination, startTime + 0.018, {
      attack: 0.002,
      release: 0.08,
      glide: 0.996,
      detune: -8
    });
    this.playNoiseBurst(0.034, 0.0065 * volume, destination, startTime + 0.003, {
      frequency: frequency * 5.2,
      q: 10,
      filterType: "bandpass",
      attack: 0.001,
      release: 0.024
    });
  }

  playGemSlide(destination, startTime = this.audioContext.currentTime, intensity = 1) {
    const volume = Math.max(0.35, Math.min(1.45, intensity));

    this.playGemPing(destination, startTime, 0.54 * volume, {
      frequency: 174.61,
      shimmer: 0.94,
      detune: -6,
      accent: true
    });
    this.playNoiseBurst(0.12, 0.009 * volume, destination, startTime + 0.018, {
      frequency: 980,
      q: 2.6,
      filterType: "bandpass",
      attack: 0.006,
      release: 0.09
    });
    this.playTone(220, 0.1, "triangle", 0.012 * volume, destination, startTime + 0.048, {
      attack: 0.004,
      release: 0.055,
      glide: 1.22,
      detune: 4
    });
    this.playGemPing(destination, startTime + 0.078, 0.44 * volume, {
      frequency: 261.63,
      shimmer: 1.04,
      detune: 3
    });
  }

  playTempleBody(destination, startTime = this.audioContext.currentTime, intensity = 1, options = {}) {
    const volume = Math.max(0.25, Math.min(1.55, intensity));
    const frequency = options.frequency ?? 73.42;
    const duration = options.duration ?? 0.42;

    this.playTone(frequency, duration, "sine", 0.032 * volume, destination, startTime, {
      attack: 0.012,
      release: duration * 0.56,
      glide: options.glide ?? 0.82,
      detune: -3
    });
    this.playTone(frequency * 1.49, duration * 0.72, "triangle", 0.012 * volume, destination, startTime + 0.012, {
      attack: 0.01,
      release: duration * 0.38,
      glide: 0.91,
      detune: 5
    });
  }

  playMatchBloom(destination, startTime = this.audioContext.currentTime, intensity = 1, options = {}) {
    const volume = Math.max(0.35, Math.min(1.55, intensity));
    const root = options.root ?? 196;
    const intervals = options.intervals ?? [0, 4, 7, 12];

    this.playTempleBody(destination, startTime, 0.66 * volume, {
      frequency: root * 0.375,
      duration: 0.46,
      glide: 0.88
    });
    intervals.forEach((interval, index) => {
      const frequency = root * 2 ** (interval / 12);
      this.playGemPing(destination, startTime + index * 0.036, volume * (0.76 - index * 0.06), {
        frequency,
        shimmer: 1 + index * 0.025,
        accent: index === 0
      });
    });
  }

  playComboBloom(destination, startTime = this.audioContext.currentTime, intensity = 1, chain = 2, options = {}) {
    const volume = Math.max(0.4, Math.min(1.7, intensity));
    const root = options.root ?? 130.81;
    const steps = options.compact ? Math.max(3, Math.min(6, chain)) : Math.max(4, Math.min(9, chain + 2));
    const spacing = options.compact ? 0.038 : 0.052;

    this.playTempleBody(destination, startTime, 0.82 * volume, {
      frequency: root * 0.42,
      duration: options.compact ? 0.36 : 0.64,
      glide: 0.74
    });
    for (let index = 0; index < steps; index += 1) {
      const interval = [0, 3, 5, 7, 10, 12, 15, 17, 19][index] ?? index * 2;
      this.playGemPing(destination, startTime + 0.018 + index * spacing, volume * (0.64 + index * 0.035), {
        frequency: root * 2 ** (interval / 12),
        shimmer: 0.96 + index * 0.018,
        accent: index === steps - 1
      });
    }
  }

  playRejectChime(destination, startTime = this.audioContext.currentTime, intensity = 1) {
    const volume = Math.max(0.35, Math.min(1.3, intensity));

    this.playTempleBody(destination, startTime, 0.64 * volume, {
      frequency: 55,
      duration: 0.32,
      glide: 0.68
    });
    this.playGemPing(destination, startTime + 0.035, 0.48 * volume, {
      frequency: 155.56,
      shimmer: 0.9,
      detune: -9
    });
    this.playGemPing(destination, startTime + 0.092, 0.34 * volume, {
      frequency: 138.59,
      shimmer: 0.88,
      detune: -12
    });
  }

  playTone(frequency, duration, type, volume, destination, startTime = this.audioContext.currentTime, options = {}) {
    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    const endTime = startTime + duration;
    const attack = options.attack ?? 0.012;
    const release = options.release ?? 0.02;
    const glide = options.glide ?? 0.86;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startTime);
    oscillator.detune.setValueAtTime(options.detune ?? 0, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * glide), endTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), startTime + attack);
    gain.gain.setValueAtTime(Math.max(0.0001, volume * 0.82), Math.max(startTime + attack, endTime - release));
    gain.gain.exponentialRampToValueAtTime(0.0001, endTime);
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(startTime);
    oscillator.stop(endTime + 0.02);
  }

  playSound(kind) {
    if (!this.soundEnabled) {
      return;
    }

    this.ensureAudio();

    if (!this.audioContext) {
      return;
    }

    if (this.audioContext.state === "suspended") {
      this.audioContext.resume()
        .then(() => this.playSound(kind))
        .catch(() => {});
      return;
    }

    const now = this.audioContext.currentTime + 0.01;

    switch (kind) {
      case "select":
        {
          const bus = this.createSfxBus(now, 0.22, 1.06, { lowpass: 3800, highpass: 58 });
          this.playStoneClick(bus, now, 1.12, { frequency: 174.61, noiseFrequency: 1150 });
          this.playGemPing(bus, now + 0.018, 0.28, { frequency: 349.23, shimmer: 0.96 });
        }
        break;
      case "swap":
        {
          const bus = this.createSfxBus(now, 0.42, 1.1, { lowpass: 4200, highpass: 52 });
          this.playStoneClick(bus, now, 1.18, { frequency: 164.81, noiseFrequency: 980 });
          this.playStoneClick(bus, now + 0.07, 0.94, { frequency: 220, noiseFrequency: 1450 });
          this.playTone(130.81, 0.14, "triangle", 0.018, bus, now + 0.035, {
            attack: 0.004,
            release: 0.08,
            glide: 1.18,
            detune: -4
          });
        }
        break;
      case "drop":
        {
          const bus = this.createSfxBus(now, 0.28, 0.92, { lowpass: 3600, highpass: 42 });
          this.playStoneClick(bus, now, 0.86, { frequency: 123.47, noiseFrequency: 760 });
          this.playStoneClick(bus, now + 0.035, 0.48, { frequency: 146.83, noiseFrequency: 980, compact: true });
        }
        break;
      case "match":
        {
          const bus = this.createSfxBus(now, 0.62, 1.04, { lowpass: 6500, highpass: 48 });
          this.playStoneClick(bus, now, 0.76, { frequency: 146.83, noiseFrequency: 1200 });
          this.playMatchBloom(bus, now + 0.035, 0.94, {
            root: 196,
            intervals: [0, 3, 7, 12]
          });
        }
        break;
      case "combo":
        {
          const bus = this.createSfxBus(now, 0.9, 1.16, { lowpass: 6200, highpass: 38 });
          this.playStoneClick(bus, now, 1.06, { frequency: 98, noiseFrequency: 880 });
          this.playStoneClick(bus, now + 0.075, 0.9, { frequency: 130.81, noiseFrequency: 1180 });
          this.playComboBloom(bus, now + 0.055, 1.02, Math.max(2, this.displayCombo), {
            root: 110
          });
        }
        break;
      case "invalid":
        this.playRejectChime(this.createSfxBus(now, 0.5, 0.9, { lowpass: 4300 }), now, 1);
        break;
      case "shuffle":
        {
          const bus = this.createSfxBus(now, 0.66, 0.96, { lowpass: 4200, highpass: 48 });
          [0, 1, 2, 3].forEach((_, index) => {
            this.playStoneClick(bus, now + index * 0.055, 0.68, {
              frequency: 110 + index * 18,
              noiseFrequency: 900 + index * 160,
              compact: index > 0
            });
          });
        }
        break;
      case "resonance":
        this.playComboBloom(this.createSfxBus(now, 1.35, 1.08, { lowpass: 7000, highpass: 36 }), now, 1.18, 7, {
          root: 146.83
        });
        break;
      case "temple":
        {
          const bus = this.createSfxBus(now, 1.05, 0.98, { lowpass: 5400, highpass: 36 });
          this.playTempleBody(bus, now, 0.8, { frequency: 55, duration: 0.58, glide: 0.82 });
          [164.81, 207.65, 246.94, 329.63].forEach((frequency, index) => {
            this.playGemPing(bus, now + 0.04 + index * 0.07, 0.64 - index * 0.06, {
              frequency,
              shimmer: 1.02 + index * 0.02,
              accent: index === 3
            });
          });
        }
        break;
      case "special":
        {
          const bus = this.createSfxBus(now, 1.15, 1.08, { lowpass: 7200, highpass: 38 });
          this.playTempleBody(bus, now, 0.92, { frequency: 49, duration: 0.76, glide: 0.82 });
          [196, 246.94, 293.66, 392].forEach((frequency, index) => {
            this.playGemPing(bus, now + 0.08 + index * 0.08, 0.84 - index * 0.08, {
              frequency,
              shimmer: 1.04,
              accent: index === 3
            });
          });
        }
        break;
      case "start":
        this.playMatchBloom(this.createSfxBus(now, 0.9, 0.96, { lowpass: 6200 }), now, 0.9, {
          root: 174.61,
          intervals: [0, 5, 7, 12]
        });
        break;
      case "levelup":
        {
          const bus = this.createSfxBus(now, 0.92, 1.02, { lowpass: 7000, highpass: 48 });
          [174.61, 220, 261.63, 329.63, 392].forEach((frequency, index) => {
            this.playBellTone(frequency, 0.36, 0.035 - index * 0.002, bus, now + index * 0.055);
          });
          this.playStoneClick(bus, now, 0.7, { frequency: 130.81, noiseFrequency: 1000 });
        }
        break;
      case "timeup":
        {
          const bus = this.createSfxBus(now, 1.2, 1.06, { lowpass: 5200, highpass: 34 });
          [82.41, 73.42, 65.41].forEach((frequency, index) => {
            this.playTempleBody(bus, now + index * 0.18, 0.88 - index * 0.12, {
              frequency,
              duration: 0.5,
              glide: 0.76
            });
          });
          this.playGemPing(bus, now + 0.08, 0.58, { frequency: 196, shimmer: 0.94 });
        }
        break;
      case "over":
        this.playMatchBloom(this.createSfxBus(now, 1.05, 0.82, { lowpass: 4800 }), now, 0.74, {
          root: 130.81,
          intervals: [0, -3, -7]
        });
        break;
      default:
        this.playGemPing(this.createSfxBus(now, 0.36, 0.74, { lowpass: 5400 }), now, 0.7, {
          frequency: 220
        });
    }
  }

  formatNumber(value) {
    return new Intl.NumberFormat("en-US").format(Math.round(value));
  }
}

window.addEventListener("DOMContentLoaded", () => {
  new Game();
});
