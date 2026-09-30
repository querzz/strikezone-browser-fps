# Neon Strike Protocol

Original single-player tactical browser FPS vertical slice built with Three.js. This project is not Counter-Strike and intentionally uses original naming, mechanics framing, and procedural/stylized visuals.

## Setup

Requirements: Node.js 22+.

```bash
npm install
npm run dev
```

Windows quick start is preserved via `start.bat` (installs dependencies and starts dev server with a clear Node/npm check).

## Validation

```bash
npm test
npm run smoke
```

- `npm test` runs logic unit tests for reload, round outcome, and collision helper rules.
- `npm run smoke` runs the production Vite build as a basic runtime validation.

## Slice features

- Start menu + pause flow with settings for sensitivity, audio volume, mute, and bot difficulty
- Pointer-lock first-person movement with sprint, jump, gravity, and collision
- Visible first-person procedural hands/weapons (pistol/rifle) with sway, recoil recovery, and switch/reload animation cues
- Procedural stylized humanoid bots with team markings and lightweight walk/death animation
- Industrial/urban procedural arena with buildings, corridors, cover props, spawn protection blockers, and readable lanes
- Round-based attacker vs defender flow: buy phase, score, timers, best-of-5 win condition
- Objective mode: attackers secure a zone while defenders contest and delay
- Combat feedback: ADS, spread/recoil, reload/ammo reserve, muzzle flash, tracers, impact sparks, hit + headshot marker, damage direction indicator, kill feed, TAB scoreboard
- Bot behavior with LOS checks, obstacle-aware movement fallback, reaction delay, and difficulty scaling
- Core gameplay has no remote model/audio dependency

## Controls

- `WASD` move
- `Shift` sprint
- `Space` jump
- `Mouse` look
- `Left Click` fire
- `Right Click` ADS (rifle)
- `R` reload
- `1` / `2` switch weapon
- `B` open/close shop
- `Tab` hold scoreboard
- `Esc` pause / release pointer lock

## Assets and licensing

- Core arena, characters, props, viewmodel, and effects use original procedural geometry/material authored in this repository.
- Audio uses runtime-generated WebAudio synthesis; no external sound files are required for gameplay.
- No Counter-Strike names, maps, models, textures, logos, sounds, or code are included.

## Known limitations / deferred

- Single-player only (no multiplayer, no anti-cheat/server authority).
- Bot AI remains lightweight and deterministic for a browser vertical slice.
- Optional Electron executable packaging and Windows artifact pipeline are deferred in this PR to keep scope on gameplay polish and reliability; this repo currently ships browser build workflow only.
