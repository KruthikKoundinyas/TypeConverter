const CELL = 20;
const TICK_MS = 100;
const DOT_SPEED = 1.5;
const DOT_R = CELL * 0.4;
const AUTOPILOT_RESUME = 3000;

let canvas, ctx;
let snake, dir, nextDir;
let dotPos, dotVel;
let visited;
let cols, rows, totalCells;
let tickTimer, frameId;
let score;
let userOverride = false;
let userTimer = null;
let shDark, shLight, accent;

export function initSnakeGame() {
  canvas = document.createElement('canvas');
  canvas.style.cssText =
    'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:-1;';
  document.body.prepend(canvas);
  ctx = canvas.getContext('2d');

  onResize();
  window.addEventListener('resize', onResize);
  document.addEventListener('keydown', handleKey);

  const cx = Math.floor(cols / 2);
  const cy = Math.floor(rows / 2);
  snake = [{ x: cx, y: cy }];
  dir = { x: 1, y: 1 };
  nextDir = { x: 1, y: 1 };
  score = 0;
  visited = new Set([ck(cx, cy)]);

  spawnDot();
  refreshColors();

  tickTimer = setInterval(tick, TICK_MS);
  frameId = requestAnimationFrame(render);
}

function onResize() {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  cols = Math.floor(canvas.width / CELL);
  rows = Math.floor(canvas.height / CELL);
  totalCells = cols * rows;
}

function ck(x, y) {
  return (x << 16) | y;
}

function refreshColors() {
  const s = getComputedStyle(document.documentElement);
  shDark = s.getPropertyValue('--sh-dark').trim() || '#c8c2ba';
  shLight = s.getPropertyValue('--sh-light').trim() || '#ffffff';
  accent = s.getPropertyValue('--accent').trim() || '#5b5ef0';
}

function handleKey(e) {
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  const k = e.key;
  let changed = false;

  if ((k === 'ArrowUp' || k === 'w' || k === 'W') && dir.y !== 1) {
    nextDir = { x: 0, y: -1 }; changed = true;
  } else if ((k === 'ArrowDown' || k === 's' || k === 'S') && dir.y !== -1) {
    nextDir = { x: 0, y: 1 }; changed = true;
  } else if ((k === 'ArrowLeft' || k === 'a' || k === 'A') && dir.x !== 1) {
    nextDir = { x: -1, y: 0 }; changed = true;
  } else if ((k === 'ArrowRight' || k === 'd' || k === 'D') && dir.x !== -1) {
    nextDir = { x: 1, y: 0 }; changed = true;
  }

  if (changed) {
    userOverride = true;
    clearTimeout(userTimer);
    userTimer = setTimeout(() => { userOverride = false; }, AUTOPILOT_RESUME);
  }
}

function autoPilot() {
  const h = snake[0];

  const try_dir = (dx, dy) => {
    const nx = (h.x + dx + cols) % cols;
    const ny = (h.y + dy + rows) % rows;
    return !visited.has(ck(nx, ny));
  };

  if (try_dir(1, 1))  return { x: 1, y: 1 };
  if (try_dir(0, 1))  return { x: 0, y: 1 };
  if (try_dir(1, 0))  return { x: 1, y: 0 };
  if (try_dir(-1, 1)) return { x: -1, y: 1 };
  if (try_dir(1, -1)) return { x: 1, y: -1 };
  if (try_dir(0, -1)) return { x: 0, y: -1 };
  if (try_dir(-1, 0)) return { x: -1, y: 0 };
  if (try_dir(-1, -1)) return { x: -1, y: -1 };

  return { x: 1, y: 1 };
}

function spawnDot() {
  const m = CELL * 2;
  dotPos = {
    x: Math.random() * (cols * CELL - m * 2) + m,
    y: Math.random() * (rows * CELL - m * 2) + m,
  };
  const a = Math.random() * Math.PI * 2;
  dotVel = { x: Math.cos(a) * DOT_SPEED, y: Math.sin(a) * DOT_SPEED };
}

function tick() {
  refreshColors();

  if (userOverride) {
    dir = { ...nextDir };
  } else {
    dir = autoPilot();
    nextDir = { ...dir };
  }

  const h = snake[0];
  const nh = {
    x: (h.x + dir.x + cols) % cols,
    y: (h.y + dir.y + rows) % rows,
  };
  snake.unshift(nh);
  visited.add(ck(nh.x, nh.y));

  const dcx = Math.floor(dotPos.x / CELL);
  const dcy = Math.floor(dotPos.y / CELL);
  if (nh.x === dcx && nh.y === dcy) {
    score++;
    spawnDot();
  } else {
    snake.pop();
  }

  if (visited.size >= totalCells) {
    achieve();
    reset();
  }
}

function reset() {
  const cx = Math.floor(cols / 2);
  const cy = Math.floor(rows / 2);
  snake = [{ x: cx, y: cy }];
  dir = { x: 1, y: 1 };
  nextDir = { x: 1, y: 1 };
  visited = new Set([ck(cx, cy)]);
  score = 0;
  userOverride = false;
}

function achieve() {
  const el = document.createElement('div');
  el.style.cssText =
    'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(0);'
    + 'background:rgba(0,0,0,0.9);color:' + accent + ';padding:2rem 3rem;'
    + 'border-radius:16px;font-family:system-ui,sans-serif;font-size:1.5rem;'
    + 'font-weight:700;z-index:99999;text-align:center;'
    + 'box-shadow:0 0 60px ' + accent + '44;pointer-events:none;'
    + 'transition:transform .4s cubic-bezier(.34,1.56,.64,1),opacity .5s;';
  el.innerHTML =
    '<div style="font-size:3rem;margin-bottom:.5rem">\u{1F40D}</div>'
    + '<div>VIEWPORT CLEARED</div>'
    + '<div style="font-size:.85rem;color:#888;margin-top:.5rem">'
    + score + ' dots consumed</div>';
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.transform = 'translate(-50%,-50%) scale(1)'; });
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 600);
  }, 3000);
}

function render() {
  dotPos.x += dotVel.x;
  dotPos.y += dotVel.y;
  const maxX = cols * CELL - DOT_R;
  const maxY = rows * CELL - DOT_R;
  if (dotPos.x <= DOT_R || dotPos.x >= maxX) {
    dotVel.x *= -1;
    dotPos.x = Math.max(DOT_R, Math.min(maxX, dotPos.x));
  }
  if (dotPos.y <= DOT_R || dotPos.y >= maxY) {
    dotVel.y *= -1;
    dotPos.y = Math.max(DOT_R, Math.min(maxY, dotPos.y));
  }

  draw();
  frameId = requestAnimationFrame(render);
}

function groove(px, py, s, alpha) {
  const e = 2;

  ctx.globalAlpha = alpha;
  ctx.fillStyle = shDark;
  ctx.fillRect(px, py, s, e);
  ctx.fillRect(px, py, e, s);

  ctx.fillStyle = shLight;
  ctx.fillRect(px, py + s - e, s, e);
  ctx.fillRect(px + s - e, py, e, s);

  ctx.globalAlpha = alpha * 0.5;
  ctx.fillStyle = shDark;
  ctx.fillRect(px + e, py + e, s - e * 2, s - e * 2);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const s = CELL - 1;

  for (const k of visited) {
    groove((k >> 16) * CELL, (k & 0xFFFF) * CELL, s, 0.12);
  }

  for (let i = 1; i < snake.length; i++) {
    groove(snake[i].x * CELL, snake[i].y * CELL, s, 0.28);
  }

  groove(snake[0].x * CELL, snake[0].y * CELL, s, 0.45);

  ctx.globalAlpha = 0.35;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(dotPos.x, dotPos.y, DOT_R, 0, Math.PI * 2);
  ctx.fill();

  const pct = Math.floor((visited.size / totalCells) * 100);
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = shDark;
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(pct + '%', canvas.width - 10, 18);

  ctx.globalAlpha = 1;
}
