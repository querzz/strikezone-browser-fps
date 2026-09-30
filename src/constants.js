export const ROUND_TIME = 120;
export const BUY_TIME = 18;
export const WIN_ROUNDS = 3;

export const WEAPONS = {
  pistol: {
    name: 'VX-12 Pistol',
    magSize: 12,
    reserve: 48,
    fireDelay: 0.3,
    reloadTime: 1.2,
    bodyDamage: 28,
    headDamage: 58,
    spreadHip: 0.013,
    spreadAds: 0.01,
    recoil: 0.008,
    auto: false,
    cost: 0,
  },
  rifle: {
    name: 'AR-4 Carbine',
    magSize: 30,
    reserve: 120,
    fireDelay: 0.11,
    reloadTime: 1.8,
    bodyDamage: 20,
    headDamage: 44,
    spreadHip: 0.024,
    spreadAds: 0.009,
    recoil: 0.013,
    auto: true,
    cost: 900,
  },
};

export const TEAM = {
  ATTACKER: 'attacker',
  DEFENDER: 'defender',
};
