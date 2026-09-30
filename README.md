# Neon Strike Protocol

Original single-player tactical browser FPS vertical slice built with Three.js. This project is not Counter-Strike and intentionally uses original naming, gameplay framing, and procedural/stylized visuals.

## Setup

Requirements: Node.js 22+.

```bash
npm install
npm run dev
```

Windows quick start is preserved via `start.bat` (installs deps, then runs dev server).

## Validation

```bash
npm run smoke
```

`smoke` runs a production build as a basic validation step.

## Core features in this slice

- Start menu with settings (mouse sensitivity + audio volume)
- Pointer lock FPS controls with sprint, jump, gravity, collision, and pause flow
- Procedural arena with lanes, cover, attacker/defender spawn zones, and collision-friendly navigation
- Team round system (player + allied bots vs defender bots), round timer, score tracking, best-of-5 match resolution
- Buy/loadout phase with credits and an in-game shop (`B`)
- Pistol + rifle, rifle ADS, recoil/spread, reload, ammo reserve, tracers, muzzle flash, hit marker, kill feed, weapon switching (`1`/`2`)
- Bot AI patrol + engagement behavior with line-of-sight checks and objective pressure
- Objective mode: attackers must secure the zone while defenders delay/deny capture
- Responsive HUD and restartable end-of-match flow

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
- `Esc` pause / release pointer lock

## Assets and license notes

- Core gameplay does not depend on remote models or downloaded copyrighted game assets.
- Arena, bots, zone marker, and effects are procedural Three.js geometry/materials created in project code.
- Audio uses generated WebAudio tones (no external sound files).

## Known limitations

- Single-player only (no networking, no server authority, no anti-cheat).
- Bot behavior is intentionally lightweight for a compact vertical slice.
- Build emits a bundle size warning due to Three.js footprint.
