import test from 'node:test';
import assert from 'node:assert/strict';
import { applyReload, evaluateRoundOutcome, isBlockedSphere } from '../src/rules.js';
import { TEAM } from '../src/constants.js';

test('applyReload transfers reserve into magazine with cap', () => {
  assert.deepEqual(applyReload(4, 20, 12), { ammo: 12, reserve: 12 });
  assert.deepEqual(applyReload(10, 1, 12), { ammo: 11, reserve: 0 });
});

test('evaluateRoundOutcome prioritizes objective and elimination', () => {
  assert.deepEqual(
    evaluateRoundOutcome({ timer: 40, capture: 100, attackersAlive: 2, defendersAlive: 2 }),
    { done: true, winner: TEAM.ATTACKER, reason: 'zone secured' },
  );
  assert.deepEqual(
    evaluateRoundOutcome({ timer: 40, capture: 10, attackersAlive: 1, defendersAlive: 0 }),
    { done: true, winner: TEAM.ATTACKER, reason: 'defenders eliminated' },
  );
  assert.deepEqual(
    evaluateRoundOutcome({ timer: 0, capture: 0, attackersAlive: 1, defendersAlive: 1 }),
    { done: true, winner: TEAM.DEFENDER, reason: 'timer expired' },
  );
});

test('isBlockedSphere detects sphere-box overlap', () => {
  const box = [{ min: { x: -1, y: -1, z: -1 }, max: { x: 1, y: 1, z: 1 } }];
  assert.equal(isBlockedSphere(box, { x: 0.5, y: 0, z: 0 }, 0.4), true);
  assert.equal(isBlockedSphere(box, { x: 2, y: 0, z: 0 }, 0.4), false);
});
