"use strict";

const TRACKS = {
  title: {
    label: "タイトルBGM",
    mode: "game",
    volume: 0.42,
    interval: 760,
    progression: [
      { root: 174.61, chord: [0, 3, 7], toll: 12 },
      { root: 164.81, chord: [0, 3, 8], toll: null },
      { root: 146.83, chord: [0, 5, 8], toll: 12 },
      { root: 130.81, chord: [0, 3, 7], toll: null },
      { root: 116.54, chord: [0, 5, 8], toll: 10 },
      { root: 130.81, chord: [0, 3, 7], toll: null }
    ]
  },
  game: {
    label: "ゲーム中BGM",
    mode: "title",
    volume: 0.32,
    interval: 940,
    progression: [
      { root: 130.81, chord: [0, 7, 12], bell: 19 },
      { root: 130.81, chord: [3, 7, 12], bell: null },
      { root: 146.83, chord: [0, 5, 10], bell: 17 },
      { root: 146.83, chord: [0, 7, 12], bell: null },
      { root: 174.61, chord: [0, 3, 10], bell: 15 },
      { root: 164.81, chord: [0, 5, 9], bell: null },
      { root: 130.81, chord: [0, 7, 12], bell: 12 },
      { root: 98.00, chord: [0, 7, 15], bell: null }
    ]
  },
  over: {
    label: "終了BGM",
    mode: "over",
    volume: 0.36,
    interval: 880,
    progression: [
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
    ]
  }
};

const qs = (selector, root = document) => root.querySelector(selector);

class BgmPreview {
  constructor() {
    this.audioContext = null;
    this.musicGain = null;
    this.musicTimer = 0;
    this.musicStep = 0;
    this.currentTrack = this.readTrack();

    this.trackName = qs("#trackName");
    this.playButton = qs("#playButton");
    this.stopButton = qs("#stopButton");
    this.status = qs("#previewStatus");
    this.links = [...document.querySelectorAll("[data-track-link]")];

    this.syncUi();
    this.bindEvents();
  }

  readTrack() {
    const params = new URLSearchParams(window.location.search);
    const track = params.get("track") ?? "title";
    return TRACKS[track] ? track : "title";
  }

  bindEvents() {
    this.playButton.addEventListener("click", () => this.start(this.currentTrack));
    this.stopButton.addEventListener("click", () => this.stop());
  }

  syncUi() {
    const track = TRACKS[this.currentTrack];
    this.trackName.textContent = track.label;
    this.playButton.textContent = `Play ${track.label}`;

    this.links.forEach((link) => {
      link.classList.toggle("is-active", link.dataset.trackLink === this.currentTrack);
    });
  }

  ensureAudio() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      this.status.textContent = "Web Audio is not supported.";
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

  start(trackId) {
    const track = TRACKS[trackId] ?? TRACKS.title;
    this.currentTrack = TRACKS[trackId] ? trackId : "title";
    this.syncUi();
    this.stop();
    this.ensureAudio();

    if (!this.audioContext) {
      return;
    }

    if (this.audioContext.state === "suspended") {
      this.audioContext.resume()
        .then(() => this.start(trackId))
        .catch(() => {});
      return;
    }

    const now = this.audioContext.currentTime;
    this.musicGain = this.audioContext.createGain();
    this.musicGain.gain.setValueAtTime(0.0001, now);
    this.musicGain.gain.exponentialRampToValueAtTime(track.volume, now + 0.55);
    this.musicGain.connect(this.audioContext.destination);
    this.musicStep = 0;
    this.scheduleMusicStep();
    this.musicTimer = window.setInterval(() => this.scheduleMusicStep(), track.interval);
    this.status.textContent = `Playing ${track.label}`;
  }

  stop() {
    if (this.musicTimer) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = 0;
    }

    if (!this.musicGain || !this.audioContext) {
      this.musicGain = null;
      this.status.textContent = "Stopped";
      return;
    }

    const oldGain = this.musicGain;
    const now = this.audioContext.currentTime;
    oldGain.gain.cancelScheduledValues(now);
    oldGain.gain.setValueAtTime(Math.max(0.0001, oldGain.gain.value), now);
    oldGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    window.setTimeout(() => oldGain.disconnect(), 340);
    this.musicGain = null;
    this.status.textContent = "Stopped";
  }

  scheduleMusicStep() {
    if (!this.audioContext || !this.musicGain) {
      return;
    }

    const track = TRACKS[this.currentTrack];

    if (track.mode === "title") {
      this.scheduleTitleStep(track);
      return;
    }

    if (track.mode === "over") {
      this.scheduleOverStep(track);
      return;
    }

    this.scheduleGameStep(track);
  }

  scheduleGameStep(track) {
    const step = this.musicStep % track.progression.length;
    const phrase = track.progression[step];
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

  scheduleTitleStep(track) {
    const step = this.musicStep % track.progression.length;
    const phrase = track.progression[step];
    const start = this.audioContext.currentTime + 0.04;

    phrase.chord.forEach((semitones, index) => {
      this.playOrganTone(phrase.root * 2 ** (semitones / 12), 1.12, index === 0 ? 0.07 : 0.044, this.musicGain, start + index * 0.018);
    });
    this.playOrganTone(phrase.root / 2, 1.2, 0.048, this.musicGain, start);

    if (phrase.bell !== null) {
      this.playBellTone(phrase.root * 2 ** (phrase.bell / 12), 0.92, 0.028, this.musicGain, start + 0.22);
    }

    this.musicStep += 1;
  }

  scheduleOverStep(track) {
    const step = this.musicStep % track.progression.length;
    const phrase = track.progression[step];
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

  playOrganTone(frequency, duration, volume, destination, startTime = this.audioContext.currentTime) {
    const stops = [
      { ratio: 1, type: "sine", volume: 1, detune: 0 },
      { ratio: 2, type: "triangle", volume: 0.46, detune: -3 },
      { ratio: 3, type: "sine", volume: 0.18, detune: 2 },
      { ratio: 0.5, type: "sine", volume: 0.22, detune: 0 }
    ];

    stops.forEach((stop) => {
      this.playTone(
        frequency * stop.ratio,
        duration,
        stop.type,
        volume * stop.volume,
        destination,
        startTime,
        { attack: 0.11, release: 0.22, detune: stop.detune, glide: 0.985 }
      );
    });
  }

  playBellTone(frequency, duration, volume, destination, startTime = this.audioContext.currentTime) {
    this.playTone(frequency, duration, "triangle", volume, destination, startTime, {
      attack: 0.006,
      release: duration * 0.62,
      glide: 0.992
    });
    this.playTone(frequency * 2.01, duration * 0.86, "sine", volume * 0.46, destination, startTime + 0.004, {
      attack: 0.004,
      release: duration * 0.58,
      detune: 5,
      glide: 0.994
    });
    this.playTone(frequency * 2.98, duration * 0.54, "sine", volume * 0.22, destination, startTime + 0.012, {
      attack: 0.003,
      release: duration * 0.42,
      detune: -6,
      glide: 0.996
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
}

window.addEventListener("DOMContentLoaded", () => {
  new BgmPreview();
});
