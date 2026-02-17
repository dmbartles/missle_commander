// MISSILE COMMAND: NEON APOCALYPSE
// Single-file React component — full game
// Sections: CONSTANTS, GAME STATE, ENTITY CLASSES, RENDERING, GAME LOOP, UI SCREENS

import React, { useRef, useEffect, useState, useCallback } from 'react';

// === CONSTANTS ===
const W = 800;
const H = 500;
const GROUND_Y = 440;
const BASE_Y = GROUND_Y - 10;

const COLORS = {
  bg: '#0a0a2e',
  ground: '#2d0a3e',
  playerMissile: '#00ffff',
  playerExplosion: '#ff00ff',
  enemyMissile: '#ff3333',
  enemyMissileAlt: '#ff6600',
  enemyExplosion: '#ffaa00',
  city: '#00ffcc',
  base: '#00ff66',
  uiGreen: '#33ff33',
  uiPink: '#ff3399',
  truck: '#ffdd00',
  star: '#ffffff',
  nuke: '#ff88ff',
  emp: '#88aaff',
  decoy: '#ff3333',
  stealth: '#ff6622',
  drone: '#ff4444',
};

const BASE_POSITIONS = [120, 400, 680];
const CITY_POSITIONS = [195, 265, 335, 465, 535, 605];
const STARTING_AMMO = 10;
// const CANVAS_SCALE = 1; // reserved for future HiDPI support

const WAVE_CONFIG = [
  // wave 1
  { icbm: 8,  mirv: 0, fast: 0, decoy: 0, emp: 0, nuke: 0, bombers: 0, stealth: 0, cargo: 0, drones: 0, speed: 0.6 },
  // wave 2
  { icbm: 10, mirv: 0, fast: 0, decoy: 0, emp: 0, nuke: 0, bombers: 1, stealth: 0, cargo: 0, drones: 0, speed: 0.7 },
  // wave 3
  { icbm: 10, mirv: 2, fast: 0, decoy: 0, emp: 0, nuke: 0, bombers: 1, stealth: 0, cargo: 0, drones: 0, speed: 0.8 },
  // wave 4
  { icbm: 12, mirv: 2, fast: 0, decoy: 0, emp: 0, nuke: 0, bombers: 1, stealth: 0, cargo: 1, drones: 0, speed: 0.85 },
  // wave 5
  { icbm: 10, mirv: 2, fast: 4, decoy: 0, emp: 0, nuke: 0, bombers: 1, stealth: 0, cargo: 1, drones: 0, speed: 0.95 },
  // wave 6
  { icbm: 12, mirv: 3, fast: 4, decoy: 0, emp: 0, nuke: 0, bombers: 2, stealth: 1, cargo: 1, drones: 0, speed: 1.0 },
  // wave 7
  { icbm: 12, mirv: 3, fast: 4, decoy: 3, emp: 0, nuke: 0, bombers: 2, stealth: 1, cargo: 1, drones: 0, speed: 1.1 },
  // wave 8
  { icbm: 14, mirv: 4, fast: 5, decoy: 3, emp: 0, nuke: 0, bombers: 2, stealth: 2, cargo: 1, drones: 0, speed: 1.15 },
  // wave 9
  { icbm: 14, mirv: 4, fast: 5, decoy: 3, emp: 2, nuke: 0, bombers: 2, stealth: 2, cargo: 1, drones: 1, speed: 1.2 },
  // wave 10
  { icbm: 15, mirv: 5, fast: 6, decoy: 4, emp: 2, nuke: 0, bombers: 3, stealth: 2, cargo: 1, drones: 1, speed: 1.3 },
  // wave 11
  { icbm: 16, mirv: 5, fast: 6, decoy: 4, emp: 3, nuke: 0, bombers: 3, stealth: 3, cargo: 1, drones: 2, speed: 1.35 },
  // wave 12+
  { icbm: 16, mirv: 6, fast: 7, decoy: 4, emp: 3, nuke: 2, bombers: 3, stealth: 3, cargo: 1, drones: 2, speed: 1.4 },
];

function getWaveConfig(wave) {
  const idx = Math.min(wave - 1, WAVE_CONFIG.length - 1);
  const cfg = { ...WAVE_CONFIG[idx] };
  if (wave > 12) {
    const extra = wave - 12;
    cfg.icbm += extra * 2;
    cfg.mirv += extra;
    cfg.fast += extra;
    cfg.nuke += extra;
    cfg.speed = Math.min(2.5, cfg.speed + extra * 0.1);
  }
  return cfg;
}

// === ENTITY CLASSES ===
class Particle {
  constructor(x, y, vx, vy, color, life, size = 2) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.color = color;
    this.life = life;
    this.maxLife = life;
    this.size = size;
    this.dead = false;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.05;
    this.life--;
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx) {
    const alpha = this.life / this.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 4;
    ctx.shadowColor = this.color;
    ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
    ctx.restore();
  }
}

class Trail {
  constructor(x, y, color) {
    this.x = x; this.y = y;
    this.color = color;
    this.life = 30;
    this.maxLife = 30;
    this.dead = false;
  }
  update() { this.life--; if (this.life <= 0) this.dead = true; }
  draw(ctx) {
    const alpha = (this.life / this.maxLife) * 0.6;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 6;
    ctx.shadowColor = this.color;
    ctx.fillRect(this.x - 1, this.y - 1, 3, 3);
    ctx.restore();
  }
}

class Explosion {
  constructor(x, y, maxR, color1, color2, isPlayer = true) {
    this.x = x; this.y = y;
    this.r = 4;
    this.maxR = maxR;
    this.color1 = color1;
    this.color2 = color2;
    this.isPlayer = isPlayer;
    this.phase = 'grow'; // grow, hold, shrink
    this.holdTimer = 18;
    this.dead = false;
    this.particles = [];
    // spawn particles
    const count = Math.floor(maxR / 4);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      this.particles.push(new Particle(
        x, y,
        Math.cos(angle) * speed, Math.sin(angle) * speed,
        Math.random() > 0.5 ? color1 : color2,
        20 + Math.random() * 20,
        2 + Math.random() * 3
      ));
    }
  }
  get active() { return !this.dead; }
  update() {
    this.particles.forEach(p => p.update());
    this.particles = this.particles.filter(p => !p.dead);
    if (this.phase === 'grow') {
      this.r += 3;
      if (this.r >= this.maxR) { this.r = this.maxR; this.phase = 'hold'; }
    } else if (this.phase === 'hold') {
      this.holdTimer--;
      if (this.holdTimer <= 0) this.phase = 'shrink';
    } else {
      this.r -= 2;
      if (this.r <= 0) this.dead = true;
    }
  }
  draw(ctx) {
    if (this.dead) return;
    this.particles.forEach(p => p.draw(ctx));
    const grd = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r);
    grd.addColorStop(0, this.color2 + 'ff');
    grd.addColorStop(0.4, this.color1 + 'cc');
    grd.addColorStop(1, this.color1 + '00');
    ctx.save();
    ctx.globalAlpha = this.phase === 'hold' ? 0.85 : 0.7;
    ctx.shadowBlur = 20;
    ctx.shadowColor = this.color1;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();
    ctx.restore();
  }
  contains(x, y) {
    if (this.dead) return false;
    const dx = x - this.x, dy = y - this.y;
    return Math.sqrt(dx * dx + dy * dy) <= this.r;
  }
}

class PlayerMissile {
  constructor(x, y, tx, ty, speed, gs) {
    this.x = x; this.y = y;
    this.tx = tx; this.ty = ty;
    const dx = tx - x, dy = ty - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    this.vx = (dx / dist) * speed;
    this.vy = (dy / dist) * speed;
    this.dead = false;
    this.trails = [];
    this.gs = gs; // game state ref for upgrades
  }
  update() {
    this.trails.push(new Trail(this.x, this.y, COLORS.playerMissile));
    this.x += this.vx;
    this.y += this.vy;
    this.trails.forEach(t => t.update());
    this.trails = this.trails.filter(t => !t.dead);
    const dx = this.tx - this.x, dy = this.ty - this.y;
    if (Math.sqrt(dx * dx + dy * dy) < 6) {
      this.dead = true;
    }
  }
  draw(ctx) {
    this.trails.forEach(t => t.draw(ctx));
    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = COLORS.playerMissile;
    ctx.fillStyle = COLORS.playerMissile;
    ctx.fillRect(this.x - 2, this.y - 2, 5, 5);
    ctx.restore();
  }
}

class EnemyMissile {
  constructor(x, ty, type, speedMult) {
    this.x = x;
    this.y = -10;
    this.tx = ty.tx;
    this.ty = ty.ty;
    this.type = type; // 'icbm','mirv','fast','decoy','emp','nuke'
    this.speedMult = speedMult;
    this.dead = false;
    this.trails = [];
    this.hasExploded = false;

    let baseSpeed = 0.7;
    if (type === 'fast') baseSpeed = 1.4;
    if (type === 'nuke') baseSpeed = 0.35;
    if (type === 'emp')  baseSpeed = 0.6;
    this.speed = baseSpeed * speedMult;

    const dx = this.tx - x, dy = this.ty - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    this.vx = (dx / dist) * this.speed;
    this.vy = (dy / dist) * this.speed;

    // for MIRV: split at mid altitude
    this.mirvSplit = false;
    this.mirvY = 150 + Math.random() * 100;

    // flicker for decoy / stealth
    this.flickerTimer = 0;
    this.visible = true;
  }
  get trailColor() {
    if (this.type === 'emp')   return COLORS.emp;
    if (this.type === 'nuke')  return COLORS.nuke;
    if (this.type === 'fast')  return COLORS.enemyMissileAlt;
    return COLORS.enemyMissile;
  }
  get explosionRadius() {
    if (this.type === 'nuke') return 90;
    if (this.type === 'emp')  return 60;
    return 30;
  }
  update() {
    this.flickerTimer++;
    if (this.type === 'decoy') this.visible = Math.floor(this.flickerTimer / 4) % 2 === 0;
    this.trails.push(new Trail(this.x, this.y, this.trailColor));
    this.x += this.vx;
    this.y += this.vy;
    this.trails.forEach(t => t.update());
    this.trails = this.trails.filter(t => !t.dead);
    const dx = this.tx - this.x, dy = this.ty - this.y;
    if (Math.sqrt(dx * dx + dy * dy) < 8) {
      this.dead = true;
      this.hasExploded = true;
    }
  }
  draw(ctx) {
    if (!this.visible) return;
    this.trails.forEach(t => t.draw(ctx));
    ctx.save();
    ctx.shadowBlur = this.type === 'nuke' ? 20 : 10;
    ctx.shadowColor = this.trailColor;
    ctx.fillStyle = this.trailColor;
    const sz = this.type === 'nuke' ? 7 : this.type === 'fast' ? 2 : 4;
    ctx.fillRect(this.x - sz / 2, this.y - sz / 2, sz, sz);
    ctx.restore();
  }
}

class Aircraft {
  constructor(type, waveSpeed) {
    this.type = type; // 'bomber','stealth','cargo','drone'
    this.fromLeft = Math.random() > 0.5;
    this.x = this.fromLeft ? -40 : W + 40;
    this.y = 60 + Math.random() * 100;
    this.speed = (this.type === 'drone' ? 2 : 1.2) * (0.8 + waveSpeed * 0.3);
    if (!this.fromLeft) this.speed = -this.speed;
    this.dead = false;
    this.hp = type === 'drone' ? 1 : 2;
    this.dropTimer = 120 + Math.random() * 180;
    this.flickerTimer = 0;
    this.visible = true;
    this.droppedAmmo = false;
  }
  get color() {
    if (this.type === 'stealth') return COLORS.stealth;
    if (this.type === 'cargo')  return '#aaffaa';
    if (this.type === 'drone')  return COLORS.drone;
    return '#ff8888';
  }
  update() {
    this.flickerTimer++;
    if (this.type === 'stealth') this.visible = Math.floor(this.flickerTimer / 6) % 3 !== 0;
    this.x += this.speed;
    this.dropTimer--;
    if (this.x < -60 || this.x > W + 60) this.dead = true;
  }
  draw(ctx) {
    if (!this.visible) return;
    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    // body
    const flip = this.speed < 0 ? -1 : 1;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(flip, 1);
    if (this.type === 'drone') {
      ctx.fillRect(-6, -3, 12, 6);
      ctx.fillRect(-3, -6, 6, 3);
    } else {
      // fuselage
      ctx.fillRect(-16, -4, 32, 8);
      // wings
      ctx.fillRect(-8, -4, 16, -6);
      ctx.fillRect(-8, 4, 16, 6);
      // tail
      ctx.fillRect(-16, -6, 6, 12);
      if (this.type === 'cargo') {
        ctx.fillStyle = '#88ff88';
        ctx.fillRect(-4, -3, 8, 6);
      }
    }
    ctx.restore();
    ctx.restore();
  }
}

class SupplyTruck {
  constructor(fromLeft, speed) {
    this.fromLeft = fromLeft;
    this.x = fromLeft ? -30 : W + 30;
    this.y = GROUND_Y - 8;
    this.speed = fromLeft ? speed : -speed;
    this.dead = false;
    this.destroyed = false;
    this.flashTimer = 0;
    this.armor = false; // set by upgrades
    this.hp = 1;
  }
  update() {
    this.flashTimer++;
    this.x += this.speed;
    if (this.fromLeft && this.x > W + 30) this.dead = true;
    if (!this.fromLeft && this.x < -30) this.dead = true;
  }
  draw(ctx) {
    if (this.destroyed) return;
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = COLORS.truck;
    ctx.fillStyle = COLORS.truck;
    // body
    ctx.fillRect(this.x - 14, this.y - 8, 28, 12);
    ctx.fillStyle = '#cc8800';
    ctx.fillRect(this.x - 14, this.y - 12, 10, 8);
    // wheels
    ctx.fillStyle = '#333';
    ctx.fillRect(this.x - 12, this.y + 4, 6, 6);
    ctx.fillRect(this.x + 6, this.y + 4, 6, 6);
    // flashing light
    if (Math.floor(this.flashTimer / 15) % 2 === 0) {
      ctx.fillStyle = '#ff4444';
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#ff4444';
      ctx.fillRect(this.x - 2, this.y - 14, 4, 4);
    }
    ctx.restore();
  }
}

// === GAME STATE ===
function createInitialState() {
  return {
    // scene: 'title' | 'story' | 'playing' | 'wave_end' | 'upgrade' | 'cutscene' | 'gameover' | 'victory'
    scene: 'title',
    wave: 1,
    score: 0,
    researchCredits: 0,

    // bases: array of { x, ammo, alive, disabled, disableTimer, shakeTimer }
    bases: BASE_POSITIONS.map(x => ({
      x, ammo: STARTING_AMMO, alive: true,
      disabled: false, disableTimer: 0,
      hasArmor: false, armored: false, autoTurret: false, autoTurretTimer: 0,
    })),

    // cities: array of { x, alive, shielded }
    cities: CITY_POSITIONS.map(x => ({
      x, alive: true, shielded: false, isDecoy: false,
    })),

    // upgrades purchased
    upgrades: {
      blastRadius: 0,
      missileSpeed: 0,
      chainReaction: false,
      dualWarhead: false,
      autoTurret: false,
      cityShield: 0,
      baseArmor: false,
      empHardening: false,
      decoyCity: false,
      extraAmmo: 0,
      truckArmor: false,
      fastTrucks: false,
      truckCapacity: 0,
    },

    // wave end stats
    waveStats: { enemiesDestroyed: 0, citiesSaved: 0, ammoRemaining: 0 },

    // screen shake
    shake: { x: 0, y: 0, timer: 0 },
  };
}

// === RENDERING HELPERS ===
function drawPixelText(ctx, text, x, y, size, color, glow = true) {
  ctx.save();
  ctx.font = `bold ${size}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (glow) {
    ctx.shadowBlur = 16;
    ctx.shadowColor = color;
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawScanlines(ctx) {
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = '#000000';
  for (let y = 0; y < H; y += 3) {
    ctx.fillRect(0, y, W, 1);
  }
  ctx.restore();
}

function drawGrid(ctx) {
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = '#ff00ff';
  ctx.lineWidth = 0.5;
  const vp = { ox: W / 2, oy: GROUND_Y };
  const cols = 20, rows = 8;
  for (let i = 0; i <= cols; i++) {
    const x = (i / cols) * W;
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y);
    ctx.lineTo(vp.ox, GROUND_Y + 60);
    ctx.stroke();
  }
  for (let j = 1; j <= rows; j++) {
    const t = j / rows;
    const y = GROUND_Y + t * 60;
    const left  = W / 2 - (W / 2) * t;
    const right = W / 2 + (W / 2) * t;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawStars(ctx, stars, tick) {
  ctx.save();
  stars.forEach(s => {
    const twinkle = 0.4 + 0.6 * Math.abs(Math.sin((tick + s.phase) * 0.03));
    ctx.globalAlpha = twinkle * s.alpha;
    ctx.fillStyle = COLORS.star;
    ctx.fillRect(s.x, s.y, s.size, s.size);
  });
  ctx.restore();
}

function drawCity(ctx, city, tick) {
  if (!city.alive) {
    // rubble
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#441144';
    ctx.fillRect(city.x - 14, GROUND_Y - 8, 28, 8);
    ctx.restore();
    return;
  }
  const cx = city.x;
  const buildings = [
    { ox: -14, w: 8, h: 20 },
    { ox: -5,  w: 10, h: 28 },
    { ox: 6,   w: 8, h: 22 },
    { ox: 14,  w: 7, h: 16 },
  ];
  const glow = 0.7 + 0.3 * Math.sin(tick * 0.04 + city.x * 0.01);
  ctx.save();
  ctx.shadowBlur = 12 * glow;
  ctx.shadowColor = city.isDecoy ? '#888800' : COLORS.city;
  buildings.forEach(b => {
    ctx.fillStyle = city.isDecoy ? '#888800' : COLORS.city;
    ctx.globalAlpha = city.isDecoy ? 0.5 + glow * 0.3 : 1;
    ctx.fillRect(cx + b.ox, GROUND_Y - b.h, b.w, b.h);
    // windows
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.3 + 0.3 * glow;
    for (let wy = GROUND_Y - b.h + 3; wy < GROUND_Y - 3; wy += 6) {
      for (let wx = cx + b.ox + 1; wx < cx + b.ox + b.w - 1; wx += 4) {
        if (Math.random() > 0.3) ctx.fillRect(wx, wy, 2, 3);
      }
    }
  });
  if (city.shielded) {
    ctx.globalAlpha = 0.3 + 0.15 * Math.sin(tick * 0.08);
    ctx.strokeStyle = '#00aaff';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#00aaff';
    ctx.beginPath();
    ctx.arc(cx, GROUND_Y - 14, 24, Math.PI, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBase(ctx, base, tick) {
  const { x, ammo, alive, disabled } = base;
  if (!alive) {
    // rubble
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#552200';
    ctx.fillRect(x - 18, GROUND_Y - 10, 36, 10);
    // sparks
    ctx.globalAlpha = 0.4 + 0.3 * Math.random();
    ctx.fillStyle = '#ff6600';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(x - 15 + Math.random() * 30, GROUND_Y - 10 + Math.random() * 8, 2, 2);
    }
    ctx.restore();
    return;
  }
  const glow = disabled
    ? 0.3 + 0.2 * Math.sin(tick * 0.3)
    : 0.7 + 0.3 * Math.sin(tick * 0.05 + x * 0.01);
  ctx.save();
  ctx.shadowBlur = 14 * glow;
  ctx.shadowColor = disabled ? '#4466ff' : COLORS.base;
  ctx.fillStyle = disabled ? '#334488' : COLORS.base;
  // platform
  ctx.fillRect(x - 18, GROUND_Y - 8, 36, 8);
  // launcher body
  ctx.fillRect(x - 6, GROUND_Y - 18, 12, 12);
  // barrel
  ctx.fillRect(x - 2, GROUND_Y - 26, 4, 10);
  if (disabled) {
    ctx.fillStyle = '#aaaaff';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('EMP', x, GROUND_Y - 32);
  }
  // ammo pips
  ctx.fillStyle = ammo > 3 ? COLORS.base : '#ff4444';
  for (let i = 0; i < ammo; i++) {
    ctx.fillRect(x - 18 + i * 4, GROUND_Y + 2, 3, 5);
  }
  ctx.restore();
}

function drawGround(ctx) {
  ctx.save();
  ctx.fillStyle = COLORS.ground;
  ctx.shadowBlur = 0;
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
  // top edge glow
  ctx.strokeStyle = '#ff00ff';
  ctx.lineWidth = 1;
  ctx.shadowBlur = 8;
  ctx.shadowColor = '#ff00ff';
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(W, GROUND_Y);
  ctx.stroke();
  ctx.restore();
}

function drawHUD(ctx, gs, _tick) {
  // top bar
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, W, 36);
  drawPixelText(ctx, `WAVE: ${gs.wave}`, 80, 18, 14, COLORS.uiGreen);
  drawPixelText(ctx, `SCORE: ${gs.score}`, 260, 18, 14, COLORS.uiGreen);
  drawPixelText(ctx, `CREDITS: ${gs.researchCredits}`, 460, 18, 14, COLORS.uiPink);

  // city icons top right
  let cx = W - 20;
  for (let i = 5; i >= 0; i--) {
    const alive = gs.cities[i]?.alive;
    ctx.shadowBlur = alive ? 8 : 0;
    ctx.shadowColor = COLORS.city;
    ctx.fillStyle = alive ? COLORS.city : '#333333';
    ctx.fillRect(cx - 8, 8, 10, 18);
    cx -= 16;
  }
  ctx.restore();
}

function drawAlertText(ctx, text, tick) {
  const alpha = 0.6 + 0.4 * Math.sin(tick * 0.15);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowBlur = 20;
  ctx.shadowColor = COLORS.uiPink;
  ctx.fillStyle = COLORS.uiPink;
  ctx.fillText(text, W / 2, 55);
  ctx.restore();
}

// pixel-art portrait drawing
function drawPortrait(ctx, character, x, y) {
  ctx.save();
  // face
  if (character === 'briggs') {
    // grizzled general
    ctx.fillStyle = '#d4a574';
    ctx.fillRect(x, y, 40, 44);
    // aviator glasses
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(x + 4, y + 12, 14, 8);
    ctx.fillRect(x + 22, y + 12, 14, 8);
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(x + 18, y + 15, 4, 2);
    // hat
    ctx.fillStyle = '#2d4a1e';
    ctx.fillRect(x - 2, y - 10, 44, 12);
    ctx.fillRect(x + 4, y - 4, 32, 4);
    // mouth
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(x + 10, y + 28, 20, 3);
    // stars on collar
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(x + 2, y + 38, 5, 5);
    ctx.fillRect(x + 33, y + 38, 5, 5);
  } else if (character === 'pixel') {
    // dr pixel - wild-haired scientist
    ctx.fillStyle = '#f0c090';
    ctx.fillRect(x + 4, y + 8, 32, 36);
    // wild hair
    ctx.fillStyle = '#cc44cc';
    ctx.fillRect(x, y, 40, 16);
    ctx.fillRect(x - 4, y + 4, 8, 24);
    ctx.fillRect(x + 36, y + 4, 8, 24);
    ctx.fillRect(x + 2, y - 4, 36, 12);
    // glasses
    ctx.fillStyle = '#88aaff';
    ctx.fillRect(x + 6, y + 16, 10, 8);
    ctx.fillRect(x + 24, y + 16, 10, 8);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 6, y + 16, 10, 8);
    ctx.strokeRect(x + 24, y + 16, 10, 8);
    ctx.fillStyle = '#333';
    ctx.fillRect(x + 16, y + 19, 8, 2);
    // smile
    ctx.fillStyle = '#cc6666';
    ctx.fillRect(x + 10, y + 32, 20, 4);
    // lab coat
    ctx.fillStyle = '#ddddff';
    ctx.fillRect(x + 2, y + 44, 36, 8);
  } else if (character === 'comandante') {
    // glitchy AI villain
    const glitch = Math.random() > 0.7;
    ctx.fillStyle = glitch ? '#ff0000' : '#220033';
    ctx.fillRect(x, y, 40, 48);
    // circuit pattern
    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 4, y + 4, 32, 40);
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 24); ctx.lineTo(x + 36, y + 24);
    ctx.moveTo(x + 20, y + 4); ctx.lineTo(x + 20, y + 44);
    ctx.stroke();
    // eyes
    ctx.fillStyle = glitch ? '#ff4400' : '#ff00ff';
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#ff00ff';
    ctx.fillRect(x + 6, y + 12, 10, 8);
    ctx.fillRect(x + 24, y + 12, 10, 8);
    // glitch lines
    if (glitch) {
      ctx.fillStyle = '#ff000088';
      ctx.fillRect(x + Math.random() * 20, y + Math.random() * 20, 40, 3);
    }
    ctx.fillStyle = '#00ffff';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('AI', x + 20, y + 36);
  }
  // border
  ctx.strokeStyle = '#ff00ff';
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 2, y - 2, 44, 52);
  ctx.restore();
}

// === MAIN COMPONENT ===
export default function MissileCommand() {
  const canvasRef = useRef(null);
  const gsRef = useRef(createInitialState());
  const [scene, setScene] = useState('title');
  const [uiData, setUiData] = useState({});
  const rafRef = useRef(null);
  const tickRef = useRef(0);

  // Runtime game entities (refs to avoid re-renders in loop)
  const entitiesRef = useRef({
    playerMissiles: [],
    enemyMissiles: [],
    explosions: [],
    aircraft: [],
    trucks: [],
    alerts: [],       // { text, timer }
    pendingEnemies: [], // scheduled spawns { delay, missile }
    waveActive: false,
    waveEndTimer: 0,
    spawnTimer: 0,
    storyScrollY: 0,
    storyDone: false,
    cutsceneStep: 0,
    crosshair: { x: W / 2, y: H / 2 },
    truckSpawnPending: false,
    trucksDone: false,
    waveEndScore: null,
    ammoDrops: [], // { x, y, life } from cargo planes
  });

  // Start a wave
  const startWave = useCallback(() => {
    const gs = gsRef.current;
    const ents = entitiesRef.current;
    const cfg = getWaveConfig(gs.wave);

    // build enemy list
    const enemies = [];
    const targets = [...gs.cities.filter(c => c.alive).map(c => ({ tx: c.x, ty: GROUND_Y - 10 })),
                     ...gs.bases.filter(b => b.alive).map(b => ({ tx: b.x, ty: BASE_Y }))];
    const rndTarget = () => targets.length ? targets[Math.floor(Math.random() * targets.length)]
      : { tx: Math.random() * W, ty: GROUND_Y };

    const addEnemy = (type, count) => {
      for (let i = 0; i < count; i++) {
        const t = rndTarget();
        enemies.push({ type, t, delay: 60 + Math.random() * 400 });
      }
    };
    addEnemy('icbm', cfg.icbm);
    addEnemy('mirv', cfg.mirv);
    addEnemy('fast', cfg.fast);
    addEnemy('decoy', cfg.decoy);
    addEnemy('emp', cfg.emp);
    addEnemy('nuke', cfg.nuke);
    enemies.sort((a, b) => a.delay - b.delay);

    ents.pendingEnemies = enemies.map(e => ({
      delay: e.delay,
      missile: new EnemyMissile(
        50 + Math.random() * (W - 100),
        e.t,
        e.type,
        cfg.speed
      ),
    }));
    ents.enemyMissiles = [];
    ents.playerMissiles = [];
    ents.explosions = [];
    ents.aircraft = [];
    ents.alerts = [];
    ents.spawnTimer = 0;
    ents.waveActive = true;
    ents.waveEndTimer = 0;
    ents.trucksDone = false;
    ents.truckSpawnPending = false;
    ents.waveEndScore = null;
    ents.ammoDrops = [];
    gs.waveStats = { enemiesDestroyed: 0, citiesSaved: 0, ammoRemaining: 0 };

    // spawn aircraft
    const cfgAir = cfg;
    for (let i = 0; i < cfgAir.bombers; i++) {
      setTimeout(() => {
        if (ents.waveActive) ents.aircraft.push(new Aircraft('bomber', cfg.speed));
      }, (2000 + i * 3000));
    }
    for (let i = 0; i < cfgAir.stealth; i++) {
      setTimeout(() => {
        if (ents.waveActive) ents.aircraft.push(new Aircraft('stealth', cfg.speed));
      }, (5000 + i * 4000));
    }
    for (let i = 0; i < cfgAir.cargo; i++) {
      setTimeout(() => {
        if (ents.waveActive) ents.aircraft.push(new Aircraft('cargo', cfg.speed));
      }, (3000 + i * 5000));
    }
    if (cfgAir.drones > 0) {
      setTimeout(() => {
        if (ents.waveActive) {
          for (let d = 0; d < cfgAir.drones * 4; d++) {
            const drone = new Aircraft('drone', cfg.speed);
            drone.y += d * 12 - 24;
            ents.aircraft.push(drone);
          }
        }
      }, 7000);
    }
  }, []);

  // Fire player missile
  const fireMissile = useCallback((canvasX, canvasY) => {
    const gs = gsRef.current;
    const ents = entitiesRef.current;
    if (gs.scene !== 'playing') return;

    // find nearest base with ammo
    let best = null, bestDist = Infinity;
    gs.bases.forEach(b => {
      if (!b.alive || b.ammo <= 0 || b.disabled) return;
      const d = Math.abs(b.x - canvasX);
      if (d < bestDist) { bestDist = d; best = b; }
    });
    if (!best) return;

    best.ammo--;
    const speed = 5 + gs.upgrades.missileSpeed * 1.5;
    ents.playerMissiles.push(new PlayerMissile(best.x, BASE_Y - 20, canvasX, canvasY, speed, gs));
  }, []);

  const handleCanvasClick = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;
    fireMissile(cx, cy);
  }, [fireMissile]);

  const handleCanvasMouseMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    entitiesRef.current.crosshair = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  // Trigger scene transitions from game loop (must call setScene)
  const sceneChangeRef = useRef(null);

  // Main game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // build star field
    const stars = Array.from({ length: 120 }, () => ({
      x: Math.random() * W,
      y: Math.random() * (GROUND_Y - 40),
      alpha: 0.3 + Math.random() * 0.7,
      size: Math.random() > 0.8 ? 2 : 1,
      phase: Math.random() * 100,
    }));

    let running = true;

    function loop() {
      if (!running) return;
      const tick = ++tickRef.current;
      const gs = gsRef.current;
      const ents = entitiesRef.current;

      // handle scene change requests from loop
      if (sceneChangeRef.current) {
        const { newScene, data } = sceneChangeRef.current;
        sceneChangeRef.current = null;
        gs.scene = newScene;
        setScene(newScene);
        if (data) setUiData(data);
      }

      // === DRAWING ===
      // screen shake
      let sx = 0, sy = 0;
      if (gs.shake.timer > 0) {
        sx = (Math.random() - 0.5) * gs.shake.timer * 1.5;
        sy = (Math.random() - 0.5) * gs.shake.timer * 1.5;
        gs.shake.timer--;
      }
      ctx.save();
      ctx.translate(sx, sy);

      // background
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, W, H);

      drawStars(ctx, stars, tick);
      drawGrid(ctx);
      drawGround(ctx);

      if (gs.scene === 'title') {
        drawTitleScreen(ctx, tick);
      } else if (gs.scene === 'story') {
        drawStoryScreen(ctx, ents, tick);
        // auto-advance
        ents.storyScrollY += 0.6;
        if (ents.storyScrollY > 700 || ents.storyDone) {
          if (!ents.storyDone) {
            ents.storyDone = true;
            setTimeout(() => {
              sceneChangeRef.current = { newScene: 'playing' };
            }, 1500);
          }
        }
      } else if (gs.scene === 'playing') {
        updateAndDrawPlaying(ctx, gs, ents, tick, stars);
      } else if (gs.scene === 'wave_end') {
        updateAndDrawWaveEnd(ctx, gs, ents, tick);
      } else if (gs.scene === 'cutscene') {
        drawCutscene(ctx, gs, ents, tick);
      } else if (gs.scene === 'upgrade') {
        drawUpgradeCanvas(ctx, tick);
      } else if (gs.scene === 'gameover') {
        drawGameOver(ctx, tick);
      } else if (gs.scene === 'victory') {
        drawVictory(ctx, gs, tick);
      }

      drawScanlines(ctx);
      ctx.restore();
      rafRef.current = requestAnimationFrame(loop);
    }

    function drawTitleScreen(ctx, tick) {
      // falling enemy missiles in background (attract mode)
      if (tick % 80 === 0) {
        entitiesRef.current.enemyMissiles.push(
          new EnemyMissile(100 + Math.random() * 600, { tx: 100 + Math.random() * 600, ty: GROUND_Y - 10 }, 'icbm', 0.5)
        );
      }
      entitiesRef.current.enemyMissiles.forEach(m => { m.update(); m.draw(ctx); });
      entitiesRef.current.enemyMissiles = entitiesRef.current.enemyMissiles.filter(m => !m.dead);
      // explosions when they hit
      entitiesRef.current.enemyMissiles.forEach(m => {
        if (m.hasExploded) {
          entitiesRef.current.explosions.push(new Explosion(m.tx, m.ty, 30, COLORS.enemyExplosion, '#ff6600', false));
        }
      });
      entitiesRef.current.explosions.forEach(e => { e.update(); e.draw(ctx); });
      entitiesRef.current.explosions = entitiesRef.current.explosions.filter(e => !e.dead);

      const glowAmt = 12 + 8 * Math.sin(tick * 0.05);
      ctx.save();
      ctx.shadowBlur = glowAmt;
      ctx.shadowColor = COLORS.uiPink;
      ctx.fillStyle = COLORS.uiPink;
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('MISSILE COMMAND', W / 2, 160);
      ctx.shadowColor = '#ff6600';
      ctx.shadowBlur = glowAmt * 0.8;
      ctx.fillStyle = '#ff6600';
      ctx.font = 'bold 28px monospace';
      ctx.fillText('NEON APOCALYPSE', W / 2, 200);
      ctx.shadowBlur = 8;
      ctx.shadowColor = COLORS.uiGreen;
      ctx.fillStyle = COLORS.uiGreen;
      ctx.font = '13px monospace';
      ctx.fillText('Defend the Grid. Save the Future. Look Cool Doing It.', W / 2, 235);
      ctx.restore();
    }

    function drawStoryScreen(ctx, ents, _tick) {
      const lines = [
        '',
        'THE YEAR IS 1987. BUT NOT YOUR 1987.',
        '',
        'IN THIS TIMELINE, THE COLD WAR WENT HOT — IN NEON.',
        '',
        'A ROGUE AI CODENAMED "COMANDANTE" HAS SEIZED CONTROL',
        'OF THE ENEMY\'S NUCLEAR ARSENAL.',
        '',
        'ONLY YOU — COMMANDER OF THE LAST DEFENSE GRID —',
        'CAN STOP THE NEON APOCALYPSE.',
        '',
        'YOUR CITIES. YOUR MISSILES. YOUR CALL.',
        '',
        'GOOD LUCK, COMMANDER.',
        'YOU\'LL NEED IT.',
        '',
        '',
        '[ CLICK TO SKIP ]',
      ];
      const baseY = H / 2 - ents.storyScrollY + H;
      ctx.save();
      ctx.shadowBlur = 10;
      ctx.shadowColor = COLORS.uiGreen;
      ctx.fillStyle = COLORS.uiGreen;
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      lines.forEach((line, i) => {
        const y = baseY + i * 26;
        if (y > 0 && y < H) ctx.fillText(line, W / 2, y);
      });
      ctx.restore();
      if (baseY + lines.length * 26 < 0) ents.storyDone = true;
    }

    function updateAndDrawPlaying(ctx, gs, ents, tick, _stars) {
      // update alerts
      ents.alerts = ents.alerts.filter(a => { a.timer--; return a.timer > 0; });

      // spawn pending enemies
      ents.spawnTimer++;
      while (ents.pendingEnemies.length > 0 && ents.spawnTimer >= ents.pendingEnemies[0].delay) {
        ents.enemyMissiles.push(ents.pendingEnemies.shift().missile);
      }

      // auto-turret
      gs.bases.forEach(base => {
        if (!base.alive || !base.autoTurret || base.disabled || base.ammo <= 0) return;
        base.autoTurretTimer = (base.autoTurretTimer || 0) + 1;
        if (base.autoTurretTimer >= 240) {
          base.autoTurretTimer = 0;
          // target nearest enemy missile
          let nearest = null, nd = Infinity;
          ents.enemyMissiles.forEach(m => {
            const d = Math.hypot(m.x - base.x, m.y - BASE_Y);
            if (d < nd) { nd = d; nearest = m; }
          });
          if (nearest) {
            base.ammo--;
            const speed = 5 + gs.upgrades.missileSpeed * 1.5;
            ents.playerMissiles.push(new PlayerMissile(base.x, BASE_Y - 20, nearest.x, nearest.y, speed, gs));
          }
        }
      });

      // update player missiles
      ents.playerMissiles.forEach(m => m.update());
      const pmExplode = ents.playerMissiles.filter(m => m.dead);
      ents.playerMissiles = ents.playerMissiles.filter(m => !m.dead);
      pmExplode.forEach(m => {
        const baseRadius = 30 + gs.upgrades.blastRadius * 7;
        ents.explosions.push(new Explosion(m.tx, m.ty, baseRadius, COLORS.playerExplosion, '#ffffff', true));
        if (gs.upgrades.dualWarhead) {
          setTimeout(() => {
            ents.explosions.push(new Explosion(m.tx, m.ty, baseRadius * 1.5, COLORS.playerExplosion, '#ffffff', true));
          }, 300);
        }
      });

      // update enemy missiles
      ents.enemyMissiles.forEach(m => {
        m.update();
        // MIRV split
        if (m.type === 'mirv' && !m.mirvSplit && m.y >= m.mirvY) {
          m.mirvSplit = true;
          ents.alerts.push({ text: '⚠ MIRV SPLIT!', timer: 90 });
          for (let s = 0; s < 2 + Math.floor(Math.random() * 2); s++) {
            const cfg = getWaveConfig(gs.wave);
            const tx = m.tx + (Math.random() - 0.5) * 200;
            const tgt = { tx: Math.max(10, Math.min(W - 10, tx)), ty: GROUND_Y - 10 };
            ents.enemyMissiles.push(new EnemyMissile(m.x, tgt, 'icbm', cfg.speed * 1.2));
          }
        }
      });

      // check enemy missiles hitting cities/bases
      const deadEnemies = [];
      ents.enemyMissiles.forEach(m => {
        if (!m.hasExploded) return;
        deadEnemies.push(m);
        if (m.type === 'decoy') { return; } // decoy does nothing
        const exR = m.explosionRadius;
        const eColor = m.type === 'emp' ? '#88aaff' : m.type === 'nuke' ? '#ffccff' : COLORS.enemyExplosion;
        ents.explosions.push(new Explosion(m.tx, m.ty, exR, eColor, COLORS.enemyExplosion, false));
        gs.shake.timer = Math.max(gs.shake.timer, m.type === 'nuke' ? 12 : 5);

        // check cities
        gs.cities.forEach(city => {
          if (!city.alive) return;
          if (Math.abs(city.x - m.tx) < exR && Math.abs(GROUND_Y - m.ty) < exR) {
            if (city.isDecoy) { city.alive = false; return; }
            if (city.shielded) { city.shielded = false; return; }
            city.alive = false;
            ents.alerts.push({ text: '!! CITY DESTROYED !!', timer: 120 });
          }
        });
        // check bases
        gs.bases.forEach(base => {
          if (!base.alive) return;
          if (Math.abs(base.x - m.tx) < exR && Math.abs(BASE_Y - m.ty) < exR) {
            if (m.type === 'emp') {
              base.disabled = true;
              base.disableTimer = gs.upgrades.empHardening ? 180 : 600;
              ents.alerts.push({ text: '⚡ BASE EMP\'D!', timer: 120 });
            } else {
              if (base.hasArmor && !base.armored) {
                base.armored = true; // uses armor once
              } else {
                base.alive = false;
                ents.alerts.push({ text: '!! BASE DESTROYED !!', timer: 120 });
              }
            }
          }
        });
      });
      ents.enemyMissiles = ents.enemyMissiles.filter(m => !m.hasExploded);

      // player explosions destroying enemy missiles
      ents.explosions.forEach(exp => {
        if (!exp.isPlayer) return;
        ents.enemyMissiles.forEach(em => {
          if (em.dead) return;
          if (exp.contains(em.x, em.y)) {
            em.dead = true;
            em.hasExploded = false; // intercepted, no ground damage
            gs.score += em.type === 'nuke' ? 500 : em.type === 'mirv' ? 200 : em.type === 'fast' ? 150 : 100;
            gs.researchCredits += em.type === 'nuke' ? 50 : 10;
            gs.waveStats.enemiesDestroyed++;
            // chain reaction
            if (gs.upgrades.chainReaction && Math.random() < 0.25) {
              const baseRadius = 20 + gs.upgrades.blastRadius * 5;
              ents.explosions.push(new Explosion(em.x, em.y, baseRadius, COLORS.playerExplosion, '#ffffff', true));
            }
          }
        });
        // player explosions destroying aircraft
        ents.aircraft.forEach(ac => {
          if (ac.dead) return;
          if (exp.contains(ac.x, ac.y)) {
            ac.hp--;
            if (ac.hp <= 0) {
              ac.dead = true;
              const pts = ac.type === 'stealth' ? 250 : ac.type === 'cargo' ? 50 : ac.type === 'drone' ? 75 : 100;
              gs.score += pts;
              gs.researchCredits += 15;
              gs.waveStats.enemiesDestroyed++;
              if (ac.type === 'cargo' && !ac.droppedAmmo) {
                ac.droppedAmmo = true;
                ents.ammoDrops.push({ x: ac.x, y: ac.y, life: 300 });
              }
            }
          }
        });
      });
      ents.enemyMissiles = ents.enemyMissiles.filter(m => !m.dead);

      // aircraft drop bombs
      ents.aircraft.forEach(ac => {
        ac.update();
        if ((ac.type === 'bomber' || ac.type === 'stealth') && ac.dropTimer <= 0) {
          ac.dropTimer = 120 + Math.random() * 120;
          const cfg = getWaveConfig(gs.wave);
          const tgt = { tx: 50 + Math.random() * (W - 100), ty: GROUND_Y - 10 };
          const missileType = ac.type === 'stealth' ? 'fast' : 'icbm';
          ents.enemyMissiles.push(new EnemyMissile(ac.x, tgt, missileType, cfg.speed));
        }
      });
      ents.aircraft = ents.aircraft.filter(a => !a.dead);

      // update ammo drops
      ents.ammoDrops.forEach(drop => {
        drop.life--;
        drop.y += 1.5;
        // check if hits a base
        gs.bases.forEach(base => {
          if (!base.alive) return;
          if (Math.abs(base.x - drop.x) < 20 && Math.abs(BASE_Y - drop.y) < 30) {
            base.ammo = Math.min(base.ammo + 5, 20);
            drop.life = 0;
          }
        });
      });
      ents.ammoDrops = ents.ammoDrops.filter(d => d.life > 0);

      // base EMP timers
      gs.bases.forEach(base => {
        if (base.disabled) {
          base.disableTimer--;
          if (base.disableTimer <= 0) { base.disabled = false; }
        }
      });

      // supply trucks
      ents.trucks.forEach(truck => {
        truck.update();
        // resupply bases they pass
        gs.bases.forEach(base => {
          if (!base.alive) return;
          if (Math.abs(truck.x - base.x) < 5 && !truck.destroyed) {
            const bonus = 3 + gs.upgrades.truckCapacity * 2;
            base.ammo = Math.min(base.ammo + bonus, 20);
          }
        });
        // trucks destroyed by enemy missiles
        ents.explosions.forEach(exp => {
          if (exp.isPlayer) return;
          if (!truck.destroyed && exp.contains(truck.x, truck.y)) {
            if (gs.upgrades.truckArmor && truck.hp > 1) {
              truck.hp--;
            } else {
              truck.destroyed = true;
              ents.explosions.push(new Explosion(truck.x, truck.y, 25, '#ffcc00', '#ff6600', false));
            }
          }
        });
      });
      ents.trucks = ents.trucks.filter(t => !t.dead);

      // update explosions
      ents.explosions.forEach(e => e.update());
      ents.explosions = ents.explosions.filter(e => !e.dead);

      // === DRAW PLAYING ===
      gs.cities.forEach(city => drawCity(ctx, city, tick));
      gs.bases.forEach(base => drawBase(ctx, base, tick));
      ents.trucks.forEach(t => t.draw(ctx));
      ents.ammoDrops.forEach(drop => {
        ctx.save();
        ctx.fillStyle = COLORS.truck;
        ctx.shadowBlur = 10;
        ctx.shadowColor = COLORS.truck;
        ctx.fillRect(drop.x - 5, drop.y - 5, 10, 10);
        ctx.fillStyle = '#ffffff';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('+', drop.x, drop.y + 3);
        ctx.restore();
      });
      ents.aircraft.forEach(a => a.draw(ctx));
      ents.enemyMissiles.forEach(m => m.draw(ctx));
      ents.playerMissiles.forEach(m => m.draw(ctx));
      ents.explosions.forEach(e => e.draw(ctx));

      // crosshair
      const ch = ents.crosshair;
      ctx.save();
      ctx.strokeStyle = COLORS.playerMissile;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.7;
      ctx.shadowBlur = 8;
      ctx.shadowColor = COLORS.playerMissile;
      ctx.beginPath(); ctx.moveTo(ch.x - 10, ch.y); ctx.lineTo(ch.x + 10, ch.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ch.x, ch.y - 10); ctx.lineTo(ch.x, ch.y + 10); ctx.stroke();
      ctx.beginPath(); ctx.arc(ch.x, ch.y, 5, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();

      // alerts
      if (ents.alerts.length > 0) {
        drawAlertText(ctx, ents.alerts[ents.alerts.length - 1].text, tick);
      }

      drawHUD(ctx, gs, tick);

      // check wave end conditions
      const allEnemiesDone = ents.pendingEnemies.length === 0 &&
        ents.enemyMissiles.length === 0 &&
        ents.aircraft.length === 0;
      const allCitiesGone = gs.cities.every(c => !c.alive);

      if (allCitiesGone) {
        ents.waveActive = false;
        sceneChangeRef.current = { newScene: 'gameover' };
        return;
      }

      if (allEnemiesDone && ents.waveActive) {
        ents.waveActive = false;
        // calc wave end stats
        const ammoLeft = gs.bases.reduce((s, b) => s + (b.alive ? b.ammo : 0), 0);
        const citiesSaved = gs.cities.filter(c => c.alive).length;
        const bonusScore = ammoLeft * 50 + citiesSaved * 200;
        gs.score += bonusScore;
        gs.researchCredits += citiesSaved * 25 + Math.floor(gs.waveStats.enemiesDestroyed * 5);
        gs.waveStats.ammoRemaining = ammoLeft;
        gs.waveStats.citiesSaved = citiesSaved;
        ents.waveEndScore = { bonusScore, ammoLeft, citiesSaved };

        // trucks
        const truckSpeed = gs.upgrades.fastTrucks ? 2.5 : 1.5;
        ents.trucks.push(new SupplyTruck(true, truckSpeed));
        if (gs.upgrades.truckArmor) ents.trucks[ents.trucks.length - 1].hp = 2;

        sceneChangeRef.current = { newScene: 'wave_end' };
      }
    }

    function updateAndDrawWaveEnd(ctx, gs, ents, tick) {
      // draw cities and bases
      gs.cities.forEach(city => drawCity(ctx, city, tick));
      gs.bases.forEach(base => drawBase(ctx, base, tick));
      ents.trucks.forEach(t => { t.update(); t.draw(ctx); });
      ents.explosions.forEach(e => { e.update(); e.draw(ctx); });
      ents.explosions = ents.explosions.filter(e => !e.dead);

      // overlay
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(180, 80, 440, 280);
      ctx.strokeStyle = COLORS.uiGreen;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 12;
      ctx.shadowColor = COLORS.uiGreen;
      ctx.strokeRect(180, 80, 440, 280);
      ctx.restore();

      drawPixelText(ctx, `WAVE ${gs.wave} COMPLETE`, W / 2, 120, 20, COLORS.uiGreen);
      const we = ents.waveEndScore || {};
      drawPixelText(ctx, `CITIES SAVED: ${we.citiesSaved || 0}`, W / 2, 160, 14, COLORS.city);
      drawPixelText(ctx, `AMMO REMAINING: ${we.ammoLeft || 0}`, W / 2, 185, 14, COLORS.uiGreen);
      drawPixelText(ctx, `ENEMIES DESTROYED: ${gs.waveStats.enemiesDestroyed}`, W / 2, 210, 14, COLORS.uiGreen);
      drawPixelText(ctx, `BONUS SCORE: +${we.bonusScore || 0}`, W / 2, 235, 14, COLORS.uiPink);
      drawPixelText(ctx, `TOTAL SCORE: ${gs.score}`, W / 2, 260, 16, COLORS.uiGreen);
      const blink = Math.floor(tick / 30) % 2 === 0;
      if (blink) drawPixelText(ctx, '[CLICK FOR UPGRADES]', W / 2, 330, 13, COLORS.uiPink);
    }

    function drawUpgradeCanvas(ctx, _tick) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,40,0.85)';
      ctx.fillRect(0, 0, W, H);
      drawPixelText(ctx, 'UPGRADE TERMINAL', W / 2, 30, 18, COLORS.uiGreen);
      drawPixelText(ctx, '[ React UI active — see panel ]', W / 2, H / 2, 13, COLORS.uiGreen);
      ctx.restore();
    }

    function drawCutscene(ctx, gs, ents, tick) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillRect(0, 0, W, H);
      const cs = ents.cutsceneData;
      if (!cs) { ctx.restore(); return; }

      // portrait box
      ctx.strokeStyle = COLORS.uiPink;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 12;
      ctx.shadowColor = COLORS.uiPink;
      ctx.strokeRect(60, 140, 200, 220);
      ctx.fillStyle = '#110022';
      ctx.fillRect(61, 141, 198, 218);
      drawPortrait(ctx, cs.character, 80, 160);
      drawPixelText(ctx, cs.name, 160, 390, 11, COLORS.uiPink);

      // dialogue box
      ctx.strokeStyle = COLORS.uiGreen;
      ctx.shadowColor = COLORS.uiGreen;
      ctx.strokeRect(280, 140, 460, 220);
      ctx.fillStyle = '#001100';
      ctx.fillRect(281, 141, 458, 218);

      ctx.font = '13px monospace';
      ctx.fillStyle = COLORS.uiGreen;
      ctx.textAlign = 'left';
      ctx.shadowBlur = 6;
      ctx.shadowColor = COLORS.uiGreen;
      const words = cs.text.split(' ');
      let line = '', ly = 175;
      words.forEach(w => {
        const test = line + w + ' ';
        if (ctx.measureText(test).width > 420) {
          ctx.fillText(line, 298, ly);
          line = w + ' ';
          ly += 22;
        } else {
          line = test;
        }
      });
      ctx.fillText(line, 298, ly);

      const blink = Math.floor(tick / 25) % 2 === 0;
      if (blink) {
        ctx.textAlign = 'right';
        ctx.fillStyle = COLORS.uiPink;
        ctx.fillText('[CLICK TO CONTINUE]', 728, 345);
      }
      ctx.restore();
    }

    function drawGameOver(ctx, tick) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(0, 0, W, H);
      // draw COMANDANTE portrait
      drawPortrait(ctx, 'comandante', W / 2 - 20, 80);
      const glitchX = Math.random() > 0.9 ? (Math.random() - 0.5) * 10 : 0;
      ctx.shadowBlur = 20 + 10 * Math.sin(tick * 0.1);
      ctx.shadowColor = '#ff0000';
      ctx.fillStyle = '#ff2222';
      ctx.font = 'bold 32px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', W / 2 + glitchX, 200);
      ctx.shadowColor = '#ff00ff';
      ctx.fillStyle = COLORS.uiPink;
      ctx.font = '14px monospace';
      ctx.fillText('"GAME OVER, COMMANDER."', W / 2, 240);
      ctx.fillText('"THE CANDLES ARE OUT."', W / 2, 262);
      ctx.fillStyle = COLORS.uiGreen;
      ctx.font = '13px monospace';
      ctx.fillText(`FINAL SCORE: ${gsRef.current.score}`, W / 2, 300);
      const blink = Math.floor(tick / 30) % 2 === 0;
      if (blink) {
        ctx.fillStyle = COLORS.uiGreen;
        ctx.fillText('[CLICK TO INSERT COIN]', W / 2, 340);
      }
      ctx.restore();
    }

    function drawVictory(ctx, gs, tick) {
      ctx.save();
      // fireworks particles
      if (tick % 20 === 0) {
        const fx = 100 + Math.random() * 600;
        const fy = 50 + Math.random() * 200;
        for (let i = 0; i < 20; i++) {
          entitiesRef.current.explosions.push(
            new Explosion(fx, fy, 20 + Math.random() * 30, COLORS.uiPink, COLORS.uiGreen, true)
          );
        }
      }
      entitiesRef.current.explosions.forEach(e => { e.update(); e.draw(ctx); });
      entitiesRef.current.explosions = entitiesRef.current.explosions.filter(e => !e.dead);

      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, W, H);
      ctx.shadowBlur = 20;
      ctx.shadowColor = COLORS.uiGreen;
      ctx.fillStyle = COLORS.uiGreen;
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('COMANDANTE.EXE HAS STOPPED', W / 2, 160);
      ctx.shadowColor = COLORS.city;
      ctx.fillStyle = COLORS.city;
      ctx.font = '16px monospace';
      ctx.fillText('CITIES SAVED. YOU ARE THE DEFENDER', W / 2, 210);
      ctx.fillText('OF THE NEON GRID.', W / 2, 232);
      ctx.shadowColor = COLORS.uiPink;
      ctx.fillStyle = COLORS.uiPink;
      ctx.font = 'bold 22px monospace';
      ctx.fillText(`FINAL SCORE: ${gs.score}`, W / 2, 280);
      ctx.fillStyle = COLORS.uiGreen;
      ctx.font = '13px monospace';
      const blink = Math.floor(tick / 30) % 2 === 0;
      if (blink) ctx.fillText('[CLICK TO PLAY AGAIN]', W / 2, 340);
      ctx.restore();
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []); // eslint-disable-line

  // handle clicks based on scene
  const handleClick = useCallback((e) => {
    const gs = gsRef.current;
    const ents = entitiesRef.current;

    if (gs.scene === 'title') {
      // start story scroll
      ents.storyScrollY = 0;
      ents.storyDone = false;
      gs.scene = 'story';
      setScene('story');
      // clear attract missiles
      ents.enemyMissiles = [];
      ents.explosions = [];
      return;
    }
    if (gs.scene === 'story') {
      ents.storyDone = true;
      gs.scene = 'playing';
      setScene('playing');
      startWave();
      return;
    }
    if (gs.scene === 'wave_end') {
      // go to cutscene or upgrade
      const w = gs.wave;
      const cutsceneWaves = [3, 6, 9, 12];
      if (cutsceneWaves.includes(w)) {
        const cutscenes = {
          3: {
            character: 'briggs', name: 'GEN. BRIGGS',
            text: 'Commander, COMANDANTE just broadcast on every channel: "YOUR CITIES SPARKLE LIKE CANDLES. I WILL BLOW THEM OUT." What a drama queen. Keep those bases armed.',
          },
          6: {
            character: 'pixel', name: 'DR. PIXEL',
            text: 'Bad news, Commander. COMANDANTE has hacked our decoy missile codes. Those fakes in the sky? That\'s our own tech turned against us. I\'m working on a countermeasure. Buy me time.',
          },
          9: {
            character: 'briggs', name: 'GEN. BRIGGS',
            text: 'The EMP strikes are frying our systems. COMANDANTE is adapting. It said — and I quote — "I HAVE LEARNED YOUR PATTERNS, COMMANDER. YOU ARE PREDICTABLE." Rude. Prove it wrong.',
          },
          12: {
            character: 'pixel', name: 'DR. PIXEL',
            text: 'I\'ve located COMANDANTE\'s core — it\'s transmitting from an orbital satellite. If we survive long enough, I can upload a virus. Just... don\'t let the cities fall.',
          },
        };
        ents.cutsceneData = cutscenes[w];
        gs.scene = 'cutscene';
        setScene('cutscene');
      } else {
        gs.scene = 'upgrade';
        setScene('upgrade');
      }
      return;
    }
    if (gs.scene === 'cutscene') {
      gs.scene = 'upgrade';
      setScene('upgrade');
      return;
    }
    if (gs.scene === 'gameover') {
      // restart
      gsRef.current = createInitialState();
      entitiesRef.current = {
        playerMissiles: [], enemyMissiles: [], explosions: [],
        aircraft: [], trucks: [], alerts: [], pendingEnemies: [],
        waveActive: false, waveEndTimer: 0, spawnTimer: 0,
        storyScrollY: 0, storyDone: false, cutsceneStep: 0,
        crosshair: { x: W / 2, y: H / 2 },
        truckSpawnPending: false, trucksDone: false,
        waveEndScore: null, ammoDrops: [],
      };
      gs.scene = 'title';
      setScene('title');
      return;
    }
    if (gs.scene === 'victory') {
      gsRef.current = createInitialState();
      entitiesRef.current = {
        playerMissiles: [], enemyMissiles: [], explosions: [],
        aircraft: [], trucks: [], alerts: [], pendingEnemies: [],
        waveActive: false, waveEndTimer: 0, spawnTimer: 0,
        storyScrollY: 0, storyDone: false, cutsceneStep: 0,
        crosshair: { x: W / 2, y: H / 2 },
        truckSpawnPending: false, trucksDone: false,
        waveEndScore: null, ammoDrops: [],
      };
      gsRef.current.scene = 'title';
      setScene('title');
      return;
    }
    if (gs.scene === 'playing') {
      handleCanvasClick(e);
    }
  }, [handleCanvasClick, startWave]);

  // React UI for upgrade screen
  const deployWave = useCallback(() => {
    const gs = gsRef.current;
    const ents = entitiesRef.current;
    gs.wave++;
    // restore ammo (extra ammo upgrade)
    const baseAmmo = STARTING_AMMO + gs.upgrades.extraAmmo * 3;
    gs.bases.forEach(b => { if (b.alive) b.ammo = baseAmmo; });
    // clear trucks
    ents.trucks = [];
    gs.scene = 'playing';
    setScene('playing');
    startWave();
    // victory at wave 15
    if (gs.wave > 15) {
      setTimeout(() => {
        gsRef.current.scene = 'victory';
        setScene('victory');
      }, 3000);
    }
  }, [startWave]);

  const buyUpgrade = useCallback((key, cost, maxLevel = 1) => {
    const gs = gsRef.current;
    if (gs.researchCredits < cost) return;
    const cur = gs.upgrades[key];
    if (typeof cur === 'boolean') {
      if (cur) return;
      gs.upgrades[key] = true;
    } else {
      if (cur >= maxLevel) return;
      gs.upgrades[key] = cur + 1;
    }
    gs.researchCredits -= cost;
    // apply upgrade effects
    if (key === 'autoTurret') {
      gs.bases.forEach(b => { if (b.alive) b.autoTurret = true; });
    }
    if (key === 'baseArmor') {
      gs.bases.forEach(b => { if (b.alive) { b.hasArmor = true; b.armored = false; } });
    }
    if (key === 'cityShield') {
      // shield first unshielded city
      const c = gs.cities.find(c => c.alive && !c.shielded);
      if (c) c.shielded = true;
    }
    if (key === 'decoyCity') {
      // add a decoy city
      const dc = gs.cities.find(c => !c.alive);
      if (dc) { dc.alive = true; dc.isDecoy = true; }
    }
    setUiData({ ts: Date.now() }); // force re-render
  }, []);

  const rebuildCity = useCallback(() => {
    const gs = gsRef.current;
    const cost = 1500;
    if (gs.researchCredits < cost) return;
    const c = gs.cities.find(c => !c.alive && !c.isDecoy);
    if (!c) return;
    gs.researchCredits -= cost;
    c.alive = true;
    c.shielded = false;
    setUiData({ ts: Date.now() });
  }, []);

  const rebuildBase = useCallback(() => {
    const gs = gsRef.current;
    const cost = 1000;
    if (gs.researchCredits < cost) return;
    const b = gs.bases.find(b => !b.alive);
    if (!b) return;
    gs.researchCredits -= cost;
    b.alive = true;
    b.ammo = STARTING_AMMO + gs.upgrades.extraAmmo * 3;
    setUiData({ ts: Date.now() });
  }, []);

  return (
    <div style={{
      background: '#000',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'monospace',
      userSelect: 'none',
    }}>
      {/* Canvas */}
      <div style={{ position: 'relative' }}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          style={{
            display: 'block',
            maxWidth: '100vw',
            cursor: scene === 'playing' ? 'crosshair' : 'pointer',
            border: '2px solid #ff00ff',
            boxShadow: '0 0 30px #ff00ff88, 0 0 60px #00ffff44',
          }}
          onClick={handleClick}
          onMouseMove={handleCanvasMouseMove}
        />

        {/* Title screen buttons overlay */}
        {scene === 'title' && (
          <div style={{
            position: 'absolute',
            bottom: 80,
            left: 0, right: 0,
            display: 'flex',
            gap: 20,
            justifyContent: 'center',
          }}>
            <NeonButton onClick={handleClick} color="#ff00ff">START GAME</NeonButton>
            <NeonButton onClick={() => { gsRef.current.scene = 'howto'; setScene('howto'); }} color="#00ffff">HOW TO PLAY</NeonButton>
          </div>
        )}
      </div>

      {/* How to Play overlay */}
      {scene === 'howto' && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,20,0.95)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100,
        }}>
          <div style={{
            border: '2px solid #00ffff',
            boxShadow: '0 0 20px #00ffff',
            padding: 40,
            maxWidth: 520,
            color: '#33ff33',
            fontFamily: 'monospace',
          }}>
            <div style={{ color: '#ff00ff', fontSize: 22, marginBottom: 20, textShadow: '0 0 10px #ff00ff' }}>
              HOW TO PLAY
            </div>
            <HowToEntry icon="🖱️" text="CLICK anywhere above ground to launch a missile from the nearest base." />
            <HowToEntry icon="💥" text="Your missiles explode at the clicked point — detonate near enemies to destroy them." />
            <HowToEntry icon="🏙️" text="Protect your 6 CITIES. Game over when all cities are destroyed." />
            <HowToEntry icon="🚀" text="3 MISSILE BASES supply your ammo. Protect them — destroyed bases can't fire." />
            <HowToEntry icon="🚛" text="SUPPLY TRUCKS cross the map between waves, resupplying your bases. Protect them!" />
            <HowToEntry icon="⚡" text="Beware EMP warheads — they disable bases. MIRV missiles split mid-flight!" />
            <HowToEntry icon="🔬" text="Spend RESEARCH CREDITS on upgrades between waves." />
            <HowToEntry icon="💾" text="Survive 15 waves to defeat COMANDANTE." />
            <NeonButton
              style={{ marginTop: 24, width: '100%' }}
              onClick={() => { gsRef.current.scene = 'title'; setScene('title'); }}
              color="#ff00ff"
            >
              BACK
            </NeonButton>
          </div>
        </div>
      )}

      {/* UPGRADE SCREEN */}
      {scene === 'upgrade' && (
        <UpgradeScreen
          gs={gsRef.current}
          onDeploy={deployWave}
          onBuy={buyUpgrade}
          onRebuildCity={rebuildCity}
          onRebuildBase={rebuildBase}
          uiData={uiData}
        />
      )}
    </div>
  );
}

// === UI COMPONENTS ===
function NeonButton({ onClick, color = '#33ff33', children, style }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? color + '22' : 'transparent',
        border: `2px solid ${color}`,
        color: color,
        fontFamily: 'monospace',
        fontSize: 14,
        padding: '10px 24px',
        cursor: 'pointer',
        letterSpacing: 2,
        boxShadow: hov ? `0 0 16px ${color}` : `0 0 6px ${color}66`,
        transition: 'all 0.15s',
        textShadow: `0 0 8px ${color}`,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function HowToEntry({ icon, text }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 18, minWidth: 28 }}>{icon}</span>
      <span style={{ fontSize: 13, lineHeight: 1.5, color: '#aaffaa' }}>{text}</span>
    </div>
  );
}

function UpgradeScreen({ gs, onDeploy, onBuy, onRebuildCity, onRebuildBase }) {
  const [, forceUpdate] = useState(0);
  const refresh = () => forceUpdate(n => n + 1);
  const cr = gs.researchCredits;

  const UpgradeBtn = ({ label, desc, cost, upKey, maxLevel = 1, onBuyFn }) => {
    const cur = gs.upgrades[upKey];
    const isBool = typeof cur === 'boolean';
    const atMax = isBool ? cur : cur >= maxLevel;
    const canAfford = cr >= cost;
    const handleBuy = () => { (onBuyFn || onBuy)(upKey, cost, maxLevel); refresh(); };
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 0', borderBottom: '1px solid #003300',
      }}>
        <div>
          <span style={{ color: '#33ff33', fontSize: 13 }}>{label}</span>
          {!isBool && <span style={{ color: '#007700', fontSize: 11, marginLeft: 8 }}>
            [{cur}/{maxLevel}]
          </span>}
          <div style={{ color: '#555', fontSize: 11 }}>{desc}</div>
        </div>
        <button
          onClick={handleBuy}
          disabled={atMax || !canAfford}
          style={{
            background: 'transparent',
            border: `1px solid ${atMax ? '#333' : canAfford ? '#33ff33' : '#664400'}`,
            color: atMax ? '#333' : canAfford ? '#33ff33' : '#664400',
            fontFamily: 'monospace',
            fontSize: 11,
            padding: '4px 10px',
            cursor: atMax ? 'default' : canAfford ? 'pointer' : 'not-allowed',
            minWidth: 80,
          }}
        >
          {atMax ? 'MAXED' : `${cost} CR`}
        </button>
      </div>
    );
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,5,0,0.97)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', zIndex: 200,
      fontFamily: 'monospace',
    }}>
      <div style={{ width: 780, maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{
          borderBottom: '2px solid #33ff33',
          paddingBottom: 12, marginBottom: 16,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ color: '#ff00ff', fontSize: 20, textShadow: '0 0 10px #ff00ff' }}>
              ▌UPGRADE TERMINAL ▐
            </div>
            <div style={{ color: '#33ff33', fontSize: 12, marginTop: 4 }}>
              WAVE {gs.wave} COMPLETE — PREPARING WAVE {gs.wave + 1}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#ff3399', fontSize: 18, textShadow: '0 0 8px #ff3399' }}>
              {cr} CR
            </div>
            <div style={{ color: '#666', fontSize: 11 }}>RESEARCH CREDITS</div>
            <div style={{ color: '#33ff33', fontSize: 14, marginTop: 4 }}>
              SCORE: {gs.score}
            </div>
          </div>
        </div>

        {/* Status */}
        <div style={{
          display: 'flex', gap: 20, marginBottom: 16,
          padding: '8px 12px', border: '1px solid #002200', background: '#001100',
        }}>
          <div style={{ color: '#00ffcc' }}>
            CITIES: {gs.cities.map((c, i) => (
              <span key={i} style={{ marginLeft: 4, color: c.alive ? (c.isDecoy ? '#888800' : '#00ffcc') : '#330033' }}>
                {c.alive ? (c.shielded ? '🛡' : c.isDecoy ? '◇' : '▲') : '✕'}
              </span>
            ))}
          </div>
          <div style={{ color: '#00ff66' }}>
            BASES: {gs.bases.map((b, i) => (
              <span key={i} style={{ marginLeft: 4, color: b.alive ? '#00ff66' : '#330000' }}>
                {b.alive ? `[${b.ammo}]` : '[✕]'}
              </span>
            ))}
          </div>
        </div>

        {/* Upgrade grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* WEAPONS */}
          <UpgradePanel title="⚔ WEAPONS LAB">
            <UpgradeBtn label="BLAST RADIUS+"     desc="+20% explosion radius" cost={500} upKey="blastRadius" maxLevel={3} />
            <UpgradeBtn label="MISSILE SPEED+"    desc="Player missiles travel faster" cost={400} upKey="missileSpeed" maxLevel={3} />
            <UpgradeBtn label="CHAIN REACTION"    desc="25% chance secondary explosion" cost={1500} upKey="chainReaction" />
            <UpgradeBtn label="DUAL WARHEAD"      desc="Each missile detonates twice" cost={2000} upKey="dualWarhead" />
            <UpgradeBtn label="AUTO-TURRET"       desc="Bases auto-fire at threats every 4s" cost={3000} upKey="autoTurret" />
          </UpgradePanel>

          {/* DEFENSE */}
          <UpgradePanel title="🛡 DEFENSE LAB">
            <UpgradeBtn label="CITY SHIELD"       desc="Shield on one city (absorbs 1 hit)" cost={800} upKey="cityShield" maxLevel={6} />
            <UpgradeBtn label="BASE ARMOR"        desc="Bases survive one direct hit" cost={600} upKey="baseArmor" />
            <UpgradeBtn label="EMP HARDENING"     desc="EMP recovery: 10s → 3s" cost={1000} upKey="empHardening" />
            <UpgradeBtn label="DECOY CITY"        desc="Holographic city attracts missiles" cost={1200} upKey="decoyCity" />
          </UpgradePanel>

          {/* LOGISTICS */}
          <UpgradePanel title="🚛 LOGISTICS">
            <UpgradeBtn label="EXTRA AMMO"        desc="+3 starting ammo per base" cost={300} upKey="extraAmmo" maxLevel={4} />
            <UpgradeBtn label="TRUCK ARMOR"       desc="Supply trucks survive one hit" cost={700} upKey="truckArmor" />
            <UpgradeBtn label="FAST TRUCKS"       desc="Trucks move 50% faster" cost={500} upKey="fastTrucks" />
            <UpgradeBtn label="TRUCK CAPACITY+"   desc="Trucks deliver +3 extra missiles/stop" cost={600} upKey="truckCapacity" maxLevel={3} />
          </UpgradePanel>

          {/* REBUILD */}
          <UpgradePanel title="🔧 REBUILD">
            <div style={{ padding: '6px 0', borderBottom: '1px solid #003300', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ color: '#33ff33', fontSize: 13 }}>REBUILD CITY</span>
                <div style={{ color: '#555', fontSize: 11 }}>Restore one destroyed city</div>
                <div style={{ color: '#666', fontSize: 11 }}>
                  Destroyed: {gs.cities.filter(c => !c.alive && !c.isDecoy).length}
                </div>
              </div>
              <button onClick={() => { onRebuildCity(); refresh(); }} disabled={cr < 1500 || !gs.cities.some(c => !c.alive && !c.isDecoy)}
                style={{ background: 'transparent', border: '1px solid #33ff33', color: '#33ff33', fontFamily: 'monospace', fontSize: 11, padding: '4px 10px', cursor: 'pointer', minWidth: 80 }}>
                1500 CR
              </button>
            </div>
            <div style={{ padding: '6px 0', borderBottom: '1px solid #003300', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ color: '#33ff33', fontSize: 13 }}>REBUILD BASE</span>
                <div style={{ color: '#555', fontSize: 11 }}>Restore one destroyed missile base</div>
                <div style={{ color: '#666', fontSize: 11 }}>
                  Destroyed: {gs.bases.filter(b => !b.alive).length}
                </div>
              </div>
              <button onClick={() => { onRebuildBase(); refresh(); }} disabled={cr < 1000 || !gs.bases.some(b => !b.alive)}
                style={{ background: 'transparent', border: '1px solid #33ff33', color: '#33ff33', fontFamily: 'monospace', fontSize: 11, padding: '4px 10px', cursor: 'pointer', minWidth: 80 }}>
                1000 CR
              </button>
            </div>
          </UpgradePanel>
        </div>

        {/* Deploy */}
        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <NeonButton onClick={onDeploy} color="#ff00ff" style={{ fontSize: 16, padding: '14px 60px', letterSpacing: 4 }}>
            ▶ DEPLOY WAVE {gs.wave + 1}
          </NeonButton>
        </div>
      </div>
    </div>
  );
}

function UpgradePanel({ title, children }) {
  return (
    <div style={{
      border: '1px solid #003300',
      background: '#000800',
      padding: 14,
    }}>
      <div style={{ color: '#ff3399', fontSize: 13, marginBottom: 10, textShadow: '0 0 8px #ff3399' }}>
        {title}
      </div>
      {children}
    </div>
  );
}
