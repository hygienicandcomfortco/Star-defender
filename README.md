# Star Defender - Space Combat Baseline

Production-oriented starter for a desktop/browser action game using **TypeScript + Phaser + Vite**.

## Implemented Systems
- Scene pipeline: `boot -> preload -> main-menu -> game + ui + settings`
- Asset manifest and preload pipeline (`src/assets/manifest.ts`) for images + audio
- Save profile service with schema and persistence (`src/core/profile.ts`)
- Runtime audio service with real audio files and mixer channels (`master`, `music`, `sfx`)
- In-game/settings overlay with persistent controls and profile reset
- Wave/level progression system with UFO enemy variety (`ufo-scout`, `ufo-raider`, `ufo-mothership`)
- Gameplay loop with collisions, dynamic difficulty tiers, and lifetime stats tracking
- Space-war visual theme: starfield arena, fighter jet player, and alien UFO attackers

## Run
```bash
npm install
npm run dev
```

## Desktop (Electron)
```bash
npm run desktop
```

Production desktop package:
```bash
npm run build:desktop
```

## Build
```bash
npm run build
npm run preview
```

## Controls
- Move: `WASD` or arrow keys
- Start run: `SPACE`
- Open settings from menu: `O`
- Open settings in-game: `ESC`

## Project Structure
- `src/core`: persistence and audio services
- `src/assets`: typed asset manifest
- `src/scenes`: gameplay and UI scenes
- `public/assets`: sprite files used by preload
- `electron`: desktop runtime scaffold
