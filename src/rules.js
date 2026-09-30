import { TEAM } from './constants.js';

export function applyReload(ammo, reserve, magSize) {
  const need = Math.min(Math.max(0, magSize - ammo), reserve);
  return { ammo: ammo + need, reserve: reserve - need };
}

export function evaluateRoundOutcome({ timer, capture, attackersAlive, defendersAlive }) {
  if (capture >= 100) return { done: true, winner: TEAM.ATTACKER, reason: 'zone secured' };
  if (defendersAlive <= 0) return { done: true, winner: TEAM.ATTACKER, reason: 'defenders eliminated' };
  if (attackersAlive <= 0) return { done: true, winner: TEAM.DEFENDER, reason: 'attackers eliminated' };
  if (timer <= 0) return { done: true, winner: TEAM.DEFENDER, reason: 'timer expired' };
  return { done: false };
}

export function isBlockedSphere(boxes, position, radius) {
  for (const box of boxes) {
    const px = Math.max(box.min.x, Math.min(position.x, box.max.x));
    const py = Math.max(box.min.y, Math.min(position.y, box.max.y));
    const pz = Math.max(box.min.z, Math.min(position.z, box.max.z));
    const dx = position.x - px;
    const dy = position.y - py;
    const dz = position.z - pz;
    if ((dx * dx) + (dy * dy) + (dz * dz) < (radius * radius)) return true;
  }
  return false;
}
