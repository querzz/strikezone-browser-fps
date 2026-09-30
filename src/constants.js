export const ROUND_TIME = 120;
export const BUY_TIME = 18;
export const WIN_ROUNDS = 3;

export const WEAPONS = {
  pistol: {
    id: 'pistol',
    name: 'VX-12 Pistol',
    magSize: 12,
    reserve: 48,
    fireDelay: 0.3,
    reloadTime: 1.2,
    bodyDamage: 28,
    headDamage: 58,
    spreadHip: 0.013,
    spreadAds: 0.01,
    recoilKick: 0.02,
    recoilRecover: 0.09,
    auto: false,
    cost: 0,
  },
  rifle: {
    id: 'rifle',
    name: 'AR-4 Carbine',
    magSize: 30,
    reserve: 120,
    fireDelay: 0.1,
    reloadTime: 1.8,
    bodyDamage: 20,
    headDamage: 44,
    spreadHip: 0.024,
    spreadAds: 0.009,
    recoilKick: 0.03,
    recoilRecover: 0.11,
    auto: true,
    cost: 900,
  },
};

export const TEAM = {
  ATTACKER: 'attacker',
  DEFENDER: 'defender',
};

export const DIFFICULTY = {
  casual: { key: 'casual', label: 'Casual', reactionMin: 0.42, reactionMax: 0.78, aimSpread: 0.06, pushBias: 0.7, damageScale: 0.8 },
  normal: { key: 'normal', label: 'Normal', reactionMin: 0.25, reactionMax: 0.5, aimSpread: 0.04, pushBias: 0.82, damageScale: 1 },
  hard: { key: 'hard', label: 'Hard', reactionMin: 0.16, reactionMax: 0.34, aimSpread: 0.028, pushBias: 0.95, damageScale: 1.1 },
};
