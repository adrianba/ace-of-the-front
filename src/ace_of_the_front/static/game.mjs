import { Game, WIDTH, HEIGHT, MAX_HULL, groundHeight, treeAt, clamp } from "./engine.mjs";

export const game = new Game();
const $ = (id) => document.getElementById(id);
const canvas = $("sky");
const ctx = canvas.getContext("2d");
const resolution = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = WIDTH * resolution;
canvas.height = HEIGHT * resolution;
ctx.setTransform(resolution, 0, 0, resolution, 0, 0);
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const keys = new Set();
const particles = [];
let clock = 0;
let flash = 0;
let lastUiState = "";
let announcementTimer = 0;

function readStorage(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

function writeStorage(key, value) {
  try { localStorage.setItem(key, String(value)); } catch { /* Storage is optional. */ }
}

let best = Math.max(0, Number(readStorage("ace-best", 0)) || 0);
let soundEnabled = readStorage("ace-sound", "on") !== "off";
let audio;

function wakeAudio() {
  if (!soundEnabled) return;
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return;
  audio ??= new Audio();
  if (audio.state === "suspended") audio.resume().catch(() => {});
}

function tone(frequency, duration, volume, type = "triangle", end = frequency / 2) {
  if (!soundEnabled || !audio || audio.state !== "running") return;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  const now = audio.currentTime;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, end), now + duration);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  writeStorage("ace-sound", soundEnabled ? "on" : "off");
  $("sound").textContent = `SOUND ${soundEnabled ? "ON" : "OFF"}`;
  $("sound").setAttribute("aria-pressed", String(soundEnabled));
  if (soundEnabled) wakeAudio();
  else if (audio?.state === "running") audio.suspend().catch(() => {});
}

function announce(message) {
  $("announcements").textContent = message;
}

function saveBest() {
  if (game.score > best) {
    best = game.score;
    writeStorage("ace-best", best);
  }
}

function launch() {
  wakeAudio();
  keys.clear();
  if (game.paused) game.togglePause();
  else game.launch();
  canvas.focus({ preventScroll: true });
  canvas.closest(".flight-deck")?.scrollIntoView({ block: "nearest" });
  syncUi();
}

function pause() {
  keys.clear();
  game.togglePause();
  syncUi();
}

$("launch").addEventListener("click", launch);
$("pause").addEventListener("click", () => { pause(); canvas.focus({ preventScroll: true }); });
$("sound").addEventListener("click", () => { toggleSound(); canvas.focus({ preventScroll: true }); });
$("sound").textContent = `SOUND ${soundEnabled ? "ON" : "OFF"}`;
$("sound").setAttribute("aria-pressed", String(soundEnabled));

document.addEventListener("keydown", (event) => {
  const code = event.code;
  if (["Space", "ArrowUp", "ArrowDown", "Enter", "KeyW", "KeyS", "KeyP", "Escape", "KeyM"].includes(code)) {
    if (event.target instanceof HTMLButtonElement && ["Space", "Enter"].includes(code)) return;
    event.preventDefault();
    if (!event.repeat) {
      if (code === "Enter") launch();
      if (code === "KeyP" || code === "Escape") pause();
      if (code === "KeyM") toggleSound();
    }
    keys.add(code);
  }
});
document.addEventListener("keyup", (event) => keys.delete(event.code));
function focusLost() {
  keys.clear();
  if (game.active && !game.paused) {
    game.togglePause();
    syncUi();
  }
}
window.addEventListener("blur", focusLost);
document.addEventListener("visibilitychange", () => { if (document.hidden) focusLost(); });

function burst(x, y, count, colors, speed = 140) {
  count = reducedMotion ? Math.min(count, 5) : count;
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const velocity = 25 + Math.random() * speed;
    const life = 0.25 + Math.random() * 0.65;
    particles.push({
      x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity,
      size: 2 + Math.random() * 5, life, maxLife: life,
      color: colors[i % colors.length],
    });
  }
  if (particles.length > 350) particles.splice(0, particles.length - 350);
}

function consumeEvents() {
  for (const event of game.events.splice(0)) {
    if (event.type === "shot") {
      tone(130, 0.045, 0.025, "sawtooth", 55);
      burst(event.x, event.y, 2, ["#fff1ae"], 40);
    } else if (event.type === "enemyShot") {
      tone(85, 0.065, 0.018, "square", 40);
      burst(event.x, event.y, 3, ["#ffb36b"], 50);
    } else if (event.type === "hit") {
      burst(event.x, event.y, 5, ["#fff2bb", "#e4a95c"], 75);
      tone(230, 0.04, 0.015, "triangle", 110);
    } else if (event.type === "kill" || event.type === "victory") {
      burst(event.x, event.y, event.type === "victory" ? 75 : 28, ["#e8b56b", "#f7e1a0", "#6c7772"], 170);
      tone(95, 0.5, 0.075, "sawtooth", 23);
      if (event.type === "victory") {
        saveBest();
        announce(`Ace defeated. Mission ${game.level} complete. Score ${game.score}.`);
        tone(390, 0.8, 0.045, "triangle", 780);
      }
    } else if (event.type === "damage") {
      flash = reducedMotion ? 0.2 : 0.65;
      burst(event.x, event.y, 16, ["#d58554", "#e3bb75", "#647471"], 140);
      tone(120, 0.3, 0.07, "sawtooth", 25);
      announce(`Hit by ${event.source}. ${game.health} hull remaining.`);
    } else if (event.type === "ace") {
      announce(`Enemy ace approaching: ${game.ace.name}. ${game.ace.tell}`);
      tone(190, 0.8, 0.035, "triangle", 95);
    } else if (event.type === "defeat") {
      saveBest();
      announce("Aircraft lost. Press Enter to retry this mission with full hull.");
    } else if (event.type === "launch") {
      flash = 0;
      particles.length = 0;
      announcementTimer = 4;
      announce(`Mission ${game.level}: ${game.mission}. Survive the patrol, then defeat the ace.`);
    } else if (event.type === "warning") {
      tone(560, 0.09, 0.015, "sine", 480);
    }
  }
}

function syncUi() {
  const uiState = `${game.state}:${game.paused}:${game.level}`;
  if (uiState !== lastUiState) {
    lastUiState = uiState;
    const show = game.paused || !game.active;
    $("overlay").hidden = !show;
    $("briefing-controls").hidden = game.state !== "briefing" || game.paused;
    $("pause").disabled = !game.active;
    $("pause").textContent = game.paused ? "RESUME ▷" : "PAUSE Ⅱ";
    if (game.paused) {
      $("overlay-kicker").textContent = "HOLDING PATTERN";
      $("overlay-title").textContent = "Take a breath, pilot.";
      $("overlay-body").textContent = "Your flight is paused. The sky can wait.";
      $("launch").textContent = "Resume flight →";
      $("overlay-footnote").textContent = "P / ESCAPE TO RESUME · FOCUS LOSS PAUSES AUTOMATICALLY";
      announce("Flight paused.");
    } else if (game.state === "debrief") {
      $("overlay-kicker").textContent = `SORTIE ${String(game.level).padStart(2, "0")} / ACE DEFEATED`;
      $("overlay-title").textContent = "Good flying. Stay sharp.";
      $("overlay-body").textContent = `${game.ace.name} is down. ${game.score.toLocaleString()} points banked. The ground crew will repair two hull points before your next sortie.`;
      $("launch").textContent = "Fly the next sortie →";
      $("overlay-footnote").textContent = `ENTER TO CONTINUE · NEXT: ${game.level + 1 <= 4 ? "A NEW ACE" : "VETERAN PATROL"} · NO LIVES LIMIT`;
    } else if (game.state === "gameover") {
      $("overlay-kicker").textContent = `SORTIE ${String(game.level).padStart(2, "0")} / AIRCRAFT LOST`;
      $("overlay-title").textContent = "The sky teaches quickly.";
      $("overlay-body").textContent = `You scored ${game.score.toLocaleString()}. Retry this mission with a fresh aircraft and ${game.bankedScore.toLocaleString()} banked points. Watch the tells. Keep moving.`;
      $("launch").textContent = "Give it another go →";
      $("overlay-footnote").textContent = "ENTER TO RETRY · FULL HULL · SAME MISSION · UNLIMITED RETRIES";
    }
  }
  $("level").textContent = String(game.level).padStart(2, "0");
  $("mission").textContent = game.mission;
  $("score").textContent = String(game.score).padStart(6, "0");
  $("best").textContent = String(best).padStart(6, "0");
  $("hull").textContent = Array.from({ length: MAX_HULL }, (_, i) => i < game.health ? "▰" : "▱").join(" ");
  $("hull").setAttribute("aria-label", `Hull: ${game.health} of ${MAX_HULL}`);
  $("hull").style.color = game.health <= 2 ? "#ed9e7c" : "#dfba76";
  $("ace-banner").hidden = game.state !== "aceIntro" || game.paused;
  $("ace-name").textContent = game.ace.name;
  $("ace-tell").textContent = game.ace.tell;
  $("boss-meter").hidden = game.state !== "boss" || game.paused;
  if (game.boss) {
    $("boss-label").textContent = `${game.ace.short} / ENEMY ACE`;
    $("boss-hull").value = Math.max(0, game.boss.hp);
    $("boss-hull").max = game.boss.maxHp;
    $("boss-phase").textContent = game.boss.warning ? "BREAK THE LINE" : game.boss.enraged ? "ACE ENRAGED" : "RETURN FIRE";
  }
  const progress = game.state === "briefing" ? 0 : game.time / game.config.duration;
  $("progress-fill").style.width = `${clamp(progress * 100, 0, 100)}%`;
  $("objective").textContent = game.state === "boss" ? `DUEL: ${game.ace.tell.toUpperCase()}`
    : game.state === "debrief" ? "MISSION COMPLETE. YOUR SCORE IS BANKED."
    : game.state === "gameover" ? "A FRESH AIRCRAFT IS READY. TRY AGAIN."
    : "YOUR ORDERS: SURVIVE THE PATROL. DEFEAT THE ACE.";
  $("countdown").textContent = game.state === "boss" ? `ACE HULL ${Math.max(0, game.boss.hp)} / ${game.boss.maxHp}`
    : game.state === "playing" ? `ACE IN ${Math.max(0, Math.ceil(game.config.duration - game.time))}s`
    : `WESTERN FRONT / SECTOR ${String(game.level).padStart(2, "0")}`;
  $("flight-status").textContent = game.paused ? "HOLDING PATTERN"
    : game.state === "playing" ? `PATROL / ALT ${Math.round((HEIGHT - game.player.y) * 5)} FT`
    : game.state === "boss" ? "KEEP YOUR NERVE"
    : game.state === "aceIntro" ? "CLEAR AIR. NO ESCORTS."
    : "AWAITING YOUR ORDERS";
}

function ellipse(x, y, rx, ry, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function cloud(x, y, size, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ellipse(x, y, size * 0.9, size * 0.18, "#f7f1d8");
  ellipse(x - size * 0.3, y - size * 0.12, size * 0.36, size * 0.26, "#f7f1d8");
  ellipse(x + size * 0.18, y - size * 0.2, size * 0.45, size * 0.33, "#f7f1d8");
  ctx.restore();
}

function hillLayer(base, amplitude, frequency, scroll, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, HEIGHT);
  for (let x = 0; x <= WIDTH + 8; x += 8) {
    ctx.lineTo(x, base + Math.sin((x + scroll) * frequency) * amplitude
      + Math.cos((x + scroll) * frequency * 1.8) * amplitude * 0.4);
  }
  ctx.lineTo(WIDTH, HEIGHT);
  ctx.fill();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, "#abc9cc");
  gradient.addColorStop(0.6, "#d4d8c0");
  gradient.addColorStop(1, "#e1cfa0");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const sun = ctx.createRadialGradient(840, 122, 8, 840, 122, 160);
  sun.addColorStop(0, "#fff2c6bb");
  sun.addColorStop(1, "#fff2c600");
  ctx.fillStyle = sun;
  ctx.fillRect(650, 0, 390, 320);
  ellipse(840, 122, 39, 39, "#f7e7b6aa");
  for (let i = 0; i < 9; i += 1) {
    const x = ((i * 197 + 70 - game.scroll * 0.13 - clock * 2) % (WIDTH + 280) + WIDTH + 280) % (WIDTH + 280) - 140;
    cloud(x, 64 + ((i * 83) % 205), 60 + (i % 3) * 24, 0.27 + (i % 2) * 0.12);
  }
  // Tiny silhouettes give scale without introducing extra collision hazards.
  ctx.strokeStyle = "#526c7060";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 5; i += 1) {
    const x = ((680 + i * 31 - game.scroll * 0.08) % 1250 + 1250) % 1250;
    const y = 282 + Math.sin(i * 5) * 15;
    ctx.beginPath();
    ctx.moveTo(x - 5, y + 2);
    ctx.quadraticCurveTo(x - 3, y - 3, x, y);
    ctx.quadraticCurveTo(x + 3, y - 3, x + 5, y + 2);
    ctx.stroke();
  }
  hillLayer(427, 28, 0.004, game.scroll * 0.18, "#8caaa0");
  hillLayer(461, 24, 0.006, game.scroll * 0.4, "#779584");
  hillLayer(498, 18, 0.008, game.scroll * 0.65, "#637e69");
  ctx.fillStyle = "#465f49";
  ctx.beginPath();
  ctx.moveTo(0, HEIGHT);
  for (let x = 0; x <= WIDTH + 5; x += 5) ctx.lineTo(x, groundHeight(x + game.scroll));
  ctx.lineTo(WIDTH, HEIGHT);
  ctx.fill();
  ctx.strokeStyle = "#a9b07a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= WIDTH + 5; x += 5) {
    const y = groundHeight(x + game.scroll);
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  const start = Math.floor(game.scroll / 155) - 1;
  for (let i = start; i < start + 10; i += 1) {
    const tree = treeAt(i);
    const x = tree.x - game.scroll;
    ctx.fillStyle = "#394e3d";
    ctx.fillRect(x - 3, tree.ground - 22, 6, 25);
    ctx.beginPath();
    ctx.moveTo(x, tree.ground - tree.height);
    ctx.lineTo(x + 14, tree.ground - tree.height * 0.45);
    ctx.lineTo(x + 9, tree.ground - tree.height * 0.45);
    ctx.lineTo(x + 23, tree.ground - 8);
    ctx.lineTo(x - 23, tree.ground - 8);
    ctx.lineTo(x - 9, tree.ground - tree.height * 0.45);
    ctx.lineTo(x - 14, tree.ground - tree.height * 0.45);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? "#334e42" : "#3b5745";
    ctx.fill();
    ctx.fillStyle = "#69806488";
    ctx.beginPath();
    ctx.moveTo(x, tree.ground - tree.height + 5);
    ctx.lineTo(x - 11, tree.ground - tree.height * 0.45);
    ctx.lineTo(x, tree.ground - tree.height * 0.55);
    ctx.fill();
  }
  hillLayer(603, 10, 0.012, game.scroll * 1.1, "#2c443a");
}

function drawBalloon(balloon) {
  const { x, y } = balloon;
  ctx.strokeStyle = "#56645e88";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 23, y + 17);
  ctx.lineTo(x - 7, y + 46);
  ctx.lineTo(x + 18, groundHeight(x + game.scroll + 18));
  ctx.moveTo(x + 22, y + 17);
  ctx.lineTo(x - 7, y + 46);
  ctx.stroke();
  const shade = ctx.createLinearGradient(x, y - 22, x, y + 25);
  shade.addColorStop(0, "#87928a");
  shade.addColorStop(0.48, "#a9ada0");
  shade.addColorStop(1, "#5d706b");
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.ellipse(x, y, 46, 24, -0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#74827a";
  ctx.beginPath();
  ctx.moveTo(x + 29, y - 13);
  ctx.lineTo(x + 54, y - 28);
  ctx.lineTo(x + 47, y - 1);
  ctx.moveTo(x + 31, y + 11);
  ctx.lineTo(x + 51, y + 26);
  ctx.lineTo(x + 47, y + 1);
  ctx.fill();
  ctx.strokeStyle = "#556c6466";
  ctx.beginPath();
  ctx.ellipse(x - 6, y, 19, 23, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#485e57";
  ctx.fillRect(x - 12, y + 38, 11, 6);
  ctx.fillStyle = "#3e514f";
  ctx.fillRect(x + 8, y - 9, 5, 18);
  ctx.fillRect(x + 2, y - 3, 17, 5);
}

function drawPlane(x, y, { british = false, ace = false, armored = false, tilt = 0, invulnerable = false } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(british ? 1 : -1, 1);
  const scale = ace ? 1.25 : british ? 1 : 0.94;
  ctx.scale(scale, scale);
  if (invulnerable) ctx.globalAlpha = 0.48 + Math.sin(clock * 28) * 0.2;
  const body = british ? "#657453" : ace ? game.ace.color : armored ? "#767f76" : "#998d72";
  const wing = british ? "#a4a171" : ace ? game.ace.color : "#b7ad8a";
  ctx.fillStyle = "#253c3c";
  ctx.beginPath();
  ctx.moveTo(-26, 0);
  ctx.lineTo(-34, -16);
  ctx.lineTo(-24, -16);
  ctx.lineTo(-17, 0);
  ctx.fill();
  ellipse(-26, 5, 13, 3, body);
  ctx.strokeStyle = "#38463c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-6, 12); ctx.lineTo(1, 21); ctx.lineTo(18, 21); ctx.lineTo(12, 8);
  ctx.stroke();
  ellipse(1, 21, 4, 4, "#2d3831");
  ellipse(18, 21, 4, 4, "#2d3831");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-34, 1);
  ctx.lineTo(-6, -6);
  ctx.quadraticCurveTo(23, -10, 31, -2);
  ctx.lineTo(30, 7);
  ctx.quadraticCurveTo(10, 13, -7, 7);
  ctx.closePath();
  ctx.fill();
  ellipse(-2, -6, 8, 4, "#263734");
  ellipse(-3, -9, 4, 5, "#4e493c");
  ctx.fillStyle = "#be8b57";
  ctx.fillRect(-6, -9, 5, 3);
  ctx.strokeStyle = "#4b5142";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-15, -16); ctx.lineTo(-9, 11);
  ctx.moveTo(18, -16); ctx.lineTo(12, 11);
  ctx.moveTo(-15, -16); ctx.lineTo(12, 11);
  ctx.stroke();
  ctx.fillStyle = wing;
  ctx.fillRect(-23, -18, 51, 5);
  ctx.fillRect(-21, 9, 47, 4);
  ctx.fillStyle = "#e0d1a588";
  ctx.fillRect(-23, -18, 51, 1);
  ctx.fillRect(-21, 9, 47, 1);
  ctx.fillStyle = "#b8b59c";
  ctx.fillRect(27, -5, 7, 14);
  ctx.strokeStyle = "#33423c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  const prop = Math.sin(clock * 75) * 19;
  ctx.moveTo(36, -prop); ctx.lineTo(36, prop);
  ctx.stroke();
  if (british) {
    ellipse(-16, 1, 5.5, 5.5, "#355b75");
    ellipse(-16, 1, 3.8, 3.8, "#e5e0c8");
    ellipse(-16, 1, 2.2, 2.2, "#a9493c");
  } else {
    ctx.fillStyle = "#e5dfc7";
    ctx.fillRect(-20, -5, 12, 12);
    ctx.fillStyle = "#343e37";
    ctx.fillRect(-16, -4, 4, 10);
    ctx.fillRect(-19, -1, 10, 4);
  }
  ctx.restore();
}

function drawWarning() {
  const warning = game.boss?.warning;
  if (!warning || game.state !== "boss") return;
  ctx.save();
  const charge = 1 - warning.remaining / warning.duration;
  ctx.strokeStyle = `rgba(154, 87, 30, ${0.38 + charge * 0.48})`;
  ctx.lineWidth = 1.5 + charge;
  ctx.setLineDash([9, 7]);
  ctx.lineDashOffset = -clock * 20;
  for (const angle of warning.angles) {
    ctx.beginPath();
    ctx.moveTo(warning.x, warning.y);
    ctx.lineTo(warning.x + Math.cos(angle) * 1400, warning.y + Math.sin(angle) * 1400);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.strokeStyle = "#e6b56c";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(warning.x, warning.y, 15, -Math.PI / 2, -Math.PI / 2 + charge * Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function draw(dt) {
  drawBackground();
  for (const balloon of game.balloons) drawBalloon(balloon);
  drawWarning();
  for (const enemy of game.enemies) drawPlane(enemy.x, enemy.y, { armored: enemy.armored, tilt: Math.cos(enemy.age * 1.6 + enemy.phase) * -0.08 });
  if (game.boss && ["aceIntro", "boss"].includes(game.state)) {
    drawPlane(game.boss.x, game.boss.y, { ace: true, tilt: game.boss.warning ? 0 : Math.cos(game.boss.age) * 0.09 });
  }
  if (game.state !== "gameover") {
    drawPlane(game.player.x, game.player.y, {
      british: true, tilt: game.player.tilt,
      invulnerable: game.active && game.player.invulnerable > 0,
    });
  }
  for (const bullet of game.bullets) {
    ctx.strokeStyle = bullet.friendly ? "#fff2ac" : "#a9402b";
    ctx.lineWidth = bullet.friendly ? 3 : bullet.ace ? 5 : 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(bullet.x - Math.sign(bullet.vx) * 8, bullet.y - bullet.vy * 0.015);
    ctx.lineTo(bullet.x, bullet.y);
    ctx.stroke();
    if (!bullet.friendly) ellipse(bullet.x, bullet.y, 2, 2, "#ffd49b");
  }
  ctx.lineCap = "butt";
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const particle = particles[i];
    if (!game.paused) {
      particle.life -= dt;
      particle.x += (particle.vx - 40) * dt;
      particle.y += particle.vy * dt;
      particle.vy += 45 * dt;
    }
    if (particle.life <= 0) { particles.splice(i, 1); continue; }
    ctx.globalAlpha = particle.life / particle.maxLife;
    ellipse(particle.x, particle.y, particle.size, particle.size, particle.color);
  }
  ctx.globalAlpha = 1;
  if (announcementTimer > 0 && game.state === "playing" && !game.paused) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, announcementTimer);
    ctx.textAlign = "center";
    ctx.fillStyle = "#314c4a";
    ctx.font = "12px monospace";
    ctx.fillText(`SORTIE ${String(game.level).padStart(2, "0")}  /  ${game.mission.toUpperCase()}`, WIDTH / 2, 58);
    ctx.font = "11px monospace";
    ctx.fillText("KEEP LOW OF THE BALLOONS. HIGH OF THE TREES.", WIDTH / 2, 79);
    ctx.restore();
  }
  if (!game.paused) {
    announcementTimer = Math.max(0, announcementTimer - dt);
    flash = Math.max(0, flash - dt * 2);
  }
  $("damage-flash").style.opacity = flash;
}

let previousTime;
let accumulator = 0;
function frame(timestamp) {
  const dt = Math.min((timestamp - (previousTime ?? timestamp)) / 1000, 0.1);
  previousTime = timestamp;
  if (!game.paused) clock += dt;
  accumulator += dt;
  while (accumulator >= 1 / 120) {
    game.step(1 / 120, {
      up: keys.has("ArrowUp") || keys.has("KeyW"),
      down: keys.has("ArrowDown") || keys.has("KeyS"),
      fire: keys.has("Space"),
    });
    accumulator -= 1 / 120;
  }
  consumeEvents();
  syncUi();
  draw(dt);
  requestAnimationFrame(frame);
}
syncUi();
requestAnimationFrame(frame);
