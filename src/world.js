import * as T from 'three';
import { isBlockedSphere } from './rules.js';

function addBox(scene, boxes, meshes, x, y, z, w, h, d, color, emissive = 0x000000) {
  const mesh = new T.Mesh(
    new T.BoxGeometry(w, h, d),
    new T.MeshStandardMaterial({ color, emissive, emissiveIntensity: emissive ? 0.15 : 0, roughness: 0.8, metalness: 0.2 }),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  boxes.push(new T.Box3().setFromObject(mesh));
  meshes.push(mesh);
  return mesh;
}

function addCylinder(scene, x, y, z, radius, height, color) {
  const mesh = new T.Mesh(
    new T.CylinderGeometry(radius, radius, height, 12),
    new T.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.3 }),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  scene.add(mesh);
}

export function createWorld(scene, renderer) {
  const colliders = [];
  const collidableMeshes = [];

  scene.background = new T.Color(0x080d15);
  scene.fog = new T.Fog(0x080d15, 60, 140);

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;

  const hemi = new T.HemisphereLight(0xabc6ff, 0x101820, 1.2);
  const dir = new T.DirectionalLight(0xddeaff, 1.25);
  dir.position.set(15, 24, -6);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  dir.shadow.camera.left = -55;
  dir.shadow.camera.right = 55;
  dir.shadow.camera.top = 55;
  dir.shadow.camera.bottom = -55;
  scene.add(hemi, dir);

  const floor = new T.Mesh(
    new T.PlaneGeometry(120, 98),
    new T.MeshStandardMaterial({ color: 0x1a232e, roughness: 0.95, metalness: 0.05 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const mainLane = new T.Mesh(
    new T.PlaneGeometry(100, 16),
    new T.MeshStandardMaterial({ color: 0x202f43, roughness: 1 }),
  );
  mainLane.rotation.x = -Math.PI / 2;
  mainLane.position.y = 0.01;
  scene.add(mainLane);

  // Outer walls
  for (const args of [
    [0, 3.2, -46, 112, 6.4, 2],
    [0, 3.2, 46, 112, 6.4, 2],
    [-56, 3.2, 0, 2, 6.4, 92],
    [56, 3.2, 0, 2, 6.4, 92],
  ]) addBox(scene, colliders, collidableMeshes, ...args, 0x33445d);

  // Spawn protection alcoves and sightline blockers
  for (const args of [
    [-14, 2.5, -34, 2, 5, 14],
    [14, 2.5, -34, 2, 5, 14],
    [0, 2.2, -27, 20, 4.4, 2],
    [-14, 2.5, 34, 2, 5, 14],
    [14, 2.5, 34, 2, 5, 14],
    [0, 2.2, 27, 20, 4.4, 2],
  ]) addBox(scene, colliders, collidableMeshes, ...args, 0x405270);

  // Central urban structures / corridors
  for (const args of [
    [-34, 5, 0, 12, 10, 18],
    [34, 5, 0, 12, 10, 18],
    [0, 4.5, 0, 14, 9, 12],
    [-20, 3, -10, 8, 6, 10],
    [20, 3, -10, 8, 6, 10],
    [-20, 3, 11, 8, 6, 10],
    [20, 3, 11, 8, 6, 10],
  ]) addBox(scene, colliders, collidableMeshes, ...args, 0x2a3548);

  // Cover pieces
  for (const args of [
    [-26, 1.5, -21, 10, 3, 2],
    [26, 1.5, -21, 10, 3, 2],
    [-13, 1.5, -7, 8, 3, 2],
    [13, 1.5, -7, 8, 3, 2],
    [-22, 1.5, 8, 9, 3, 2],
    [22, 1.5, 8, 9, 3, 2],
    [-10, 1.5, 22, 7, 3, 2],
    [10, 1.5, 22, 7, 3, 2],
  ]) addBox(scene, colliders, collidableMeshes, ...args, 0x667d99, 0x1f2b42);

  // Industrial props
  for (const prop of [
    [-40, 1, -25, 1.1, 2],
    [40, 1, -25, 1.1, 2],
    [-40, 1, 25, 1.1, 2],
    [40, 1, 25, 1.1, 2],
    [-4, 1, -16, 0.9, 2.2],
    [4, 1, 16, 0.9, 2.2],
  ]) addCylinder(scene, ...prop, 0x7a8ca7);

  const objectiveCenter = new T.Vector3(0, 0, 24);
  const objectiveRadius = 6;
  const zone = new T.Mesh(
    new T.CylinderGeometry(objectiveRadius, objectiveRadius, 0.18, 32),
    new T.MeshStandardMaterial({ color: 0x2f6e56, transparent: true, opacity: 0.38, emissive: 0x1d3f34, emissiveIntensity: 0.55 }),
  );
  zone.position.copy(objectiveCenter);
  zone.position.y = 0.1;
  zone.receiveShadow = true;
  scene.add(zone);

  const spawn = {
    player: new T.Vector3(0, 1.7, -38),
    allies: [new T.Vector3(-5, 1.7, -34), new T.Vector3(5, 1.7, -34)],
    enemies: [new T.Vector3(-10, 1.7, 37), new T.Vector3(0, 1.7, 39), new T.Vector3(10, 1.7, 37)],
  };

  const patrol = {
    attacker: [
      new T.Vector3(-24, 1.7, -15), new T.Vector3(-8, 1.7, -8), new T.Vector3(0, 1.7, -2), new T.Vector3(10, 1.7, -8), new T.Vector3(22, 1.7, -14), objectiveCenter.clone(),
    ],
    defender: [
      new T.Vector3(-20, 1.7, 13), new T.Vector3(20, 1.7, 13), new T.Vector3(0, 1.7, 19), new T.Vector3(-8, 1.7, 28), new T.Vector3(8, 1.7, 28), objectiveCenter.clone(),
    ],
  };

  const ray = new T.Raycaster();

  function collidesSphere(position, radius) {
    return isBlockedSphere(colliders, position, radius);
  }

  function hasLineOfSight(a, b) {
    const dir = b.clone().sub(a);
    const dist = dir.length();
    if (dist < 0.001) return true;
    ray.set(a, dir.normalize());
    const hit = ray.intersectObjects(collidableMeshes, false)[0];
    return !hit || hit.distance > dist;
  }

  return {
    objectiveCenter,
    objectiveRadius,
    objectiveMesh: zone,
    spawn,
    patrol,
    collidesSphere,
    hasLineOfSight,
  };
}
