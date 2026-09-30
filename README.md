# StrikeZone

Original single-player browser FPS prototype, not Counter-Strike. Includes bots, shooting, reload, simple wall collision and win/loss states. No multiplayer or Windows EXE included.

## Run
Install Node.js 22.12+ (or compatible current LTS). Download ZIP and extract, then double-click start.bat on Windows. Alternatively run npm install and npm run dev -- --open. Run npm run build for a static production build.

Controls: WASD, mouse, left click to shoot, R reload, Shift faster movement, Escape pause. Click the button to resume or restart after win/loss.

## Online model
A decorative RobotExpressive GLB loads from https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb . Internet required for this model only. It is not bundled in the repository. Model provenance/license: https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf/RobotExpressive . Respect the original asset license if redistributing. Bots, weapon view and arena do not use Counter-Strike assets. Bots use procedural capsules; no weapon model or animations yet. Failed model download does not prevent gameplay.

Prototype not executed or browser-tested in the assistant environment.
