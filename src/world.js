import * as T from 'three';

function makeBox(scene, boxes, x, y, z, w, h, d, color) {
  const mesh = new T.Mesh(
    new T.BoxGeometry(w, h, d),
    new T.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.08 }),
  );
  mesh.position.set(x, y, z);
  scene.add(mesh);
  boxes.push(new T.Box3().setFromObject(mesh));
  return mesh;
}

export function createWorld(scene) {
  const colliders = [];
  const collidableMeshes = [];

  scene.background = new T.Color(0x0a101a);

  const hemi = new T.HemisphereLight(0xbfd7ff, 0x101114, 1.6);
  const dir = new T.DirectionalLight(0xffffff, 1.1);
  dir.position.set(8, 14, 4);
  scene.add(hemi, dir);

  const floor = new T.Mesh(
    new T.PlaneGeometry(110, 90),
    new T.MeshStandardMaterial({ color: 0x172233, roughness: 0.9 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const laneTint = new T.MeshStandardMaterial({ color: 0x1f2f45, roughness: 1 });
  const lane = new T.Mesh(new T.PlaneGeometry(96, 18), laneTint);
  lane.rotation.x = -Math.PI / 2;
  lane.position.y = 0.01;
  scene.add(lane);

  const borderH = 4;
  const wallColor = 0x324766;
  for (const args of [
    [0, borderH / 2, -42, 100, borderH, 2],
    [0, borderH / 2, 42, 100, borderH, 2],
    [-50, borderH / 2, 0, 2, borderH, 84],
    [50, borderH / 2, 0, 2, borderH, 84],
  ]) {
    const m = makeBox(scene, colliders, ...args, wallColor);
    collidableMeshes.push(m);
  }

  const coverColor = 0x637ea3;
  for (const args of [
    [-24, 1.6, -22, 10, 3.2, 2],
    [24, 1.6, -22, 10, 3.2, 2],
    [-12, 1.6, -10, 8, 3.2, 2],
    [12, 1.6, -10, 8, 3.2, 2],
    [-20, 1.6, 5, 8, 3.2, 2],
    [20, 1.6, 5, 8, 3.2, 2],
    [-10, 1.6, 19, 7, 3.2, 2],
    [10, 1.6, 19, 7, 3.2, 2],
    [0, 1.6, 0, 8, 3.2, 8],
    [-33, 2.4, -2, 3, 4.8, 10],
    [33, 2.4, 2, 3, 4.8, 10],
  ]) {
    const m = makeBox(scene, colliders, ...args, coverColor);
    collidableMeshes.push(m);
  }

  const objectiveCenter = new T.Vector3(0, 0, 24);
  const objectiveRadius = 6;

  const zone = new T.Mesh(
    new T.CylinderGeometry(objectiveRadius, objectiveRadius, 0.2, 28),
    new T.MeshStandardMaterial({ color: 0x295f4e, transparent: true, opacity: 0.4 }),
  );
  zone.position.copy(objectiveCenter);
  zone.position.y = 0.1;
  scene.add(zone);

  const spawn = {
    player: new T.Vector3(0, 1.7, -34),
    allies: [new T.Vector3(-5, 1.7, -31), new T.Vector3(5, 1.7, -31)],
    enemies: [new T.Vector3(-10, 1.7, 34), new T.Vector3(0, 1.7, 36), new T.Vector3(10, 1.7, 34)],
  };

  const patrol = {
    attacker: [new T.Vector3(-20, 1.7, -14), new T.Vector3(0, 1.7, -4), new T.Vector3(19, 1.7, -12), objectiveCenter.clone()],
    defender: [new T.Vector3(-18, 1.7, 14), new T.Vector3(18, 1.7, 14), new T.Vector3(0, 1.7, 28), objectiveCenter.clone()],
  };

  const ray = new T.Raycaster();

  function collidesSphere(position, radius) {
    for (const box of colliders) {
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
