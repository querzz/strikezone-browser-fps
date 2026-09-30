import * as T from 'three';
import { TEAM, WEAPONS } from './constants.js';

export function makeHumanoidMesh(color) {
  const root = new T.Group();
  const body = new T.Mesh(
    new T.CapsuleGeometry(0.45, 0.95, 4, 8),
    new T.MeshStandardMaterial({ color, roughness: 0.65 }),
  );
  body.position.y = 1;
  root.add(body);

  const head = new T.Mesh(
    new T.SphereGeometry(0.28, 12, 10),
    new T.MeshStandardMaterial({ color: 0xf6ddd0 }),
  );
  head.position.set(0, 2.05, 0);
  root.add(head);

  body.name = 'body';
  head.name = 'head';

  return { root, body, head };
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
  constructor(scene, team, position, color, patrolPoints) {
    this.team = team;
    const { root, body, head } = makeHumanoidMesh(color);
    this.mesh = root;
    this.bodyMesh = body;
    this.headMesh = head;
    this.mesh.position.copy(position);
    this.mesh.userData.bot = this;
    this.bodyMesh.userData.hitPart = 'body';
    this.headMesh.userData.hitPart = 'head';
    this.bodyMesh.userData.bot = this;
    this.headMesh.userData.bot = this;
    scene.add(this.mesh);

    this.hp = 100;
    this.moveSpeed = team === TEAM.DEFENDER ? 2.7 : 2.9;
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
  }

  destroy(scene) {
    scene.remove(this.mesh);
    this.dead = true;
  }
}
