export const WIDTH = 1100;
export const HEIGHT = 620;
export const MAX_HULL = 5;
export const REPAIR_HULL = 2;

export function repairNote(health) {
  const missing = MAX_HULL - health;
  if (missing <= 0) return "Your airframe is untouched; no repairs needed.";
  if (missing <= REPAIR_HULL) return "The ground crew will fully repair your airframe before your next sortie.";
  return `The ground crew will repair ${REPAIR_HULL} hull points before your next sortie.`;
}

export const ACES = [
  { name: 'Otto "Needle" Weiss', short: "NEEDLE", tell: "One shot. One tell. Leave the amber line.", pattern: "aim", color: "#b65d43" },
  { name: 'Emil "Rook" Adler', short: "ROOK", tell: "A three-shot fan. Find the space between.", pattern: "fan", color: "#6d7885" },
  { name: 'Kurt "Viper" Falk', short: "VIPER", tell: "Three shots on one line. Dodge, then hold your nerve.", pattern: "burst", color: "#72835b" },
  { name: "The Crimson Baron", short: "BARON", tell: "Wide fans and aimed volleys. Read every wind-up.", pattern: "mixed", color: "#af3c36" },
];

export const MISSIONS = ["First light", "Balloon alley", "Low country", "The red horizon"];
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function seededRandom(seed = 1917) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function difficulty(level) {
  const rank = Math.min(Math.max(1, level), 12);
  return {
    duration: 36 + Math.min(level, 4) * 3,
    scrollSpeed: 115 + rank * 5,
    enemySpeed: 150 + rank * 9,
    enemyInterval: Math.max(1.05, 2.8 - rank * 0.16),
    bulletSpeed: 205 + rank * 11,
    balloonInterval: Math.max(3.2, 6.5 - rank * 0.3),
    aceHull: 19 + rank * 4,
    aceRecovery: Math.max(0.7, 1.65 - rank * 0.055),
  };
}

export function groundHeight(worldX) {
  return 531 + Math.sin(worldX * 0.0035) * 23 + Math.sin(worldX * 0.009) * 10;
}

export function treeAt(index) {
  const variation = (Math.sin(index * 127.1 + 43.7) + 1) / 2;
  const x = index * 155 + 45;
  return { x, ground: groundHeight(x), height: 34 + variation * 28 };
}

function overlap(a, b, xRadius, yRadius) {
  return Math.abs(a.x - b.x) < xRadius && Math.abs(a.y - b.y) < yRadius;
}

export class Game {
  constructor(random = Math.random) {
    this.random = random;
    this.level = 1;
    this.score = 0;
    this.bankedScore = 0;
    this.health = MAX_HULL;
    this.state = "briefing";
    this.paused = false;
    this.scroll = 0;
    this.time = 0;
    this.player = { x: 180, y: 310, invulnerable: 0, cooldown: 0, tilt: 0 };
    this.enemies = [];
    this.balloons = [];
    this.bullets = [];
    this.events = [];
    this.boss = null;
    this.config = difficulty(1);
  }

  get ace() {
    return ACES[(this.level - 1) % ACES.length];
  }

  get mission() {
    return MISSIONS[(this.level - 1) % MISSIONS.length];
  }

  get active() {
    return ["playing", "aceIntro", "boss"].includes(this.state);
  }

  emit(type, data = {}) {
    this.events.push({ type, ...data });
  }

  launch() {
    if (this.state === "debrief") {
      this.level += 1;
      this.health = Math.min(MAX_HULL, this.health + REPAIR_HULL);
    } else if (this.state === "gameover" || this.state === "briefing") {
      this.health = MAX_HULL;
    } else {
      return;
    }
    this.config = difficulty(this.level);
    this.score = this.bankedScore;
    this.state = "playing";
    this.paused = false;
    this.time = 0;
    this.scroll = 0;
    this.player = { x: 180, y: 310, invulnerable: 1.2, cooldown: 0, tilt: 0 };
    this.enemies = [];
    this.balloons = [];
    this.bullets = [];
    this.boss = null;
    this.enemyTimer = 1.5;
    this.balloonTimer = 3;
    this.emit("launch");
  }

  togglePause() {
    if (this.active) {
      this.paused = !this.paused;
      this.emit("pause");
    }
  }

  obstacleTop(x) {
    const worldX = x + this.scroll;
    let top = groundHeight(worldX);
    const nearby = Math.floor(worldX / 155);
    for (let i = nearby - 1; i <= nearby + 1; i += 1) {
      const tree = treeAt(i);
      if (Math.abs(tree.x - worldX) < 23) {
        top = Math.min(top, tree.ground - tree.height + 8);
      }
    }
    return top;
  }

  damage(source) {
    if (this.player.invulnerable > 0 || !this.active) return false;
    this.health -= 1;
    this.player.invulnerable = 1.6;
    this.emit("damage", { x: this.player.x, y: this.player.y, source });
    if (this.health <= 0) {
      this.state = "gameover";
      this.emit("defeat");
    }
    return true;
  }

  spawnEnemy() {
    const armored = this.level >= 2 && this.random() < Math.min(0.5, this.level * 0.09);
    const baseY = 240 + this.random() * 175;
    this.enemies.push({
      x: WIDTH + 55,
      y: baseY,
      baseY,
      phase: this.random() * Math.PI * 2,
      age: 0,
      hp: armored ? 2 : 1,
      armored,
      fireTimer: 1.6 + this.random() * 0.9,
    });
  }

  aimedBullet(x, y, angle, speed, ace = false) {
    this.bullets.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      friendly: false,
      radius: ace ? 5 : 4,
      ace,
    });
  }

  beginAce() {
    this.state = "aceIntro";
    this.introTimer = 2.8;
    this.enemies = [];
    this.balloons = [];
    this.bullets = [];
    this.boss = {
      x: WIDTH + 80, y: 300, age: 0,
      hp: this.config.aceHull, maxHp: this.config.aceHull,
      cooldown: 1.3, warning: null, bursts: [], attackCount: 0, enraged: false,
    };
    this.player.invulnerable = Math.max(this.player.invulnerable, 1.2);
    this.emit("ace");
  }

  prepareAttack() {
    const boss = this.boss;
    const kind = this.ace.pattern === "mixed"
      ? (boss.attackCount % 2 === 0 ? "wide" : "aim")
      : this.ace.pattern;
    const angle = Math.atan2(this.player.y - boss.y, this.player.x - boss.x);
    const offsets = kind === "fan" ? [-0.25, 0, 0.25]
      : kind === "wide" ? [-0.48, -0.24, 0, 0.24, 0.48] : [0];
    // Freeze the muzzle and trajectory during the tell: a warning is a promise.
    boss.warning = {
      x: boss.x - 35, y: boss.y, kind,
      angles: offsets.map((offset) => angle + offset),
      remaining: 0.95, duration: 0.95,
    };
    boss.attackCount += 1;
    this.emit("warning");
  }

  updateBoss(dt) {
    const boss = this.boss;
    boss.age += dt;
    boss.enraged = boss.hp <= boss.maxHp / 2;
    if (!boss.warning && boss.bursts.length === 0) {
      const rank = Math.min(this.level, 8);
      boss.y = 295 + Math.sin(boss.age * (0.65 + rank * 0.07)) * (65 + rank * 9);
      boss.x = 865 + Math.sin(boss.age * 0.42) * 48;
    }
    for (const burst of boss.bursts) {
      burst.delay -= dt;
      if (burst.delay <= 0) {
        this.aimedBullet(burst.x, burst.y, burst.angle, this.config.bulletSpeed + 30, true);
        burst.fired = true;
        this.emit("enemyShot", { x: burst.x, y: burst.y });
      }
    }
    boss.bursts = boss.bursts.filter((burst) => !burst.fired);
    if (boss.warning) {
      const warning = boss.warning;
      warning.remaining -= dt;
      if (warning.remaining <= 0) {
        for (const angle of warning.angles) {
          this.aimedBullet(warning.x, warning.y, angle, this.config.bulletSpeed + 30, true);
          if (warning.kind === "burst") {
            for (const delay of [0.2, 0.4]) {
              boss.bursts.push({ x: warning.x, y: warning.y, angle, delay });
            }
          }
        }
        this.emit("enemyShot", { x: warning.x, y: warning.y });
        boss.warning = null;
        boss.cooldown = this.config.aceRecovery * (boss.enraged ? 0.7 : 1);
      }
    } else {
      boss.cooldown -= dt;
      if (boss.cooldown <= 0) this.prepareAttack();
    }
  }

  completeMission() {
    this.score += 1000 + this.level * 250;
    this.bankedScore = this.score;
    this.state = "debrief";
    this.bullets = [];
    this.emit("victory", { x: this.boss.x, y: this.boss.y });
  }

  step(dt, input = {}) {
    if (!this.active || this.paused) return;
    dt = clamp(dt, 0, 0.05);
    const player = this.player;
    this.scroll += this.config.scrollSpeed * dt;
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    player.cooldown = Math.max(0, player.cooldown - dt);
    const vertical = Number(Boolean(input.down)) - Number(Boolean(input.up));
    player.y = clamp(player.y + vertical * 310 * dt, 32, HEIGHT - 25);
    player.tilt += (vertical * 0.15 - player.tilt) * Math.min(1, dt * 12);
    const floor = this.obstacleTop(player.x) - 13;
    if (player.y > floor) {
      player.y = floor - 4;
      this.damage("terrain");
    }
    if (!this.active) return;
    if (input.fire && player.cooldown <= 0 && this.state !== "aceIntro") {
      this.bullets.push({ x: player.x + 35, y: player.y, vx: 740, vy: 0, friendly: true, radius: 3 });
      player.cooldown = 0.16;
      this.emit("shot", { x: player.x + 38, y: player.y });
    }
    if (this.state === "playing") {
      this.time += dt;
      if (this.time >= this.config.duration) {
        this.beginAce();
      } else {
        this.enemyTimer -= dt;
        this.balloonTimer -= dt;
        if (this.enemyTimer <= 0) {
          this.spawnEnemy();
          this.enemyTimer = this.config.enemyInterval * (0.85 + this.random() * 0.3);
        }
        if (this.balloonTimer <= 0) {
          this.balloons.push({ x: WIDTH + 65, y: 90 + this.random() * 95 });
          this.balloonTimer = this.config.balloonInterval * (0.9 + this.random() * 0.2);
        }
      }
    } else if (this.state === "aceIntro") {
      this.introTimer -= dt;
      this.boss.x += (865 - this.boss.x) * dt * 1.8;
      if (this.introTimer <= 0) {
        this.state = "boss";
        this.emit("duel");
      }
    } else if (this.state === "boss") {
      this.updateBoss(dt);
    }

    for (const enemy of this.enemies) {
      enemy.x -= this.config.enemySpeed * dt;
      enemy.age += dt;
      enemy.y = enemy.baseY + Math.sin(enemy.age * 1.6 + enemy.phase) * 29;
      enemy.fireTimer -= dt;
      if (enemy.fireTimer <= 0 && enemy.x > player.x + 100 && enemy.x < WIDTH - 40) {
        const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
        this.aimedBullet(enemy.x - 28, enemy.y, angle, this.config.bulletSpeed);
        enemy.fireTimer = Math.max(1.3, 3.2 - this.level * 0.1);
        this.emit("enemyShot", { x: enemy.x - 28, y: enemy.y });
      }
      if (overlap(enemy, player, 44, 21)) {
        if (this.damage("aircraft")) enemy.hp = 0;
      }
      if (!this.active) return;
    }
    for (const balloon of this.balloons) {
      balloon.x -= this.config.scrollSpeed * dt;
      const dx = (player.x - balloon.x) / 61;
      const dy = (player.y - balloon.y) / 34;
      if (dx * dx + dy * dy < 1) this.damage("balloon");
      if (!this.active) return;
    }
    for (const bullet of this.bullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      if (bullet.friendly) {
        for (const enemy of this.enemies) {
          if (enemy.hp > 0 && overlap(bullet, enemy, 29, 17)) {
            enemy.hp -= 1;
            bullet.spent = true;
            this.emit("hit", { x: bullet.x, y: bullet.y });
            if (enemy.hp === 0) {
              this.score += enemy.armored ? 175 : 100;
              this.emit("kill", { x: enemy.x, y: enemy.y });
            }
            break;
          }
        }
        if (!bullet.spent && this.state === "boss" && overlap(bullet, this.boss, 38, 21)) {
          this.boss.hp -= 1;
          bullet.spent = true;
          this.emit("hit", { x: bullet.x, y: bullet.y });
          if (this.boss.hp <= 0) {
            this.completeMission();
            break;
          }
        }
        if (!bullet.spent && this.balloons.some((balloon) => overlap(bullet, balloon, 44, 23))) {
          bullet.spent = true;
        }
      } else if (overlap(bullet, player, 19, 11)) {
        bullet.spent = true;
        this.damage("gunfire");
        if (!this.active) return;
      }
    }
    this.enemies = this.enemies.filter((enemy) => enemy.x > -70 && enemy.hp > 0);
    this.balloons = this.balloons.filter((balloon) => balloon.x > -90);
    this.bullets = this.bullets.filter((bullet) =>
      !bullet.spent && bullet.x > -30 && bullet.x < WIDTH + 40 && bullet.y > -30 && bullet.y < HEIGHT + 30);
  }
}
