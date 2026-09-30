import * as T from 'three';
import { AudioBus } from './audio.js';
import { Bot, createViewModel, initLoadout } from './entities.js';
import { BUY_TIME, DIFFICULTY, ROUND_TIME, TEAM, WEAPONS, WIN_ROUNDS } from './constants.js';
import { createUI } from './ui.js';
import { applyReload, evaluateRoundOutcome } from './rules.js';
import { createWorld } from './world.js';

const MAX_TRACERS = 52;
const MAX_IMPACTS = 60;

function normalizeAngle(rad) {
  while (rad > Math.PI) rad -= Math.PI * 2;
  while (rad < -Math.PI) rad += Math.PI * 2;
  return rad;
}

export function createGame() {
  const ui = createUI();
  const audio = new AudioBus();

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(78, window.innerWidth / window.innerHeight, 0.1, 230);
  camera.rotation.order = 'YXZ';

  const renderer = new T.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  document.getElementById('app').append(renderer.domElement);

  const world = createWorld(scene, renderer);
  const clock = new T.Clock();
  const raycaster = new T.Raycaster();
  const viewModel = createViewModel(camera);

  const player = {
    position: world.spawn.player.clone().setY(0),
    velocityY: 0,
    onGround: true,
    eyeHeight: 1.7,
    radius: 0.42,
    yaw: 0,
    pitch: 0,
    hp: 100,
    dead: false,
    team: TEAM.ATTACKER,
    credits: 1600,
    kills: 0,
    loadout: initLoadout('rifle'),
    recoilPitch: 0,
    recoilYaw: 0,
    footstepTimer: 0,
  };

  const input = {
    keys: {},
    just: {},
    mouseLeft: false,
    mouseRight: false,
    showScore: false,
  };

  const match = {
    started: false,
    paused: false,
    phase: 'menu',
    round: 0,
    buyTimer: BUY_TIME,
    timer: ROUND_TIME,
    capture: 0,
    score: { attacker: 0, defender: 0 },
    feed: [],
    winner: null,
    winnerReason: '',
    difficulty: DIFFICULTY.normal,
    transitionTimer: 0,
  };

  const bots = [];
  const tracerPool = [];
  const impactPool = [];
  const tracerMaterialAlly = new T.LineBasicMaterial({ color: 0x9bc4ff, transparent: true, opacity: 0.88 });
  const tracerMaterialEnemy = new T.LineBasicMaterial({ color: 0xff9b8d, transparent: true, opacity: 0.82 });
  const muzzle = new T.PointLight(0xfff1c0, 0, 4.5, 2.3);
  camera.add(muzzle);
  scene.add(camera);

  function activeWeaponState() {
    const id = player.loadout.inventory[player.loadout.activeIndex];
    return player.loadout.weapons[id];
  }

  function activeWeaponDef() {
    return WEAPONS[activeWeaponState().id];
  }

  function pushFeed(text) {
    match.feed.unshift(text);
    match.feed = match.feed.slice(0, 8);
  }

  function addImpact(point, color = 0xc4d8ff) {
    if (impactPool.length >= MAX_IMPACTS) {
      const old = impactPool.shift();
      scene.remove(old.mesh);
      old.mesh.geometry.dispose();
      old.mesh.material.dispose();
    }
    const mesh = new T.Mesh(
      new T.SphereGeometry(0.09, 6, 6),
      new T.MeshBasicMaterial({ color }),
    );
    mesh.position.copy(point);
    scene.add(mesh);
    impactPool.push({ mesh, ttl: 0.17 });
  }

  function addTracer(a, b, allySide) {
    if (tracerPool.length >= MAX_TRACERS) {
      const old = tracerPool.shift();
      scene.remove(old.line);
      old.line.geometry.dispose();
    }
    const geom = new T.BufferGeometry().setFromPoints([a.clone(), b.clone()]);
    const line = new T.Line(geom, allySide ? tracerMaterialAlly : tracerMaterialEnemy);
    scene.add(line);
    tracerPool.push({ line, ttl: 0.07 });
  }

  function removeBot(bot) {
    bot.destroy(scene);
    const idx = bots.indexOf(bot);
    if (idx >= 0) bots.splice(idx, 1);
  }

  function applyDamage(targetBot, damage, killerName, weaponId) {
    if (targetBot.dead) return;
    targetBot.hp -= damage;
    if (targetBot.hp <= 0) {
      removeBot(targetBot);
      pushFeed(`${killerName} eliminated ${targetBot.team === TEAM.DEFENDER ? 'Defender' : 'Ally'} (${weaponId})`);
      if (killerName === 'You') {
        player.kills += 1;
        player.credits += 300;
      }
      audio.roundEvent(killerName === 'You');
    }
  }

  function applyPlayerDamage(amount, source, sourcePos) {
    if (player.dead || match.phase !== 'active') return;
    player.hp = Math.max(0, player.hp - amount);
    const toSource = sourcePos.clone().sub(player.position);
    const angle = normalizeAngle(Math.atan2(toSource.x, -toSource.z) - player.yaw);
    ui.pulseDamage(angle);
    audio.impact();
    if (player.hp <= 0) {
      player.dead = true;
      pushFeed(`${source} eliminated You`);
      audio.roundEvent(false);
    }
  }

  function pickTargetPoint(viewDir, spread) {
    const axis = new T.Vector3().copy(viewDir).normalize();
    const jitter = new T.Vector3(
      (Math.random() - 0.5) * spread,
      (Math.random() - 0.5) * spread,
      0,
    ).applyQuaternion(camera.quaternion);
    return axis.add(jitter).normalize();
  }

  function kickView(def) {
    player.recoilPitch = Math.min(0.12, player.recoilPitch + def.recoilKick);
    player.recoilYaw += (Math.random() - 0.5) * def.recoilKick * 0.45;
    viewModel.state.recoil = Math.min(1, viewModel.state.recoil + 0.55);
    muzzle.intensity = 2.4;
  }

  function shootPlayer() {
    const slot = activeWeaponState();
    const def = activeWeaponDef();
    if (slot.reloading > 0 || slot.cooldown > 0 || slot.ammo <= 0 || player.dead || match.phase !== 'active') return;

    slot.ammo -= 1;
    slot.cooldown = def.fireDelay;
    const ads = def.id === 'rifle' && input.mouseRight;
    const spread = ads ? def.spreadAds : def.spreadHip;

    const dir = pickTargetPoint(camera.getWorldDirection(new T.Vector3()), spread);
    const origin = camera.position.clone();
    raycaster.set(origin, dir);

    const enemies = bots.filter((b) => b.team !== player.team && !b.dead).flatMap((b) => [b.bodyMesh, b.headMesh]);
    const hit = raycaster.intersectObjects(enemies, false)[0];

    let targetPos = origin.clone().addScaledVector(dir, 65);
    if (hit) {
      const bot = hit.object.userData.bot;
      const part = hit.object.userData.hitPart;
      const isHeadshot = part === 'head';
      const dmg = isHeadshot ? def.headDamage : def.bodyDamage;
      applyDamage(bot, dmg, 'You', slot.id);
      targetPos = hit.point;
      ui.pulseHitmarker(isHeadshot);
      audio.hit(isHeadshot);
      addImpact(hit.point, isHeadshot ? 0xff8d8d : 0xc9ddff);
    } else {
      addImpact(targetPos, 0x75839c);
    }

    audio.fire(slot.id, ads);
    addTracer(origin, targetPos, true);
    kickView(def);
  }

  function doReload(slot, def) {
    if (slot.reloading > 0 || slot.ammo >= def.magSize || slot.reserve <= 0) return;
    slot.reloading = def.reloadTime;
    viewModel.state.reloadT = 1;
    audio.reloadStart();
  }

  function switchWeapon(index) {
    if (index === player.loadout.activeIndex) return;
    if (!player.loadout.inventory[index]) return;
    player.loadout.activeIndex = index;
    viewModel.state.switchT = 1;
    audio.tone(210, 0.045, 'square', 0.09, 310);
  }

  function updateWeaponTimers(dt) {
    for (const id of ['pistol', 'rifle']) {
      const slot = player.loadout.weapons[id];
      slot.cooldown = Math.max(0, slot.cooldown - dt);
      if (slot.reloading > 0) {
        slot.reloading = Math.max(0, slot.reloading - dt);
        if (slot.reloading === 0) {
          const def = WEAPONS[slot.id];
          const next = applyReload(slot.ammo, slot.reserve, def.magSize);
          slot.ammo = next.ammo;
          slot.reserve = next.reserve;
          audio.reloadEnd();
        }
      }
    }
  }

  function spawnTeams() {
    for (const b of [...bots]) removeBot(b);
    for (const pos of world.spawn.allies) {
      bots.push(new Bot(scene, TEAM.ATTACKER, pos, world.patrol.attacker, match.difficulty));
    }
    for (const pos of world.spawn.enemies) {
      bots.push(new Bot(scene, TEAM.DEFENDER, pos, world.patrol.defender, match.difficulty));
    }
  }

  function resetRoundState() {
    spawnTeams();
    player.position.copy(world.spawn.player).setY(0);
    player.velocityY = 0;
    player.onGround = true;
    player.hp = 100;
    player.dead = false;
    player.kills = 0;
    player.recoilPitch = 0;
    player.recoilYaw = 0;
    player.footstepTimer = 0;
    const hasRifle = player.loadout.inventory.includes('rifle');
    player.loadout = initLoadout(hasRifle ? 'rifle' : 'pistol');

    match.capture = 0;
    match.timer = ROUND_TIME;
    match.buyTimer = BUY_TIME;
    match.phase = 'buy';
    match.transitionTimer = 0;
    ui.showShop(player.credits);
    ui.crosshair.textContent = '+';
    pushFeed(`Round ${match.round} buy phase`);
    world.objectiveMesh.material.color.setHex(0x2f6e56);
    world.objectiveMesh.material.opacity = 0.38;
  }

  function startMatch() {
    match.started = true;
    match.round = 1;
    match.score.attacker = 0;
    match.score.defender = 0;
    match.feed = [];
    match.winner = null;
    match.winnerReason = '';
    player.credits = 1600;
    resetRoundState();
    renderer.domElement.requestPointerLock();
    ui.hideMenu();
  }

  function nextRound() {
    if (match.score.attacker >= WIN_ROUNDS || match.score.defender >= WIN_ROUNDS) {
      match.phase = 'matchOver';
      match.winner = match.score.attacker > match.score.defender ? 'Attackers' : 'Defenders';
      ui.showMenu(`${match.winner} win the operation`, false);
      return;
    }
    match.round += 1;
    resetRoundState();
    renderer.domElement.requestPointerLock();
    ui.hideMenu();
  }

  function endRound(winner, reason) {
    if (match.phase === 'roundEnd' || match.phase === 'matchOver') return;
    match.phase = 'roundEnd';
    match.winnerReason = reason;
    match.score[winner] += 1;
    player.credits += winner === TEAM.ATTACKER ? 1000 : 650;
    world.objectiveMesh.material.color.setHex(winner === TEAM.ATTACKER ? 0x2c9a5f : 0x7d3c3c);
    pushFeed(`${winner === TEAM.ATTACKER ? 'Attackers' : 'Defenders'} win round ${match.round} (${reason})`);
    audio.roundEvent(winner === TEAM.ATTACKER);
    match.transitionTimer = 3;
  }

  function botMove(bot, target, dt) {
    const to = target.clone().sub(bot.mesh.position);
    to.y = 0;
    const len = to.length();
    if (len < 0.2) {
      bot.updateAnimation(dt, false);
      return;
    }
    to.normalize();
    const step = bot.moveSpeed * dt;
    const candidate = bot.mesh.position.clone().addScaledVector(to, step);

    const tryDirs = [
      to,
      new T.Vector3(to.z, 0, -to.x).normalize(),
      new T.Vector3(-to.z, 0, to.x).normalize(),
      new T.Vector3(-to.x, 0, -to.z).normalize(),
    ];

    let moved = false;
    for (const dir of tryDirs) {
      const test = bot.mesh.position.clone().addScaledVector(dir, step * 0.95);
      if (!world.collidesSphere(new T.Vector3(test.x, 1.1, test.z), 0.42)) {
        bot.mesh.position.copy(test);
        moved = true;
        break;
      }
    }

    if (!moved && !world.collidesSphere(new T.Vector3(candidate.x, 1.1, candidate.z), 0.42)) {
      bot.mesh.position.copy(candidate);
      moved = true;
    }

    bot.mesh.lookAt(target.x, bot.mesh.position.y, target.z);
    bot.updateAnimation(dt, moved);
  }

  function botShoot(bot, targetPoint, targetBot, isPlayerTarget, dt) {
    bot.weapon.cooldown = Math.max(0, bot.weapon.cooldown - dt);
    bot.reactionClock = Math.max(0, bot.reactionClock - dt);
    if (bot.weapon.cooldown > 0 || bot.weapon.ammo <= 0 || bot.reactionClock > 0) return;

    const source = bot.headMesh.getWorldPosition(new T.Vector3());
    const aim = targetPoint.clone().sub(source).normalize();
    const spread = match.difficulty.aimSpread;
    aim.x += (Math.random() - 0.5) * spread;
    aim.y += (Math.random() - 0.5) * spread;
    aim.z += (Math.random() - 0.5) * spread;
    aim.normalize();

    bot.weapon.cooldown = 0.44;
    bot.weapon.ammo -= 1;
    bot.reactionClock = bot.reactionDelay;

    if (isPlayerTarget) {
      const miss = Math.random() < 0.48;
      if (!miss) {
        const damage = (11 + Math.random() * 6) * match.difficulty.damageScale;
        applyPlayerDamage(damage, 'Defender', bot.mesh.position);
      }
      addTracer(source, source.clone().addScaledVector(aim, 30), false);
      addImpact(source.clone().addScaledVector(aim, 8), 0xff9b8d);
      return;
    }

    if (targetBot && Math.random() < 0.62) {
      applyDamage(targetBot, 23, bot.team === TEAM.DEFENDER ? 'Defender' : 'Ally', 'pistol');
      addImpact(targetBot.headMesh.getWorldPosition(new T.Vector3()), 0xff9b8d);
    }
    addTracer(source, source.clone().addScaledVector(aim, 28), false);
  }

  function updateBots(dt) {
    const allies = bots.filter((b) => !b.dead && b.team === TEAM.ATTACKER);
    const enemies = bots.filter((b) => !b.dead && b.team === TEAM.DEFENDER);

    for (const bot of bots) {
      if (bot.dead) {
        bot.updateAnimation(dt, false);
        continue;
      }

      const hostile = bot.team === TEAM.DEFENDER
        ? [...allies, ...(player.dead ? [] : [{ isPlayer: true, mesh: { position: player.position.clone() } }])]
        : enemies;

      let nearest = null;
      let nearestDist = Infinity;
      for (const target of hostile) {
        const targetPos = target.mesh.position.clone();
        const d = bot.mesh.position.distanceTo(targetPos);
        if (d < nearestDist && d < bot.visionRange) {
          const start = bot.headMesh.getWorldPosition(new T.Vector3());
          const end = targetPos.clone().add(new T.Vector3(0, 1.2, 0));
          if (world.hasLineOfSight(start, end)) {
            nearest = target;
            nearestDist = d;
          }
        }
      }

      if (nearest) {
        const isPlayerTarget = Boolean(nearest.isPlayer);
        const tPos = nearest.mesh.position.clone();
        if (nearestDist > 9 || (bot.team === TEAM.ATTACKER && Math.random() < match.difficulty.pushBias)) botMove(bot, tPos, dt);
        const shotTargetPos = isPlayerTarget ? camera.position : tPos.clone().add(new T.Vector3(0, 1.1, 0));
        botShoot(bot, shotTargetPos, isPlayerTarget ? null : nearest, isPlayerTarget, dt);
      } else {
        const points = bot.team === TEAM.ATTACKER ? world.patrol.attacker : world.patrol.defender;
        const target = points[bot.patrolIndex % points.length];
        botMove(bot, target, dt);
        if (bot.mesh.position.distanceTo(target) < 1.8) bot.patrolIndex += 1;
        bot.reactionClock = Math.max(bot.reactionClock, bot.reactionDelay * 0.4);
      }

      if (bot.weapon.ammo <= 0) bot.weapon.ammo = WEAPONS.pistol.magSize;
    }
  }

  function attackersAlive() {
    return (!player.dead ? 1 : 0) + bots.filter((b) => !b.dead && b.team === TEAM.ATTACKER).length;
  }

  function defendersAlive() {
    return bots.filter((b) => !b.dead && b.team === TEAM.DEFENDER).length;
  }

  function countInZone(team) {
    let count = 0;
    const center = world.objectiveCenter;
    const radius = world.objectiveRadius;
    if (team === TEAM.ATTACKER && !player.dead && player.position.distanceTo(center) <= radius) count += 1;
    for (const b of bots) {
      if (!b.dead && b.team === team && b.mesh.position.distanceTo(center) <= radius) count += 1;
    }
    return count;
  }

  function updateObjective(dt) {
    const atk = countInZone(TEAM.ATTACKER);
    const def = countInZone(TEAM.DEFENDER);
    if (atk > 0 && def === 0) match.capture = Math.min(100, match.capture + dt * (8 + atk * 2));
    if (def > 0 && atk === 0) match.capture = Math.max(0, match.capture - dt * (7 + def * 1.2));

    world.objectiveMesh.material.opacity = 0.33 + (match.capture / 100) * 0.39;
    world.objectiveMesh.material.color.setHex(match.capture > 70 ? 0x37bb73 : 0x2f6e56);
  }

  function updateViewModel(dt, walkIntensity) {
    const st = viewModel.state;
    const slot = activeWeaponState();
    const def = WEAPONS[slot.id];
    st.recoil = Math.max(0, st.recoil - dt * 4);
    st.switchT = Math.max(0, st.switchT - dt * 3.4);
    st.reloadT = Math.max(0, st.reloadT - (slot.reloading > 0 ? dt / Math.max(def.reloadTime, 0.01) : dt * 2));

    st.swayX = Math.sin(clock.elapsedTime * 7.6) * 0.015 * walkIntensity;
    st.swayY = Math.cos(clock.elapsedTime * 12.8) * 0.013 * walkIntensity;

    viewModel.root.position.x = 0.34 + st.swayX + (st.recoil * 0.02);
    viewModel.root.position.y = -0.38 + st.swayY - (st.recoil * 0.03) + (st.switchT * 0.14);
    viewModel.root.position.z = -0.75 + (st.recoil * 0.06);

    const reloadWave = Math.sin((1 - st.reloadT) * Math.PI);
    const switchWave = Math.sin((1 - st.switchT) * Math.PI);

    viewModel.root.rotation.x = 0.05 - (st.recoil * 0.18) + (reloadWave * 0.35 * (slot.reloading > 0 ? 1 : 0));
    viewModel.root.rotation.y = 0.02 + (switchWave * 0.28 * (st.switchT > 0 ? 1 : 0));
    viewModel.root.rotation.z = 0.02 + (reloadWave * 0.2 * (slot.reloading > 0 ? 1 : 0));

    viewModel.rifle.visible = slot.id === 'rifle';
    viewModel.pistol.visible = slot.id === 'pistol';
  }

  function updatePlayer(dt) {
    updateWeaponTimers(dt);

    if (input.just.Digit1) switchWeapon(0);
    if (input.just.Digit2 && player.loadout.inventory.length > 1) switchWeapon(1);

    const slot = activeWeaponState();
    const def = activeWeaponDef();
    if (input.just.KeyR) doReload(slot, def);

    if (input.mouseLeft && (def.auto || input.just.Mouse0)) shootPlayer();

    const speedScalar = input.keys.ShiftLeft ? 8 : 5.2;
    const moveForward = (input.keys.KeyW ? 1 : 0) - (input.keys.KeyS ? 1 : 0);
    const moveRight = (input.keys.KeyD ? 1 : 0) - (input.keys.KeyA ? 1 : 0);

    const forward = new T.Vector3(Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    const right = new T.Vector3(forward.z * -1, 0, forward.x);
    const walk = new T.Vector3().addScaledVector(forward, moveForward).addScaledVector(right, moveRight);
    const moving = walk.lengthSq() > 0;
    const walkIntensity = moving ? (input.keys.ShiftLeft ? 1.2 : 0.8) : 0;

    if (moving) walk.normalize().multiplyScalar(speedScalar * dt);

    const candidate = player.position.clone();
    candidate.x += walk.x;
    if (!world.collidesSphere(new T.Vector3(candidate.x, 1.1, player.position.z), player.radius)) player.position.x = candidate.x;
    candidate.z = player.position.z + walk.z;
    if (!world.collidesSphere(new T.Vector3(player.position.x, 1.1, candidate.z), player.radius)) player.position.z = candidate.z;

    player.velocityY -= 24 * dt;
    if (player.onGround && input.just.Space) {
      player.velocityY = 8.2;
      player.onGround = false;
      audio.tone(170, 0.05, 'square', 0.08);
    }
    player.position.y += player.velocityY * dt;
    if (player.position.y <= 0) {
      player.position.y = 0;
      player.velocityY = 0;
      player.onGround = true;
    }

    if (moving && player.onGround) {
      player.footstepTimer -= dt;
      if (player.footstepTimer <= 0) {
        audio.footstep(Boolean(input.keys.ShiftLeft));
        player.footstepTimer = input.keys.ShiftLeft ? 0.22 : 0.31;
      }
    } else {
      player.footstepTimer = 0;
    }

    player.recoilPitch = Math.max(0, player.recoilPitch - def.recoilRecover * dt);
    player.recoilYaw *= 0.86;

    const targetFov = slot.id === 'rifle' && input.mouseRight ? 62 : 78;
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 12);
    camera.updateProjectionMatrix();
    ui.crosshair.textContent = targetFov < 78 ? '·' : '+';

    updateViewModel(dt, walkIntensity);
  }

  function buyWeapon(id) {
    const def = WEAPONS[id];
    if (!def) return;
    if (id === 'rifle' && player.credits < def.cost) return;

    if (id === 'rifle' && !player.loadout.inventory.includes('rifle')) {
      player.credits -= def.cost;
      player.loadout.inventory = ['pistol', 'rifle'];
      player.loadout.activeIndex = 1;
    }

    const slot = player.loadout.weapons[id];
    slot.ammo = def.magSize;
    slot.reserve = def.reserve;
    slot.reloading = 0;
    ui.showShop(player.credits);
  }

  function toggleShop(show) {
    if (show) {
      ui.showShop(player.credits);
      document.exitPointerLock();
    } else {
      ui.hideShop();
      if (match.phase === 'buy' || match.phase === 'active') renderer.domElement.requestPointerLock();
    }
  }

  function step(dt) {
    if (!match.started) return;

    if (match.phase === 'buy') {
      match.buyTimer = Math.max(0, match.buyTimer - dt);
      if (match.buyTimer <= 0) {
        match.phase = 'active';
        ui.hideShop();
        renderer.domElement.requestPointerLock();
        pushFeed('Round live');
      }
    }

    if (match.phase === 'active') {
      match.timer -= dt;
      updatePlayer(dt);
      updateBots(dt);
      updateObjective(dt);

      const outcome = evaluateRoundOutcome({
        timer: match.timer,
        capture: match.capture,
        attackersAlive: attackersAlive(),
        defendersAlive: defendersAlive(),
      });
      if (outcome.done) endRound(outcome.winner, outcome.reason);
    }

    if (match.phase === 'roundEnd') {
      match.transitionTimer = Math.max(0, match.transitionTimer - dt);
      if (match.transitionTimer <= 0) nextRound();
    }

    for (const t of tracerPool) t.ttl -= dt;
    for (let i = tracerPool.length - 1; i >= 0; i -= 1) {
      const t = tracerPool[i];
      if (t.ttl <= 0) {
        scene.remove(t.line);
        t.line.geometry.dispose();
        tracerPool.splice(i, 1);
      }
    }

    for (const imp of impactPool) imp.ttl -= dt;
    for (let i = impactPool.length - 1; i >= 0; i -= 1) {
      const imp = impactPool[i];
      if (imp.ttl <= 0) {
        scene.remove(imp.mesh);
        imp.mesh.geometry.dispose();
        imp.mesh.material.dispose();
        impactPool.splice(i, 1);
      }
    }

    muzzle.intensity = Math.max(0, muzzle.intensity - dt * 18);
  }

  function renderHUD() {
    const slot = activeWeaponState();
    const def = WEAPONS[slot.id];
    const phaseInfo = match.phase === 'buy'
      ? `Buy ${match.buyTimer.toFixed(1)}s`
      : match.phase === 'active'
        ? `Round ${Math.ceil(match.timer)}s`
        : match.phase === 'roundEnd'
          ? `Round over: ${match.winnerReason}`
          : match.phase === 'matchOver'
            ? `${match.winner} won`
            : 'Menu';

    const hudText = [
      `HP ${Math.round(player.hp)}  Credits ${player.credits}`,
      `${def.name} ${slot.ammo}/${slot.reserve}${slot.reloading > 0 ? ' (reloading)' : ''}`,
      `Score A:${match.score.attacker} D:${match.score.defender}  Round ${match.round} / BO${(WIN_ROUNDS * 2) - 1}`,
      `Kills ${player.kills}  Difficulty ${match.difficulty.label}  ${phaseInfo}`,
    ].join('\n');

    const objective = `Secure Zone ${match.capture.toFixed(0)}% · Attackers capture, defenders delay`;
    const scoreText = [
      'SCOREBOARD',
      `Round: ${match.round}`,
      `Attackers: ${match.score.attacker}`,
      `Defenders: ${match.score.defender}`,
      `You Kills: ${player.kills}`,
      `Allies alive: ${bots.filter((b) => !b.dead && b.team === TEAM.ATTACKER).length}`,
      `Enemies alive: ${bots.filter((b) => !b.dead && b.team === TEAM.DEFENDER).length}`,
    ].join('\n');

    ui.renderHud(hudText, objective, match.feed, match.phase === 'buy', scoreText, input.showScore);
  }

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, clock.getDelta());
    if (!match.paused) step(dt);

    camera.position.set(player.position.x, player.position.y + player.eyeHeight, player.position.z);
    camera.rotation.y = player.yaw + player.recoilYaw;
    camera.rotation.x = player.pitch - player.recoilPitch;

    renderHUD();
    renderer.render(scene, camera);

    input.just = {};
  }

  function setPaused(paused) {
    if (match.phase === 'matchOver') return;
    match.paused = paused;
    if (paused) ui.showMenu('Paused', true);
    else {
      ui.hideMenu();
      renderer.domElement.requestPointerLock();
    }
  }

  ui.startBtn.addEventListener('click', () => {
    audio.ensure();
    audio.setVolume(Number(ui.audio.value));
    audio.setMuted(ui.mute.checked);
    match.difficulty = DIFFICULTY[ui.difficulty.value] || DIFFICULTY.normal;
    if (!match.started || match.phase === 'matchOver') startMatch();
    else setPaused(false);
  });

  ui.resumeBtn.addEventListener('click', () => {
    audio.ensure();
    setPaused(false);
  });

  ui.closeShop.addEventListener('click', () => toggleShop(false));
  ui.audio.addEventListener('input', () => audio.setVolume(Number(ui.audio.value)));
  ui.mute.addEventListener('change', () => audio.setMuted(ui.mute.checked));

  document.querySelectorAll('[data-buy]').forEach((btn) => {
    btn.addEventListener('click', () => buyWeapon(btn.getAttribute('data-buy')));
  });

  window.addEventListener('keydown', (e) => {
    input.keys[e.code] = true;
    if (!e.repeat) input.just[e.code] = true;

    if (e.code === 'Escape' && match.phase !== 'menu') {
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
      else setPaused(!match.paused);
    }

    if (e.code === 'KeyB' && (match.phase === 'buy' || match.phase === 'active')) {
      const currentlyOpen = !document.getElementById('shop').classList.contains('hidden');
      toggleShop(!currentlyOpen);
    }

    if (e.code === 'Tab') {
      e.preventDefault();
      input.showScore = true;
    }
  });

  window.addEventListener('keyup', (e) => {
    input.keys[e.code] = false;
    if (e.code === 'Tab') input.showScore = false;
  });

  window.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      input.mouseLeft = true;
      input.just.Mouse0 = true;
    }
    if (e.button === 2) input.mouseRight = true;
  });

  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mouseLeft = false;
    if (e.button === 2) input.mouseRight = false;
  });

  window.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== renderer.domElement) return;
    const sensitivity = 0.0019 * Number(ui.sens.value);
    player.yaw -= e.movementX * sensitivity;
    player.pitch -= e.movementY * sensitivity;
    player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch));
  });

  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === renderer.domElement;
    if (!locked && (match.phase === 'active' || match.phase === 'buy') && !document.getElementById('shop').classList.contains('hidden')) return;
    if (!locked && match.started && (match.phase === 'active' || match.phase === 'buy') && !match.paused) setPaused(true);
    if (locked) {
      ui.hideMenu();
      match.paused = false;
    }
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  animate();
}
