export function createUI() {
  const menu = document.getElementById('menu');
  const shop = document.getElementById('shop');
  const startBtn = document.getElementById('startBtn');
  const resumeBtn = document.getElementById('resumeBtn');
  const closeShop = document.getElementById('closeShop');
  const sens = document.getElementById('sens');
  const sensVal = document.getElementById('sensVal');
  const audio = document.getElementById('audio');
  const audioVal = document.getElementById('audioVal');
  const mute = document.getElementById('mute');
  const difficulty = document.getElementById('difficulty');
  const stats = document.getElementById('stats');
  const objective = document.getElementById('objective');
  const killfeed = document.getElementById('killfeed');
  const creditsLabel = document.getElementById('creditsLabel');
  const crosshair = document.getElementById('crosshair');
  const hit = document.getElementById('hit');
  const headshot = document.getElementById('headshot');
  const damage = document.getElementById('damage');
  const damageArrow = document.getElementById('damageArrow');
  const shopHint = document.getElementById('shopHint');
  const scoreboard = document.getElementById('scoreboard');
  const scoreboardText = document.getElementById('scoreboardText');

  function updateSettingsLabels() {
    sensVal.textContent = Number(sens.value).toFixed(2);
    audioVal.textContent = `${Math.round(Number(audio.value) * 100)}%`;
  }

  updateSettingsLabels();
  sens.addEventListener('input', updateSettingsLabels);
  audio.addEventListener('input', updateSettingsLabels);

  function showMenu(title, canResume) {
    menu.classList.remove('hidden');
    menu.querySelector('h1').textContent = title;
    resumeBtn.classList.toggle('hidden', !canResume);
  }

  function hideMenu() {
    menu.classList.add('hidden');
  }

  function showShop(credits) {
    creditsLabel.textContent = `Credits: ${credits}`;
    shop.classList.remove('hidden');
  }

  function hideShop() {
    shop.classList.add('hidden');
  }

  function renderHud(lines, objectiveText, feed, showBuyHint, scoreText, scoreboardOpen) {
    stats.textContent = lines;
    objective.textContent = objectiveText;
    killfeed.innerHTML = '';
    for (const line of feed.slice(0, 6)) {
      const el = document.createElement('span');
      el.textContent = line;
      killfeed.appendChild(el);
    }
    shopHint.classList.toggle('hidden', !showBuyHint);
    scoreboardText.textContent = scoreText;
    scoreboard.style.display = scoreboardOpen ? 'block' : 'none';
  }

  function pulseHitmarker(isHeadshot = false) {
    hit.style.opacity = '1';
    setTimeout(() => { hit.style.opacity = '0'; }, 100);
    if (isHeadshot) {
      headshot.style.opacity = '1';
      setTimeout(() => { headshot.style.opacity = '0'; }, 180);
    }
  }

  function pulseDamage(angle) {
    damage.style.opacity = '1';
    damageArrow.style.transform = `rotate(${angle}rad)`;
    setTimeout(() => { damage.style.opacity = '0'; }, 160);
  }

  return {
    startBtn,
    resumeBtn,
    closeShop,
    sens,
    audio,
    mute,
    difficulty,
    crosshair,
    showMenu,
    hideMenu,
    showShop,
    hideShop,
    renderHud,
    pulseHitmarker,
    pulseDamage,
  };
}
