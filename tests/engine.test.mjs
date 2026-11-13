import test from "node:test";
import assert from "node:assert/strict";
import { Game, HEIGHT, MAX_HULL, difficulty, repairNote, seededRandom } from "../src/ace_of_the_front/static/engine.mjs";

test("debrief repair note matches the hull actually restored", () => {
  assert.match(repairNote(MAX_HULL), /no repairs needed/);
  assert.match(repairNote(MAX_HULL - 1), /fully repair/);
  assert.match(repairNote(MAX_HULL - 2), /fully repair/);
  assert.match(repairNote(MAX_HULL - 3), /repair 2 hull points/);
});

function advance(game, seconds, input = {}) {
  for (let i = 0; i < Math.ceil(seconds * 120); i += 1) {
    game.step(1 / 120, typeof input === "function" ? input(game) : input);
  }
}

function quietGame() {
  const game = new Game(seededRandom());
  game.launch();
  game.enemyTimer = 1000;
  game.balloonTimer = 1000;
  game.config.duration = 1000;
  game.player.invulnerable = 0;
  return game;
}

test("altitude is bounded, terrain damages once during the grace period, and pause freezes play", () => {
  const game = quietGame();
  advance(game, 2, { up: true });
  assert.equal(game.player.y, 32);
  assert.equal(game.health, 5);
  advance(game, 1.7, { down: true });
  assert.equal(game.health, 4);
  assert.ok(game.player.y < HEIGHT - 80);
  game.togglePause();
  const snapshot = JSON.stringify(game);
  advance(game, 2, { down: true, fire: true });
  assert.equal(JSON.stringify(game), snapshot);
});

test("holding fire destroys armored aircraft and awards points only once", () => {
  const game = quietGame();
  game.spawnEnemy();
  Object.assign(game.enemies[0], { x: 260, y: 310, baseY: 310, phase: 0, hp: 2, armored: true, fireTimer: 100 });
  advance(game, 0.3, { fire: true });
  assert.equal(game.enemies.length, 0);
  assert.equal(game.score, 175);
  advance(game, 0.5, { fire: true });
  assert.equal(game.score, 175);
});

test("balloon bodies damage the player; cables do not, and balloons stop friendly fire", () => {
  const game = quietGame();
  game.balloons.push({ x: 180, y: 130 });
  advance(game, 0.05);
  assert.equal(game.health, 5);
  game.player.y = 130;
  game.balloons[0].x = 180;
  advance(game, 0.05);
  assert.equal(game.health, 4);

  const blocked = quietGame();
  blocked.balloons.push({ x: 260, y: 310 });
  advance(blocked, 0.06, { fire: true });
  assert.equal(blocked.bullets.filter((bullet) => bullet.friendly).length, 0);
});

test("enemy gunfire and aircraft collisions respect the damage grace period", () => {
  const game = quietGame();
  const bullet = { x: 185, y: 310, vx: -200, vy: 0, friendly: false };
  game.bullets.push({ ...bullet }, { ...bullet });
  advance(game, 0.02);
  assert.equal(game.health, 4);
  assert.equal(game.bullets.length, 0);
  game.player.invulnerable = 0;
  game.spawnEnemy();
  Object.assign(game.enemies[0], { x: 180, baseY: 310, phase: 0 });
  advance(game, 0.02);
  assert.equal(game.health, 3);
  assert.equal(game.enemies.length, 0);
});

test("patrol transition clears hazards and gives an ace introduction before attacks", () => {
  const game = quietGame();
  game.config.duration = 0.05;
  game.balloons.push({ x: 700, y: 130 });
  game.spawnEnemy();
  advance(game, 0.06);
  assert.equal(game.state, "aceIntro");
  assert.equal(game.enemies.length, 0);
  assert.equal(game.balloons.length, 0);
  assert.equal(game.bullets.length, 0);
  advance(game, 2.85);
  assert.equal(game.state, "boss");
  assert.equal(game.bullets.length, 0);
});

for (const [level, count] of [[1, 1], [2, 3], [3, 3], [4, 5]]) {
  test(`ace ${level} advertises its locked trajectory and fires its signature pattern`, () => {
    const game = quietGame();
    game.level = level;
    game.config = difficulty(level);
    game.beginAce();
    game.state = "boss";
    game.boss.x = 865;
    game.boss.y = 300;
    game.prepareAttack();
    const warning = structuredClone(game.boss.warning);
    game.player.y = 100;
    advance(game, 0.7);
    assert.equal(game.bullets.length, 0, "no firing before the tell expires");
    assert.equal(game.boss.x, 865);
    assert.equal(game.boss.y, 300);
    advance(game, 0.7);
    assert.equal(game.bullets.length, count);
    for (const bullet of game.bullets) {
      const speed = Math.hypot(bullet.vx, bullet.vy);
      assert.ok(warning.angles.some((angle) =>
        Math.abs(Math.cos(angle) - bullet.vx / speed) < 1e-10
        && Math.abs(Math.sin(angle) - bullet.vy / speed) < 1e-10));
    }
    if (level === 4) {
      game.prepareAttack();
      assert.equal(game.boss.warning.angles.length, 1, "Baron alternates fan and aimed shots");
    }
  });
}

test("winning banks score and repairs the next sortie; defeat retries only the current mission", () => {
  const game = quietGame();
  game.score = 200;
  game.health = 2;
  game.beginAce();
  game.state = "boss";
  game.boss.hp = 1;
  game.boss.x = 500;
  game.boss.y = 300;
  game.boss.warning = { x: 465, y: 300, angles: [Math.PI], remaining: 1, duration: 1 };
  game.bullets.push({ x: 480, y: 300, vx: 740, vy: 0, friendly: true });
  advance(game, 0.01);
  assert.equal(game.state, "debrief");
  assert.equal(game.bankedScore, 1450);
  game.launch();
  assert.equal(game.level, 2);
  assert.equal(game.health, 4);
  assert.equal(game.score, 1450);
  game.score += 300;
  game.health = 1;
  game.player.invulnerable = 0;
  game.damage("gunfire");
  assert.equal(game.state, "gameover");
  game.launch();
  assert.equal(game.level, 2);
  assert.equal(game.health, 5);
  assert.equal(game.score, 1450);
  assert.equal(game.time, 0);
  assert.equal(game.enemies.length, 0);
});

test("veteran pressure increases without unbounded speed, health, or spawn density", () => {
  const first = difficulty(1);
  const fourth = difficulty(4);
  const veteran = difficulty(12);
  assert.ok(fourth.enemyInterval < first.enemyInterval);
  assert.ok(fourth.aceHull > first.aceHull);
  assert.ok(veteran.bulletSpeed > fourth.bulletSpeed);
  assert.deepEqual(difficulty(1000), veteran);
});

function pilot(game) {
  const player = game.player;
  const target = game.state === "boss" ? game.boss : game.enemies.find((enemy) => enemy.x > player.x);
  const preferred = target?.y ?? 310;
  let destination = 310;
  let lowestCost = Infinity;
  for (let y = 225; y < Math.min(440, game.obstacleTop(player.x) - 30); y += 10) {
    let cost = Math.abs(y - preferred) * 0.7 + Math.abs(y - player.y) * 0.12;
    for (const bullet of game.bullets) {
      if (bullet.friendly || bullet.vx >= 0) continue;
      const arrival = (player.x - bullet.x) / bullet.vx;
      if (arrival < -0.06 || arrival > 1.2) continue;
      const impactY = bullet.y + bullet.vy * Math.max(0, arrival);
      cost += Math.max(0, 60 - Math.abs(y - impactY)) * 8;
    }
    for (const enemy of game.enemies) {
      if (Math.abs(enemy.x - player.x) < 140) cost += Math.max(0, 55 - Math.abs(y - enemy.y)) * 10;
    }
    if (cost < lowestCost) { destination = y; lowestCost = cost; }
  }
  return { up: player.y > destination + 3, down: player.y < destination - 3, fire: true };
}

test("a moving, dodging pilot can clear all four real patrols and ace duels", () => {
  const game = new Game(seededRandom(1917));
  for (let level = 1; level <= 4; level += 1) {
    game.launch();
    advance(game, 155, pilot);
    assert.equal(game.state, "debrief", `mission ${level}: ${game.state}, hull ${game.health}, ace ${game.boss?.hp}`);
    assert.ok(game.score >= 1000 + level * 250);
  }
});
