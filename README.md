# Birthstone Sanctum

A complete browser-based match-3 time attack game built with plain HTML, CSS, and JavaScript. It uses a 7x7 board, seven active vivid gem types, a static full-screen ancient-ruins background, swap matching, gravity, spawning, chain reactions, scoring, a 60-second timer, and lightweight browser-generated mystical BGM/SE.

## Repository Structure

```text
/project-root
├── index.html
├── style.css
├── main.js
├── bgm-preview.html
├── bgm-preview.js
├── assets/
│   ├── bg-jade-courtyard.svg
│   ├── bg-lantern-hall.svg
│   ├── bg-moon-gate.svg
│   └── oriental-pattern.svg
└── README.md
```

## Run Locally

No build step is required.

1. Open `index.html` directly in a modern browser.
2. Or serve the folder with any static server:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Controls

- Click one gem, then click an adjacent gem to swap.
- Drag or swipe a gem toward an adjacent gem to swap.
- Keyboard: focus a gem, then press an arrow key to swap in that direction.
- Clear shapes are horizontal 3+, vertical 3+, diagonal 3+, and 2x2 squares.
- You can keep swapping playable pieces while chain reactions are resolving.
- If no clear happens for 7 seconds, a playable swap hint glows on the board.
- Every 50 cleared stones creates a SPECIAL stone. Click it to clear every stone of the same type on the board.
- Matching gems fills the Resonance gauge. When it reaches 100%, press **Resonate** to briefly slow the timer and boost match scoring.
- Use the BGM and SE sliders in the HUD to adjust music and effects separately.

## GitHub Pages Deployment

1. Create a GitHub repository and push these files to the default branch.
2. Open the repository settings on GitHub.
3. Go to **Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select your default branch and the root folder.
6. Save. GitHub will publish the game as a static site.

## Game Feel and Animation Notes

- Eased tile swaps and gravity falls use CSS transitions.
- Invalid moves bounce back and shake the board.
- Matches trigger gem bursts, light columns, expanding rings, sigils, shard particles, board pulse, score popups, and combo ribbons. Chain reactions increase the number and scale of burst objects.
- Chain reactions emit lightweight full-screen resonance particles. The particle count and glow scale with the chain count and remain capped for performance.
- Quick consecutive clears build an ECHO streak, adding subtle board glow, particles, higher match tones, and persistent BGM layers without changing the core rules.
- The visual theme is a copyright-safe reinterpretation of a heavy 16-bit jewel puzzle mood: black/deep navy board, stone temple frame, high-saturation pixel-faceted gems, sandstone tablet UI, and all SVG scene resources redrawn as shaded pixel-temple art.
- Gameplay music reacts to combo intensity by slightly tightening the pulse while keeping the core BGM intact. Each run generates a different original music profile, so tempo feel, FM-like bell shimmer, marimba-style taps, pad drones, wood percussion, and countermelodies vary. Once unlocked, those layers keep playing in concert with the base theme for the rest of the run.
- The background moves through three stage themes, calm moon gate, jade courtyard, and lantern hall, as the 60-second timer drops from 60 to 40, 40 to 20, and 20 to 0 seconds.
- A ritual-light overlay grows with the timer progress while preserving board readability.
- Score starts from cleared gems x 100, then multiplies by chain count, cleared-gem volume, simultaneous match groups, ECHO streaks, and Resonance state.
- The Stones HUD tracks progress toward the next SPECIAL stone and changes to SPECIAL while one is waiting on the board.
- Resonance mode adds a temporary score multiplier, stronger light response, resonance-only match lances and orbits, a screen-wide wave, and a slower timer drain for a short ritual-like surge.
- Each run now has three ritual missions. Completed missions award Sanctum Light, which is saved locally and advances the temple rank shown on the title and result screens.
- The result screen shows a run title, cleared stones, best chain, largest clear, top stone, SPECIAL uses, Resonance uses, mission results, and Sanctum Light gained.
- After Time UP, final-score milestones from 20,000 through 200,000 trigger one of eight 1980s arcade-style pixel temple cut-ins before the result screen, with the temple growing larger at higher score tiers.
- Mobile HUD spacing, compact controls, and swipe thresholds are tuned for smaller screens.
- New tiles drop in from above with a springy entrance.
- The full-screen oriental scene background remains visible behind the board.
- Web Audio sound effects and procedural BGM loops are included for title, gameplay, and game-over screens. The current SFX concept is a temple-gem resonance kit: stone clicks for selection/swaps/drops, crystalline blooms for matches, and heavier chime cascades for combos, specials, resonance, and Time UP. Browser audio starts after a user action such as pressing Start Game.
- When the timer reaches zero, the board pauses on a large **Time UP!** callout before transitioning to the result screen.

## Improvement Ideas

- Add handcrafted gem sprite art or shader-like canvas highlights.
- Add special stones for 4-match, 5-match, line clears, and bombs.
- Replace the generated BGM with mastered audio files or add additional procedural stage themes.
- Add local leaderboards and shareable result cards.
- Add level goals, blockers, and move-limited puzzle stages.
- Add a tutorial overlay and accessibility options for reduced contrast or colorblind palettes.
