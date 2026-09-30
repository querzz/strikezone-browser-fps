import * as T from 'three';
import { TEAM, WEAPONS } from './constants.js';

export function makeHumanoidMesh(team) {
  const colors = team === TEAM.DEFENDER
    ? { armor: 0xa2534f, accent: 0xffd6d2 }
    : { armor: 0x5a7dc6, accent: 0xd9e6ff };

  const root = new T.Group();

  const torso = new T.Mesh(
    new T.BoxGeometry(0.72, 1, 0.4),
    new T.MeshStandardMaterial({ color: colors.armor, roughness: 0.62 }),
  );
  torso.position.y = 1.35;

  const pelvis = new T.Mesh(
    new T.BoxGeometry(0.58, 0.45, 0.34),
    new T.MeshStandardMaterial({ color: 0x2e3647, roughness: 0.65 }),
  );
  pelvis.position.y = 0.82;

  const head = new T.Mesh(
    new T.BoxGeometry(0.36, 0.42, 0.34),
    new T.MeshStandardMaterial({ color: 0xefcfbf, roughness: 0.74 }),
  );
  head.position.y = 2;

  const visor = new T.Mesh(
    new T.BoxGeometry(0.25, 0.11, 0.35),
    new T.MeshStandardMaterial({ color: colors.accent, emissive: colors.accent, emissiveIntensity: 0.18 }),
  );
  visor.position.set(0, 2, 0.18);

  const leftArm = new T.Mesh(new T.BoxGeometry(0.22, 0.78, 0.22), new T.MeshStandardMaterial({ color: 0x394c68 }));
  leftArm.position.set(-0.47, 1.35, 0);
  const rightArm = leftArm.clone();
  rightArm.position.x = 0.47;

  const leftLeg = new T.Mesh(new T.BoxGeometry(0.24, 0.92, 0.26), new T.MeshStandardMaterial({ color: 0x2a3240 }));
  leftLeg.position.set(-0.18, 0.28, 0);
  const rightLeg = leftLeg.clone();
  rightLeg.position.x = 0.18;

  const shoulderBand = new T.Mesh(
    new T.BoxGeometry(0.92, 0.12, 0.26),
    new T.MeshStandardMaterial({ color: colors.accent, emissive: colors.accent, emissiveIntensity: 0.16 }),
  );
  shoulderBand.position.set(0, 1.72, -0.02);

  root.add(torso, pelvis, head, visor, leftArm, rightArm, leftLeg, rightLeg, shoulderBand);

  torso.userData.hitPart = 'body';
  head.userData.hitPart = 'head';
  visor.userData.hitPart = 'head';

  return {
    root,
    body: torso,
    head,
    limbs: { leftArm, rightArm, leftLeg, rightLeg },
  };
}

export function createViewModel(camera) {
  const root = new T.Group();
  root.position.set(0.34, -0.38, -0.75);

  const handMat = new T.MeshStandardMaterial({ color: 0xd4b6a0, roughness: 0.8 });
  const gloveMat = new T.MeshStandardMaterial({ color: 0x26344f, roughness: 0.7 });

  const leftHand = new T.Mesh(new T.BoxGeometry(0.13, 0.11, 0.2), handMat);
  leftHand.position.set(-0.12, -0.08, 0.02);
  const rightHand = new T.Mesh(new T.BoxGeometry(0.13, 0.11, 0.2), handMat);
  rightHand.position.set(0.07, -0.1, 0.03);

  const leftWrist = new T.Mesh(new T.BoxGeometry(0.11, 0.1, 0.17), gloveMat);
  leftWrist.position.set(-0.12, -0.14, -0.03);
  const rightWrist = leftWrist.clone();
  rightWrist.position.x = 0.07;

  const rifle = new T.Group();
  const rifleBody = new T.Mesh(new T.BoxGeometry(0.12, 0.14, 0.8), new T.MeshStandardMaterial({ color: 0x303747 }));
  const rifleBarrel = new T.Mesh(new T.CylinderGeometry(0.022, 0.022, 0.56, 8), new T.MeshStandardMaterial({ color: 0x8ea0b9 }));
  rifleBarrel.rotation.x = Math.PI / 2;
  rifleBarrel.position.z = -0.66;
  const rifleStock = new T.Mesh(new T.BoxGeometry(0.16, 0.1, 0.18), new T.MeshStandardMaterial({ color: 0x4a586f }));
  rifleStock.position.z = 0.38;
  const rifleSight = new T.Mesh(new T.BoxGeometry(0.05, 0.05, 0.09), new T.MeshStandardMaterial({ color: 0xaec7ff }));
  rifleSight.position.set(0, 0.1, -0.08);
  rifle.add(rifleBody, rifleBarrel, rifleStock, rifleSight);

  const pistol = new T.Group();
  const pistolBody = new T.Mesh(new T.BoxGeometry(0.11, 0.12, 0.34), new T.MeshStandardMaterial({ color: 0x303747 }));
  const pistolSlide = new T.Mesh(new T.BoxGeometry(0.095, 0.06, 0.22), new T.MeshStandardMaterial({ color: 0x90a2c6 }));
  pistolSlide.position.set(0, 0.07, -0.02);
  const pistolGrip = new T.Mesh(new T.BoxGeometry(0.09, 0.16, 0.1), new T.MeshStandardMaterial({ color: 0x52617a }));
  pistolGrip.position.set(0, -0.12, 0.08);
  pistol.add(pistolBody, pistolSlide, pistolGrip);

  root.add(leftHand, rightHand, leftWrist, rightWrist, rifle, pistol);
  camera.add(root);

  return {
    root,
    leftHand,
    rightHand,
    leftWrist,
    rightWrist,
    rifle,
    pistol,
    state: {
      recoil: 0,
      swayX: 0,
      swayY: 0,
      switchT: 0,
      reloadT: 0,
      active: 'rifle',
    },
  };
}

export function initLoadout(primary = 'rifle') {
  return {
    inventory: ['pistol', primary],
    activeIndex: primary === 'rifle' ? 1 : 0,
    weapons: {
      pistol: { id: 'pistol', ammo: WEAPONS.pistol.magSize, reserve: WEAPONS.pistol.reserve, cooldown: 0, reloading: 0 },
      rifle: { id: 'rifle', ammo: primary === 'rifle' ? WEAPONS.rifle.magSize : 0, reserve: primary === 'rifle' ? WEAPONS.rifle.reserve : 0, cooldown: 0, reloading: 0 },
    },
  };
}

export class Bot {
  constructor(scene, team, position, patrolPoints, difficulty) {
    this.team = team;
    const { root, body, head, limbs } = makeHumanoidMesh(team);
    this.mesh = root;
    this.bodyMesh = body;
    this.headMesh = head;
    this.limbs = limbs;
    this.mesh.position.copy(position);
    this.mesh.userData.bot = this;

    this.bodyMesh.userData.bot = this;
    this.headMesh.userData.bot = this;

    scene.add(this.mesh);

    this.hp = 100;
    this.moveSpeed = team === TEAM.DEFENDER ? 2.8 : 3.05;
    this.weapon = {
      ...WEAPONS.pistol,
      ammo: WEAPONS.pistol.magSize,
      reserve: WEAPONS.pistol.reserve,
      cooldown: 0,
      reloading: 0,
    };
    this.patrolPoints = patrolPoints.map((p) => p.clone());
    this.patrolIndex = Math.floor(Math.random() * this.patrolPoints.length);
    this.visionRange = 34;
    this.dead = false;
    this.movePhase = Math.random() * Math.PI * 2;
    this.deathTimer = 0;
    this.reactionDelay = difficulty.reactionMin + (Math.random() * (difficulty.reactionMax - difficulty.reactionMin));
    this.reactionClock = this.reactionDelay;
  }

  updateAnimation(dt, moving) {
    if (this.dead) {
      this.deathTimer += dt;
      this.mesh.rotation.z = Math.min(1.5, this.deathTimer * 3.6);
      this.mesh.position.y = Math.max(0, 1.2 - this.deathTimer * 2.8);
      return;
    }
    if (!moving) {
      this.limbs.leftArm.rotation.x *= 0.7;
      this.limbs.rightArm.rotation.x *= 0.7;
      this.limbs.leftLeg.rotation.x *= 0.7;
      this.limbs.rightLeg.rotation.x *= 0.7;
      return;
    }
    this.movePhase += dt * 9;
    this.limbs.leftArm.rotation.x = Math.sin(this.movePhase) * 0.55;
    this.limbs.rightArm.rotation.x = -Math.sin(this.movePhase) * 0.55;
    this.limbs.leftLeg.rotation.x = -Math.sin(this.movePhase) * 0.72;
    this.limbs.rightLeg.rotation.x = Math.sin(this.movePhase) * 0.72;
  }

  destroy(scene) {
    this.dead = true;
    this.mesh.userData.removalQueued = true;
    setTimeout(() => {
      scene.remove(this.mesh);
    }, 550);
  }
}
