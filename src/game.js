import * as T from 'three';
import { AudioBus } from './audio.js';
import { Bot, initLoadout } from './entities.js';
import { BUY_TIME, ROUND_TIME, TEAM, WEAPONS, WIN_ROUNDS } from './constants.js';
import { createUI } from './ui.js';
import { createWorld } from './world.js';

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

  const world = createWorld(scene);
  const clock = new T.Clock();
  const raycaster = new T.Raycaster();

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
  };

  const input = {
    keys: {},
    just: {},
    mouseLeft: false,
    mouseRight: false,
  };

  const match = {
    started: false,
    pointerWanted: false,
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
  };

  const bots = [];
  const tracerPool = [];
  const tracerMaterialAlly = new T.LineBasicMaterial({ color: 0x88bbff, transparent: true, opacity: 0.9 });
  const tracerMaterialEnemy = new T.LineBasicMaterial({ color: 0xff9988, transparent: true, opacity: 0.9 });
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

  function addTracer(a, b, allySide) {
    const geom = new T.BufferGeometry().setFromPoints([a.clone(), b.clone()]);
    const line = new T.Line(geom, allySide ? tracerMaterialAlly : tracerMaterialEnemy);
    scene.add(line);
    tracerPool.push({ line, ttl: 0.09 });
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
      audio.tone(280, 0.1, 'square', 0.18);
    }
  }

  function applyPlayerDamage(amount, source) {
    if (player.dead || match.phase !== 'active') return;
    player.hp = Math.max(0, player.hp - amount);
    if (player.hp <= 0) {
      player.dead = true;
      pushFeed(`${source} eliminated You`);
      audio.tone(90, 0.2, 'sawtooth', 0.22);
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
    const enemies = bots
      .filter((b) => b.team !== player.team && !b.dead)
      .flatMap((b) => [b.bodyMesh, b.headMesh]);
    const hit = raycaster.intersectObjects(enemies, false)[0];

    let targetPos = origin.clone().addScaledVector(dir, 60);
    if (hit) {
      const bot = hit.object.userData.bot;
      const part = hit.object.userData.hitPart;
      const dmg = part === 'head' ? def.headDamage : def.bodyDamage;
      applyDamage(bot, dmg, 'You', slot.id);
      targetPos = hit.point;
      ui.pulseHitmarker();
      audio.tone(part === 'head' ? 520 : 420, 0.06, 'triangle', 0.16);
    } else {
      audio.tone(190, 0.05, 'triangle', 0.12);
    }

    addTracer(origin, targetPos, true);
    camera.rotation.x = Math.max(-1.4, camera.rotation.x - def.recoil);
    muzzle.intensity = 2.4;
  }

  function doReload(slot, def) {
    if (slot.reloading > 0 || slot.ammo >= def.magSize || slot.reserve <= 0) return;
    slot.reloading = def.reloadTime;
    audio.tone(150, 0.08, 'square', 0.1);
  }

  function updateWeaponTimers(dt) {
    for (const id of ['pistol', 'rifle']) {
      const slot = player.loadout.weapons[id];
      slot.cooldown = Math.max(0, slot.cooldown - dt);
      if (slot.reloading > 0) {
        slot.reloading = Math.max(0, slot.reloading - dt);
        if (slot.reloading === 0) {
          const def = WEAPONS[slot.id];
          const need = Math.min(def.magSize - slot.ammo, slot.reserve);
          slot.reserve -= need;
          slot.ammo += need;
          audio.tone(250, 0.07, 'square', 0.09);
        }
      }
    }
  }

  function resetRoundState() {
    for (const b of [...bots]) removeBot(b);
    player.position.copy(world.spawn.player).setY(0);
    player.velocityY = 0;
    player.onGround = true;
    player.hp = 100;
    player.dead = false;
    player.kills = 0;
    player.loadout = initLoadout(player.loadout.inventory.includes('rifle') ? 'rifle' : 'pistol');

    for (const pos of world.spawn.allies) {
      bots.push(new Bot(scene, TEAM.ATTACKER, pos, 0x5e87d6, world.patrol.attacker));
    }
    for (const pos of world.spawn.enemies) {
      bots.push(new Bot(scene, TEAM.DEFENDER, pos, 0xc5645f, world.patrol.defender));
    }

    match.capture = 0;
    match.timer = ROUND_TIME;
    match.buyTimer = BUY_TIME;
    match.phase = 'buy';
    ui.showShop(player.credits);
    ui.crosshair.textContent = '+';
    pushFeed(`Round ${match.round} started: buy phase`);
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
    match.pointerWanted = true;
    renderer.domElement.requestPointerLock();
    ui.hideMenu();
  }

  function nextRound() {
    if (match.score.attacker >= WIN_ROUNDS || match.score.defender >= WIN_ROUNDS) {
      const victor = match.score.attacker > match.score.defender ? 'Attackers' : 'Defenders';
      match.phase = 'matchOver';
      match.winner = victor;
      ui.showMenu(`${victor} win the operation`, false);
      return;
    }
    match.round += 1;
    resetRoundState();
    match.pointerWanted = true;
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
    audio.tone(winner === TEAM.ATTACKER ? 360 : 140, 0.14, 'sawtooth', 0.2);
    setTimeout(nextRound, 3400);
  }

  function botMove(bot, target, dt) {
    const to = target.clone().sub(bot.mesh.position);
    to.y = 0;
    const len = to.length();
    if (len < 0.2) return;
    to.normalize();
    const step = bot.moveSpeed * dt;
    const next = bot.mesh.position.clone().addScaledVector(to, step);
    if (!world.collidesSphere(new T.Vector3(next.x, 1.1, next.z), 0.42)) bot.mesh.position.copy(next);
    bot.mesh.lookAt(target.x, bot.mesh.position.y, target.z);
  }

  function botShoot(bot, targetPoint, targetBot, isPlayerTarget, dt) {
    bot.weapon.cooldown = Math.max(0, bot.weapon.cooldown - dt);
    if (bot.weapon.cooldown > 0 || bot.weapon.ammo <= 0) return;

    const source = bot.headMesh.getWorldPosition(new T.Vector3());
    const aim = targetPoint.clone().sub(source).normalize();
    aim.x += (Math.random() - 0.5) * 0.03;
    aim.y += (Math.random() - 0.5) * 0.03;
    aim.z += (Math.random() - 0.5) * 0.03;
    aim.normalize();

    bot.weapon.cooldown = 0.44;
    bot.weapon.ammo -= 1;

    if (isPlayerTarget) {
      const miss = Math.random() < 0.45;
      if (!miss) applyPlayerDamage(12 + Math.random() * 7, bot.team === TEAM.DEFENDER ? 'Defender' : 'Ally');
      addTracer(source, source.clone().addScaledVector(aim, 30), false);
      return;
    }

    if (targetBot && Math.random() < 0.65) {
      applyDamage(targetBot, 25, bot.team === TEAM.DEFENDER ? 'Defender' : 'Ally', 'pistol');
    }
    addTracer(source, source.clone().addScaledVector(aim, 28), false);
  }

  function updateBots(dt) {
    const allies = bots.filter((b) => !b.dead && b.team === TEAM.ATTACKER);
    const enemies = bots.filter((b) => !b.dead && b.team === TEAM.DEFENDER);

    for (const bot of bots) {
      if (bot.dead) continue;
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
        if (nearestDist > 9) botMove(bot, tPos, dt);
        const shotTargetPos = isPlayerTarget ? camera.position : tPos.clone().add(new T.Vector3(0, 1.1, 0));
        botShoot(bot, shotTargetPos, isPlayerTarget ? null : nearest, isPlayerTarget, dt);
      } else {
        const points = bot.team === TEAM.ATTACKER ? world.patrol.attacker : world.patrol.defender;
        const target = points[bot.patrolIndex % points.length];
        botMove(bot, target, dt);
        if (bot.mesh.position.distanceTo(target) < 1.8) bot.patrolIndex += 1;
      }

      if (bot.weapon.ammo <= 0) {
        bot.weapon.ammo = WEAPONS.pistol.magSize;
      }
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
    if (atk > 0 && def === 0) match.capture = Math.min(100, match.capture + dt * (9 + atk * 2));
    if (def > 0 && atk === 0) match.capture = Math.max(0, match.capture - dt * (8 + def * 1.2));

    world.objectiveMesh.material.opacity = 0.32 + (match.capture / 100) * 0.38;
    world.objectiveMesh.material.color.setHex(match.capture > 70 ? 0x37bb73 : 0x295f4e);

    if (match.capture >= 100) endRound(TEAM.ATTACKER, 'zone secured');
  }

  function updatePlayer(dt) {
    updateWeaponTimers(dt);
    const speed = (input.keys.ShiftLeft ? 8 : 5.2) * dt;

    if (input.just.Digit1) player.loadout.activeIndex = 0;
    if (input.just.Digit2 && player.loadout.inventory.length > 1) player.loadout.activeIndex = 1;

    const slot = activeWeaponState();
    const def = activeWeaponDef();

    if (input.just.KeyR) doReload(slot, def);

    if (input.mouseLeft && (def.auto || input.just.Mouse0)) shootPlayer();

    const moveForward = (input.keys.KeyW ? 1 : 0) - (input.keys.KeyS ? 1 : 0);
    const moveRight = (input.keys.KeyD ? 1 : 0) - (input.keys.KeyA ? 1 : 0);

    const forward = new T.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw) * -1);
    const right = new T.Vector3(forward.z * -1, 0, forward.x);
    const walk = new T.Vector3();
    walk.addScaledVector(forward, moveForward);
    walk.addScaledVector(right, moveRight);
    if (walk.lengthSq() > 0) walk.normalize().multiplyScalar(speed);

    const candidate = player.position.clone();
    candidate.x += walk.x;
    if (!world.collidesSphere(new T.Vector3(candidate.x, 1.1, player.position.z), player.radius)) player.position.x = candidate.x;
    candidate.z = player.position.z + walk.z;
    if (!world.collidesSphere(new T.Vector3(player.position.x, 1.1, candidate.z), player.radius)) player.position.z = candidate.z;

    player.velocityY -= 24 * dt;
    if (player.onGround && input.just.Space) {
      player.velocityY = 8.2;
      player.onGround = false;
      audio.tone(180, 0.05, 'square', 0.08);
    }
    player.position.y += player.velocityY * dt;
    if (player.position.y <= 0) {
      player.position.y = 0;
      player.velocityY = 0;
      player.onGround = true;
    }

    const targetFov = activeWeaponState().id === 'rifle' && input.mouseRight ? 62 : 78;
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 12);
    camera.updateProjectionMatrix();
    ui.crosshair.textContent = targetFov < 78 ? '·' : '+';
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
      if (match.phase === 'buy' || match.phase === 'active') {
        match.pointerWanted = true;
        renderer.domElement.requestPointerLock();
      }
    }
  }

  function step(dt) {
    if (!match.started) return;

    if (match.phase === 'buy') {
      match.buyTimer = Math.max(0, match.buyTimer - dt);
      if (match.buyTimer <= 0) {
        match.phase = 'active';
        ui.hideShop();
        match.pointerWanted = true;
        renderer.domElement.requestPointerLock();
      }
    }

    if (match.phase === 'active') {
      match.timer -= dt;
      if (match.timer <= 0) endRound(TEAM.DEFENDER, 'timer expired');

      updatePlayer(dt);
      updateBots(dt);
      updateObjective(dt);

      if (defendersAlive() <= 0) endRound(TEAM.ATTACKER, 'defenders eliminated');
      if (attackersAlive() <= 0) endRound(TEAM.DEFENDER, 'attackers eliminated');
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
      `Score A:${match.score.attacker} D:${match.score.defender}   Round ${match.round} / BO${(WIN_ROUNDS * 2) - 1}`,
      `Kills ${player.kills}   ${phaseInfo}`,
    ].join('\n');

    const objective = `Secure Zone ${match.capture.toFixed(0)}% · Attackers capture, defenders delay`;
    ui.renderHud(hudText, objective, match.feed, match.phase === 'buy');
  }

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, clock.getDelta());
    if (!match.paused) step(dt);

    camera.position.set(player.position.x, player.position.y + player.eyeHeight, player.position.z);
    camera.rotation.y = player.yaw;
    camera.rotation.x = player.pitch;

    renderHUD();
    renderer.render(scene, camera);

    input.just = {};
  }

  function setPaused(paused) {
    if (match.phase === 'matchOver') return;
    match.paused = paused;
    if (paused) {
      ui.showMenu('Paused', true);
    } else {
      ui.hideMenu();
      match.pointerWanted = true;
      renderer.domElement.requestPointerLock();
    }
  }

  ui.startBtn.addEventListener('click', () => {
    audio.ensure();
    audio.setVolume(Number(ui.audio.value));
    if (!match.started || match.phase === 'matchOver') startMatch();
    else setPaused(false);
  });

  ui.resumeBtn.addEventListener('click', () => {
    audio.ensure();
    setPaused(false);
  });

  ui.closeShop.addEventListener('click', () => toggleShop(false));
  ui.audio.addEventListener('input', () => audio.setVolume(Number(ui.audio.value)));

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
  });

  window.addEventListener('keyup', (e) => {
    input.keys[e.code] = false;
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
    if (!locked && match.started && (match.phase === 'active' || match.phase === 'buy') && !match.paused) {
      setPaused(true);
    }
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
