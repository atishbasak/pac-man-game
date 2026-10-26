(() => {
  const MAP = [
    "###################",
    "#........#........#",
    "#o##.###.#.###.##o#",
    "#.................#",
    "#.##.#.#####.#.##.#",
    "#....#...#...#....#",
    "####.### # ###.####",
    "####.#       #.####",
    "####.# ##-## #.####",
    "    .  #   #  .    ",
    "####.# ##### #.####",
    "####.#       #.####",
    "####.# ##### #.####",
    "#........#........#",
    "#.##.###.#.###.##.#",
    "#o.#.....P.....#.o#",
    "##.#.#.#####.#.#.##",
    "#....#...#...#....#",
    "#.######.#.######.#",
    "#.................#",
    "###################"];
  const W = 19, H = 21, TR = 9, $ = s => document.querySelector(s);
  const cv = $('#cv'), board = $('#board'), stage = $('#stage'), ov = $('#ov'), ic = $('#ic'), ictx = ic.getContext('2d'), cap = $('#cap');
  let ctx = cv.getContext('2d'), ts = 20, mzB, mzW, capT = '';
  const cell = (c, r) => (r === TR && (c < 0 || c >= W)) ? ' ' : (r < 0 || r >= H || c < 0 || c >= W) ? '#' : MAP[r][c];
  const free = (c, r, door) => { const ch = cell(c, r); return ch !== '#' && (ch !== '-' || door) };
  const D4 = [[0, -1], [-1, 0], [0, 1], [1, 0]];
  const G = { state: 'menu', score: 0, high: 0, lives: 3, level: 1, t: 0, dots: 0, scatter: true, modeT: 0, modeI: 0, fright: 0, combo: 200, timer: 0, pops: [], parts: [], tr: [], extra: false, w: 0 };
  try { G.high = +localStorage.getItem('pac_hi') || 0 } catch (e) { }
  let pel = [], P, want = { dx: -1, dy: 0 }, ghosts = [];
  const COL = ['#ff2a2a', '#ffb8de', '#00e5ff', '#ffa63d'], CORN = [[17, 0], [1, 0], [17, 20], [1, 20]], SEQ = [7, 20, 7, 20, 5, 20, 5, 1e9];
  /* BFS distances to ghost house door (for eaten ghosts) */
  const bfs = new Int16Array(W * H).fill(-1);
  { const q = [[9, 7]]; bfs[7 * W + 9] = 0; for (let i = 0; i < q.length; i++) { const [c, r] = q[i]; for (const [a, b] of D4) { const nc = c + a, nr = r + b; if (nc < 0 || nc >= W || nr < 0 || nr >= H) continue; if (free(nc, nr, true) && bfs[nr * W + nc] < 0) { bfs[nr * W + nc] = bfs[r * W + c] + 1; q.push([nc, nr]) } } } }

  /* ---------- background + particles + effects ---------- */
  const bg = $('#bg'), bx = bg.getContext('2d'); let bgi = [];
  function bgInit() { bg.width = innerWidth; bg.height = innerHeight; bgi = Array.from({ length: Math.min(30, innerWidth / 28 | 0) }, (_, i) => ({ x: Math.random() * bg.width, y: Math.random() * bg.height, v: 10 + Math.random() * 30, s: 5 + Math.random() * 9, k: i % 8, p: Math.random() * 6 })) }
  function bgDraw(dt) {
    bx.clearRect(0, 0, bg.width, bg.height); bx.globalAlpha = .4; bx.shadowBlur = 14;
    for (const o of bgi) {
      o.x += o.v * dt; if (o.x > bg.width + 30) o.x = -30; const y = o.y + Math.sin(G.t * 1.2 + o.p) * 10;
      if (o.k < 4) { bx.fillStyle = bx.shadowColor = COL[o.k]; bx.beginPath(); bx.arc(o.x, y, o.s, Math.PI, 0); bx.lineTo(o.x + o.s, y + o.s); bx.lineTo(o.x + o.s / 2, y + o.s * .6); bx.lineTo(o.x, y + o.s); bx.lineTo(o.x - o.s / 2, y + o.s * .6); bx.lineTo(o.x - o.s, y + o.s); bx.fill() }
      else if (o.k < 6) { const m = .1 + .5 * Math.abs(Math.sin(G.t * 6 + o.p)); bx.fillStyle = bx.shadowColor = '#ffd400'; bx.beginPath(); bx.moveTo(o.x, y); bx.arc(o.x, y, o.s, m, 6.283 - m); bx.fill() }
      else { bx.fillStyle = bx.shadowColor = '#ffe3b8'; bx.beginPath(); bx.arc(o.x, y, o.s * .3, 0, 7); bx.fill() }
    }
    bx.globalAlpha = 1; bx.shadowBlur = 0;
  }
  function burst(x, y, c, n, s) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = s * (.3 + Math.random() * .7), t = .5 + Math.random() * .4; G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t, l: t, c }) } }
  function banner(t) { const b = $('#banner'); b.textContent = t; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show') }
  function shake() { board.classList.remove('shake'); void board.offsetWidth; board.classList.add('shake') }
  /* ---------- audio ---------- */
  let ac, muted = false;
  function beep(f, d, type, v, slide) { if (muted) return; try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); const o = ac.createOscillator(), g = ac.createGain(), n = ac.currentTime; o.type = type || 'square'; o.frequency.setValueAtTime(f, n); if (slide) o.frequency.exponentialRampToValueAtTime(slide, n + d); g.gain.setValueAtTime(v || .04, n); g.gain.exponentialRampToValueAtTime(.001, n + d); o.connect(g); g.connect(ac.destination); o.start(); o.stop(n + d) } catch (e) { } }

  /* ---------- setup ---------- */
  function newLevel() { pel = []; G.dots = 0; for (let r = 0; r < H; r++)for (let c = 0; c < W; c++) { const ch = MAP[r][c]; pel[r * W + c] = ch === '.' ? 1 : ch === 'o' ? 2 : 0; if (ch === '.' || ch === 'o') G.dots++ } }
  function resetActors() {
    P = { x: 9, y: 15, dx: 0, dy: 0, fx: -1, fy: 0 }; G.tr = []; want = { dx: -1, dy: 0 }; G.fright = 0; G.scatter = true; G.modeI = 0; G.modeT = 0;
    const S = [[9, 7, 'normal', 0], [9, 9, 'house', 1.2], [8, 9, 'house', 4], [10, 9, 'house', 7]];
    ghosts = S.map((s, i) => ({ id: i, x: s[0], y: s[1], dx: i ? 0 : -1, dy: 0, state: s[2], rel: s[3] / (1 + .12 * (G.level - 1)), fr: false }));
  }
  function startGame() { G.score = 0; G.lives = 3; G.level = 1; G.extra = false; G.pops = []; newLevel(); resetActors(); G.state = 'ready'; G.timer = 2; ov.classList.add('hide'); hud(); banner('LEVEL 1'); beep(440, .15); setTimeout(() => beep(660, .15), 150); setTimeout(() => beep(880, .25), 300) }
  function hud() { $('#sc').textContent = G.score; $('#hi').textContent = G.high; $('#lv').textContent = G.level; $('#lives').innerHTML = '<i class="life"></i>'.repeat(Math.max(0, G.lives)) }
  function add(n) { G.score += n; if (n >= 50) { const s = $('#sc'); s.classList.remove('bump'); void s.offsetWidth; s.classList.add('bump') } if (G.score > G.high) { G.high = G.score; try { localStorage.setItem('pac_hi', G.high) } catch (e) { } } if (!G.extra && G.score >= 10000) { G.extra = true; G.lives++; beep(900, .3) } hud() }
  function showOv(title, txt, btn) { $('#intro').style.display = 'none'; ov.querySelector('h1').textContent = title; ov.querySelector('p').innerHTML = txt; $('#go').textContent = btn; ov.classList.remove('hide') }
  const pacSpeed = () => 7.2 * (1 + .03 * Math.min(G.level - 1, 8));

  /* ---------- movement ---------- */
  function move(e, dist, decide, door) {
    let guard = 0;
    while (dist > 1e-9 && guard++ < 10) {
      if (Math.abs(e.x - Math.round(e.x)) < 1e-6 && Math.abs(e.y - Math.round(e.y)) < 1e-6) {
        e.x = Math.round(e.x); e.y = Math.round(e.y); decide(e);
        if (!e.dx && !e.dy) return;
        if (!free(e.x + e.dx, e.y + e.dy, door)) { e.dx = e.dy = 0; return }
      }
      let d;
      if (e.dx > 0) d = Math.ceil(e.x + 1e-6) - e.x; else if (e.dx < 0) d = e.x - Math.floor(e.x - 1e-6);
      else if (e.dy > 0) d = Math.ceil(e.y + 1e-6) - e.y; else d = e.y - Math.floor(e.y - 1e-6);
      const m = Math.min(d, dist);
      e.x += e.dx * m; e.y += e.dy * m; dist -= m;
      if (m === d) { e.x = Math.round(e.x); e.y = Math.round(e.y) }
      if (e.x < -.5) e.x += W; else if (e.x > W - .5) e.x -= W;
    }
  }
  function pacDecide(p) { if ((want.dx || want.dy) && free(p.x + want.dx, p.y + want.dy, false)) { p.dx = want.dx; p.dy = want.dy } }
  function pacUpdate(dt) {
    /* responsive turning: reverse anytime, pre-turn / late-turn within 0.35 tile of a junction */
    if ((want.dx || want.dy) && (P.dx || P.dy) && !(want.dx === P.dx && want.dy === P.dy)) {
      if (want.dx === -P.dx && want.dy === -P.dy) { P.dx = want.dx; P.dy = want.dy }
      else {
        const h = P.dx !== 0, v = h ? P.x : P.y, c = Math.round(v);
        if (c >= 0 && c < (h ? W : H) && Math.abs(v - c) <= .35 && free(h ? c + want.dx : P.x + want.dx, h ? P.y + want.dy : c + want.dy, false)) { if (h) P.x = c; else P.y = c; P.dx = want.dx; P.dy = want.dy }
      }
    }
    move(P, pacSpeed() * dt, pacDecide, false);
    if (P.dx || P.dy) { P.fx = P.dx; P.fy = P.dy }
  }
  function target(g) {
    if (G.scatter) return CORN[g.id];
    if (g.id === 0) return [P.x, P.y];
    if (g.id === 1) return [P.x + P.fx * 4, P.y + P.fy * 4];
    if (g.id === 2) { const b = ghosts[0]; return [2 * (P.x + P.fx * 2) - b.x, 2 * (P.y + P.fy * 2) - b.y] }
    return Math.hypot(g.x - P.x, g.y - P.y) > 6 ? [P.x, P.y] : CORN[3];
  }
  function ghostDecide(g) {
    const door = g.state === 'eaten';
    let opts = D4.filter(([a, b]) => free(g.x + a, g.y + b, door));
    if (door) {
      if (bfs[g.y * W + g.x] === 0) { g.dx = g.dy = 0; return }
      let best = null, bd = 1e9; for (const [a, b] of opts) { const c = g.x + a, r = g.y + b; if (c < 0 || c >= W) continue; const d = bfs[r * W + c]; if (d >= 0 && d < bd) { bd = d; best = [a, b] } }
      if (best) { g.dx = best[0]; g.dy = best[1] } return;
    }
    const nr = opts.filter(([a, b]) => !(a === -g.dx && b === -g.dy)); if (nr.length) opts = nr;
    if (!opts.length) { g.dx = g.dy = 0; return }
    let pick;
    if (g.fr) pick = opts[Math.random() * opts.length | 0];
    else { const t = target(g); let bd = 1e9; for (const o of opts) { const d = (g.x + o[0] - t[0]) ** 2 + (g.y + o[1] - t[1]) ** 2; if (d < bd) { bd = d; pick = o } } }
    g.dx = pick[0]; g.dy = pick[1];
  }
  function ghostUpdate(g, dt) {
    const ps = pacSpeed();
    if (g.state === 'house') { g.y = 9 + Math.sin(G.t * 7 + g.id) * .12; g.rel -= dt; if (g.rel <= 0) { g.state = 'leave'; g.y = 9 } return }
    if (g.state === 'leave') { const s = 3.2 * dt; if (Math.abs(g.x - 9) > .01) g.x += Math.sign(9 - g.x) * Math.min(s, Math.abs(9 - g.x)); else { g.x = 9; g.y -= s; if (g.y <= 7) { g.y = 7; g.state = 'normal'; g.dx = Math.random() < .5 ? -1 : 1; g.dy = 0 } } return }
    if (g.state === 'enter') { g.x = 9; g.y += 6 * dt; if (g.y >= 9) { g.y = 9; g.state = 'leave' } return }
    if (g.state === 'eaten' && g.x === 9 && g.y === 7) { g.state = 'enter'; return }
    move(g, (g.state === 'eaten' ? ps * 1.9 : g.fr ? ps * .55 : ps * .88) * dt, ghostDecide, g.state === 'eaten');
  }
  function power() {
    G.fright = Math.max(3, 7 - (G.level - 1) * .8); G.combo = 200; beep(150, .4, 'sawtooth', .05, 600);
    for (const g of ghosts) if (g.state === 'normal' || g.state === 'leave' || g.state === 'house') { if (g.state === 'normal') { g.dx = -g.dx; g.dy = -g.dy } g.fr = true }
  }
  function die() { G.state = 'dying'; G.timer = 1.5; burst(P.x + .5, P.y + .5, '#ffd400', 28, 6); shake(); beep(500, 1.2, 'sawtooth', .05, 60) }

  /* ---------- update ---------- */
  function update(dt) {
    G.t += dt; G.pops = G.pops.filter(p => (p.t -= dt) > 0);
    for (const p of G.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .96; p.vy *= .96 } G.parts = G.parts.filter(p => (p.t -= dt) > 0);
    if (G.state === 'ready') { G.timer -= dt; if (G.timer <= 0) G.state = 'playing'; return }
    if (G.state === 'dying') { G.timer -= dt; if (G.timer <= 0) { G.lives--; hud(); if (G.lives <= 0) { G.state = 'over'; showOv('GAME OVER', 'Score: ' + G.score + '<br>High: ' + G.high, 'PLAY AGAIN') } else { resetActors(); G.state = 'ready'; G.timer = 1.6 } } return }
    if (G.state === 'clear') { G.timer -= dt; if (G.timer <= 0) { G.level++; newLevel(); resetActors(); hud(); G.state = 'ready'; G.timer = 2; banner('LEVEL ' + G.level) } return }
    if (G.state !== 'playing') return;
    if (G.fright > 0) { G.fright -= dt; if (G.fright <= 0) for (const g of ghosts) g.fr = false }
    else { G.modeT += dt; if (G.modeT >= SEQ[G.modeI]) { G.modeT = 0; G.modeI++; G.scatter = !G.scatter; for (const g of ghosts) if (g.state === 'normal') { g.dx = -g.dx; g.dy = -g.dy } } }
    pacUpdate(dt); if (P.dx || P.dy) { G.tr.push([P.x, P.y]); if (G.tr.length > 8) G.tr.shift() }
    const cx = Math.round(P.x), cy = Math.round(P.y);
    if (Math.abs(P.x - cx) < .4 && Math.abs(P.y - cy) < .4) {
      const i = cy * W + cx, v = pel[i];
      if (v) {
        pel[i] = 0; G.dots--; if (v === 1) { add(10); G.w ^= 1; beep(G.w ? 240 : 300, .05); burst(cx + .5, cy + .5, '#ffe3b8', 2, 1.6) } else { add(50); power(); burst(cx + .5, cy + .5, '#ffd400', 18, 5) }
        if (G.dots <= 0) { G.state = 'clear'; G.timer = 1.8; beep(784, .4, 'triangle', .06); banner('LEVEL CLEAR!'); burst(P.x + .5, P.y + .5, '#4de8ff', 30, 7); return }
      }
    }
    for (const g of ghosts) ghostUpdate(g, dt);
    for (const g of ghosts) {
      if (g.state === 'house' || g.state === 'eaten' || g.state === 'enter') continue;
      if (Math.hypot(g.x - P.x, g.y - P.y) < .6) {
        if (g.fr) { g.fr = false; g.state = 'eaten'; burst(g.x + .5, g.y + .5, COL[g.id], 20, 6); add(G.combo); G.pops.push({ x: g.x, y: g.y, t: 1, s: G.combo }); G.combo *= 2; beep(800, .25, 'square', .05, 200) }
        else { die(); return }
      }
    }
  }

  /* ---------- rendering ---------- */
  function buildMaze(color) {
    const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; const x = c.getContext('2d'); x.setTransform(ts, 0, 0, ts, 0, 0);
    x.fillStyle = '#0a1050'; for (let r = 0; r < H; r++)for (let q = 0; q < W; q++)if (MAP[r][q] === '#') x.fillRect(q, r, 1.01, 1.01);
    x.strokeStyle = color; x.lineWidth = .11; x.lineCap = 'round'; x.shadowColor = color; x.shadowBlur = ts * .3; x.beginPath();
    for (let r = 0; r < H; r++)for (let q = 0; q < W; q++) {
      if (MAP[r][q] !== '#') continue;
      if (cell(q, r - 1) !== '#') { x.moveTo(q, r); x.lineTo(q + 1, r) }
      if (cell(q, r + 1) !== '#') { x.moveTo(q, r + 1); x.lineTo(q + 1, r + 1) }
      if (cell(q - 1, r) !== '#') { x.moveTo(q, r); x.lineTo(q, r + 1) }
      if (cell(q + 1, r) !== '#') { x.moveTo(q + 1, r); x.lineTo(q + 1, r + 1) }
    }
    x.stroke(); x.strokeStyle = '#ff8ad8'; x.shadowColor = '#ff8ad8'; x.beginPath(); x.moveTo(8.1, 8.5); x.lineTo(10.9, 8.5); x.stroke();
    return c;
  }
  function resize() {
    const r = stage.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 3);
    const cw = Math.max(120, Math.floor(Math.min(r.width, r.height * W / H))), ch = Math.floor(cw * H / W);
    board.style.width = cw + 'px'; board.style.height = ch + 'px'; cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
    cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); ts = cv.width / W; mzB = buildMaze('#3a6bff'); mzW = buildMaze('#ffffff'); bgInit();
  }
  function ghostDraw(g) {
    const cx = g.x + .5, cy = g.y + .5, r = .42, fl = G.fright > 0 && G.fright < 2 && (G.t * 6 | 0) % 2;
    if (g.state !== 'eaten' && g.state !== 'enter') {
      ctx.fillStyle = g.fr ? (fl ? '#fff' : '#2a2adf') : COL[g.id]; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = ts * .4;
      ctx.beginPath(); ctx.arc(cx, cy - .02, r, Math.PI, 0); ctx.lineTo(cx + r, cy + r);
      const ph = (G.t * 8 | 0) % 2; for (let i = 0; i < 6; i++)ctx.lineTo(cx + r - (i + 1) * r / 3, cy + r - ((i + ph) % 2 ? 0 : .12));
      ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
    }
    if (g.fr && g.state !== 'eaten' && g.state !== 'enter') { ctx.fillStyle = fl ? '#e33' : '#ffd0c0'; ctx.fillRect(cx - .2, cy - .1, .1, .1); ctx.fillRect(cx + .1, cy - .1, .1, .1); return }
    const ex = (g.dx || 0) * .05, ey = (g.dy || 0) * .05;
    for (const s of [-1, 1]) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx + s * .16, cy - .08, .115, 0, 7); ctx.fill(); ctx.fillStyle = '#1a2cff'; ctx.beginPath(); ctx.arc(cx + s * .16 + ex, cy - .08 + ey, .06, 0, 7); ctx.fill() }
  }
  /* animated title-screen parade: ghosts hunt Pac-Man, then Pac-Man hunts the ghosts */
  function drawIntro() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3), w = Math.round(ic.clientWidth * dpr); if (!w) return;
    if (ic.width !== w) { ic.width = w; ic.height = Math.round(w / 5) }
    const T = G.t % 18, ph2 = T >= 9, px = ph2 ? 15.7 - 1.9 * (T - 9) : -1 + 1.9 * T, sc = ctx, st = ts;
    const t = ph2 ? 'POWER PELLET! NOW CHASE THEM' : 'THE GHOSTS ARE HUNTING YOU'; if (t !== capT) { capT = t; cap.textContent = t }
    ctx = ictx; ts = ic.width / 10; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ic.width, ic.height); ctx.setTransform(ts, 0, 0, ts, 0, 0);
    if (!ph2) { ctx.fillStyle = '#ffe3b8'; for (let i = 0; i < 10; i++)if (i + .5 > px + .3) { ctx.beginPath(); ctx.arc(i + .5, 1, i === 9 ? .27 * (.75 + .25 * Math.sin(G.t * 10)) : .09, 0, 7); ctx.fill() } }
    const m = .03 + .3 * Math.abs(Math.sin(G.t * 16));
    ctx.fillStyle = '#ffd400'; ctx.shadowColor = '#ffb300'; ctx.shadowBlur = ts * .5; ctx.beginPath(); ctx.moveTo(px + .5, 1);
    ctx.arc(px + .5, 1, .44, (ph2 ? Math.PI : 0) + m, (ph2 ? Math.PI : 0) + 2 * Math.PI - m); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
    for (let i = 0; i < 4; i++)ghostDraw({ id: i, x: px - 1.3 * (i + 1), y: .5, dx: ph2 ? -1 : 1, dy: 0, state: 'normal', fr: ph2 });
    ctx = sc; ts = st;
  }
  function draw() {
    board.classList.toggle('fright', G.fright > 0 && G.state === 'playing');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#05051a'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.drawImage(G.state === 'clear' && (G.t * 6 | 0) % 2 ? mzW : mzB, 0, 0);
    ctx.setTransform(ts, 0, 0, ts, 0, 0);
    const pul = .75 + .25 * Math.sin(G.t * 10);
    for (let r = 0; r < H; r++)for (let c = 0; c < W; c++) { const v = pel[r * W + c]; if (!v) continue; ctx.fillStyle = '#ffe3b8'; ctx.beginPath(); ctx.arc(c + .5, r + .5, v === 1 ? .09 : .27 * pul, 0, 7); if (v === 2) { ctx.shadowColor = '#ffe3b8'; ctx.shadowBlur = ts * .4 } ctx.fill(); ctx.shadowBlur = 0 }
    if (G.state === 'menu') { drawIntro(); return }
    if (G.state !== 'dying' || G.timer > 0) {
      for (let i = 0; i < G.tr.length; i++) { ctx.fillStyle = 'rgba(255,212,0,' + .035 * i + ')'; ctx.beginPath(); ctx.arc(G.tr[i][0] + .5, G.tr[i][1] + .5, .08 + .32 * i / G.tr.length, 0, 7); ctx.fill() }
      const mv = P.dx || P.dy, a = Math.atan2(P.fy, P.fx); let m = mv ? .03 + .3 * Math.abs(Math.sin(G.t * 16)) : .25, full = 2 * Math.PI;
      if (G.state === 'dying') m = Math.min(Math.PI, (1.5 - G.timer) / 1.2 * Math.PI);
      ctx.fillStyle = '#ffd400'; ctx.shadowColor = '#ffb300'; ctx.shadowBlur = ts * .5; ctx.beginPath(); ctx.moveTo(P.x + .5, P.y + .5);
      ctx.arc(P.x + .5, P.y + .5, .44, a + m, a + full - m); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
    }
    if (G.state !== 'dying') for (const g of ghosts) ghostDraw(g);
    for (const p of G.parts) { ctx.globalAlpha = Math.max(0, p.t / p.l); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, .05 + .08 * p.t / p.l, 0, 7); ctx.fill() } ctx.globalAlpha = 1;
    ctx.font = '.55px "Press Start 2P","Courier New",monospace'; ctx.textAlign = 'center';
    for (const p of G.pops) { ctx.fillStyle = '#4de8ff'; ctx.font = '.4px "Press Start 2P","Courier New",monospace'; ctx.fillText(p.s, p.x + .5, p.y + .2 - (1 - p.t) * .6) }
    if (G.state === 'ready') { ctx.globalAlpha = .65 + .35 * Math.sin(G.t * 8); ctx.fillStyle = '#ffd400'; ctx.font = '.62px "Press Start 2P","Courier New",monospace'; ctx.fillText('READY!', W / 2, 11.75); ctx.globalAlpha = 1 }
  }

  /* ---------- input ---------- */
  function setWant(dx, dy) { want = { dx, dy }; if (G.state === 'menu' || G.state === 'over') return }
  const KEYS = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] };
  function togglePause() { if (G.state === 'playing') { G.state = 'paused'; showOv('PAUSED', 'Take a breath.', 'RESUME'); $('#pb').textContent = 'RESUME' } else if (G.state === 'paused') { G.state = 'playing'; ov.classList.add('hide'); $('#pb').textContent = 'PAUSE' } }
  function primary() { if (G.state === 'menu' || G.state === 'over') startGame(); else if (G.state === 'paused') togglePause() }
  function toggleSound() { muted = !muted; $('#mb').textContent = 'SOUND: ' + (muted ? 'OFF' : 'ON') }
  addEventListener('keydown', e => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (KEYS[k]) { e.preventDefault(); setWant(...KEYS[k]); if (G.state === 'menu' || G.state === 'over') startGame() }
    else if (k === 'p' || k === 'Escape') togglePause();
    else if (k === 'm') toggleSound();
    else if (k === 'Enter' || k === ' ') { e.preventDefault(); primary() }
  });
  $('#go').addEventListener('click', primary); $('#pb').addEventListener('click', togglePause); $('#mb').addEventListener('click', toggleSound);
  document.querySelectorAll('#pad button').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); document.body.classList.add('touch'); const [d1, d2] = b.dataset.d.split(',').map(Number); setWant(d1, d2); if (navigator.vibrate) navigator.vibrate(8) }));
  /* swipe anywhere on the board */
  let sw = null;
  stage.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') document.body.classList.add('touch'); sw = { x: e.clientX, y: e.clientY } });
  stage.addEventListener('pointermove', e => {
    if (!sw) return; const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 16) { Math.abs(dx) > Math.abs(dy) ? setWant(Math.sign(dx), 0) : setWant(0, Math.sign(dy)); sw = { x: e.clientX, y: e.clientY } }
  });
  addEventListener('pointerup', () => sw = null); addEventListener('pointercancel', () => sw = null);
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.state === 'playing') togglePause() });
  let gpPrev = 0;
  function pollPad() {
    const ps = navigator.getGamepads ? navigator.getGamepads() : []; const gp = [...ps].find(Boolean); if (!gp) return;
    const b = i => gp.buttons[i] && gp.buttons[i].pressed, ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    if (b(12) || ay < -.5) setWant(0, -1); else if (b(13) || ay > .5) setWant(0, 1); else if (b(14) || ax < -.5) setWant(-1, 0); else if (b(15) || ax > .5) setWant(1, 0);
    const s = b(0) || b(9); if (s && !gpPrev) { if (G.state === 'playing' && b(9)) togglePause(); else primary() } gpPrev = s;
  }

  /* ---------- loop ---------- */
  let last = performance.now();
  function frame(n) { const dt = Math.min(.05, (n - last) / 1000); last = n; pollPad(); update(dt); draw(); bgDraw(dt); requestAnimationFrame(frame) }
  new ResizeObserver(resize).observe(stage); addEventListener('orientationchange', () => setTimeout(resize, 200));
  resize(); newLevel(); resetActors(); hud(); requestAnimationFrame(frame);
})();
