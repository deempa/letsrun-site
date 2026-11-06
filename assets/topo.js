/*
 * Framework-free port of KokonutUI's Topo Background (https://kokonutui.com/docs/backgrounds/topo-background).
 * Same noise, marching squares, cursor hill and click ripple. Removed: React and elevation labels.
 *
 * MIT License
 *
 * Copyright (c) 2025 kokonutUI
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
(function () {
  var CELL = 12, TERRAIN_SCALE = 360, INDEX_EVERY = 5, FRAME_MS = 33;
  var HILL_HEIGHT = 0.5, HILL_SPREAD = 120, HILL_FOLLOW = 9, HILL_RISE = 5;
  var RIPPLE_MS = 1800, RIPPLE_SPEED = 0.24, RIPPLE_WIDTH = 42, RIPPLE_HEIGHT = 0.2, RIPPLE_WAVELENGTH = 96;

  function createNoise(seed) {
    var p = [], i, j, tmp, state = seed >>> 0 || 1;
    for (i = 0; i < 256; i++) p[i] = i;
    function random() {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    }
    for (i = 255; i > 0; i--) {
      j = Math.floor(random() * (i + 1));
      tmp = p[i]; p[i] = p[j]; p[j] = tmp;
    }
    var perm = new Uint8Array(512);
    for (i = 0; i < 512; i++) perm[i] = p[i & 255];
    function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    function lerp(a, b, t) { return a + (b - a) * t; }
    function grad(hash, x, y, z) {
      var h = hash & 15, u = h < 8 ? x : y, v = z;
      if (h < 4) v = y; else if (h === 12 || h === 14) v = x;
      return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }
    return function (x, y, z) {
      var X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
      var fx = x - Math.floor(x), fy = y - Math.floor(y), fz = z - Math.floor(z);
      var u = fade(fx), v = fade(fy), w = fade(fz);
      var A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z;
      var B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
      return lerp(
        lerp(
          lerp(grad(perm[AA], fx, fy, fz), grad(perm[BA], fx - 1, fy, fz), u),
          lerp(grad(perm[AB], fx, fy - 1, fz), grad(perm[BB], fx - 1, fy - 1, fz), u),
          v
        ),
        lerp(
          lerp(grad(perm[AA + 1], fx, fy, fz - 1), grad(perm[BA + 1], fx - 1, fy, fz - 1), u),
          lerp(grad(perm[AB + 1], fx, fy - 1, fz - 1), grad(perm[BB + 1], fx - 1, fy - 1, fz - 1), u),
          v
        ),
        w
      );
    };
  }

  function cellSegments(path, index, x0, y0, x1, y1, top, right, bottom, left) {
    function line(ax, ay, bx, by) { path.moveTo(ax, ay); path.lineTo(bx, by); }
    switch (index) {
      case 1: case 14: line(x0, left, bottom, y1); break;
      case 2: case 13: line(bottom, y1, x1, right); break;
      case 3: case 12: line(x0, left, x1, right); break;
      case 4: case 11: line(top, y0, x1, right); break;
      case 6: case 9: line(top, y0, bottom, y1); break;
      case 7: case 8: line(x0, left, top, y0); break;
      case 5: line(x0, left, top, y0); line(bottom, y1, x1, right); break;
      case 10: line(top, y0, x1, right); line(x0, left, bottom, y1); break;
    }
  }

  window.startTopo = function (canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var interval = opts.interval || 0.07;
    var speed = opts.speed === undefined ? 0.5 : opts.speed;
    var strength = opts.strength || 1;
    var noise = createNoise(opts.seed || 26);
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    var width = 0, height = 0, cols = 0, rows = 0, field = new Float32Array(0);
    var time = opts.startAt || 40, last = 0, lastPaint = 0, raf = 0, onScreen = true;
    var hill = { x: 0, y: 0, tx: 0, ty: 0, amount: 0, on: false };
    var ripples = [];

    function resize() {
      var rect = canvas.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width; height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(width / CELL) + 1;
      rows = Math.ceil(height / CELL) + 1;
      field = new Float32Array(cols * rows);
    }

    function paint(now) {
      var z = time * 0.05, drift = time * 6, i, j, r;
      var hillOn = hill.amount > 0.001, spread = 2 * HILL_SPREAD * HILL_SPREAD, ringWidth = 2 * RIPPLE_WIDTH * RIPPLE_WIDTH;
      for (j = 0; j < rows; j++) {
        for (i = 0; i < cols; i++) {
          var x = i * CELL, y = j * CELL;
          var nx = (x + drift) / TERRAIN_SCALE, ny = y / TERRAIN_SCALE;
          var v = noise(nx, ny, z) * 0.78 + noise(nx * 2.3 + 17.1, ny * 2.3 + 4.7, z * 1.4) * 0.22;
          if (hillOn) {
            var dx = x - hill.x, dy = y - hill.y;
            v += HILL_HEIGHT * hill.amount * Math.exp(-(dx * dx + dy * dy) / spread);
          }
          for (r = 0; r < ripples.length; r++) {
            var age = now - ripples[r].start;
            var d = Math.hypot(x - ripples[r].x, y - ripples[r].y) - age * RIPPLE_SPEED;
            var fadeOut = 1 - age / RIPPLE_MS;
            v += RIPPLE_HEIGHT * fadeOut * fadeOut * Math.exp(-(d * d) / ringWidth) * Math.cos((d / RIPPLE_WAVELENGTH) * Math.PI * 2);
          }
          field[j * cols + i] = v;
        }
      }
      var minor = new Path2D(), major = new Path2D();
      for (j = 0; j < rows - 1; j++) {
        for (i = 0; i < cols - 1; i++) {
          var a = field[j * cols + i], b = field[j * cols + i + 1];
          var c = field[(j + 1) * cols + i + 1], e = field[(j + 1) * cols + i];
          var first = Math.ceil(Math.min(a, b, c, e) / interval);
          var lastLevel = Math.floor(Math.max(a, b, c, e) / interval);
          for (var level = first; level <= lastLevel; level++) {
            var t = level * interval;
            var index = (a > t ? 8 : 0) | (b > t ? 4 : 0) | (c > t ? 2 : 0) | (e > t ? 1 : 0);
            if (index === 0 || index === 15) continue;
            var x0 = i * CELL, y0 = j * CELL;
            cellSegments(level % INDEX_EVERY === 0 ? major : minor, index, x0, y0, x0 + CELL, y0 + CELL,
              x0 + CELL * ((t - a) / (b - a)), y0 + CELL * ((t - b) / (c - b)),
              x0 + CELL * ((t - e) / (c - e)), y0 + CELL * ((t - a) / (e - a)));
          }
        }
      }
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = '#0E0E0E';
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.16 * strength; ctx.lineWidth = 0.75; ctx.stroke(minor);
      ctx.globalAlpha = 0.34 * strength; ctx.lineWidth = 1.1; ctx.stroke(major);
      ctx.globalAlpha = 1;
    }

    function stepHill(dt) {
      var follow = 1 - Math.exp(-HILL_FOLLOW * dt);
      hill.x += (hill.tx - hill.x) * follow;
      hill.y += (hill.ty - hill.y) * follow;
      var goal = hill.on ? 1 : 0;
      hill.amount += (goal - hill.amount) * (1 - Math.exp(-HILL_RISE * dt));
      return Math.abs(hill.tx - hill.x) > 0.5 || Math.abs(hill.ty - hill.y) > 0.5 || Math.abs(goal - hill.amount) > 0.002;
    }

    function frame(now) {
      raf = 0;
      if (!onScreen || document.hidden) return;
      var dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      var moving = stepHill(dt);
      while (ripples.length && now - ripples[0].start > RIPPLE_MS) ripples.shift();
      var settling = moving || ripples.length > 0;
      time += dt * speed;
      if (settling || now - lastPaint >= FRAME_MS) { paint(now); lastPaint = now; }
      raf = requestAnimationFrame(frame);
    }
    function start() {
      if (!raf && !reduce && onScreen && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); }
    }

    resize(); paint(performance.now()); start();
    new ResizeObserver(function () { resize(); paint(performance.now()); }).observe(canvas);
    new IntersectionObserver(function (entries) { onScreen = entries[0].isIntersecting; start(); }).observe(canvas);
    document.addEventListener('visibilitychange', start);

    // The hill follows a mouse only; on touch the map just drifts, so scrolling never fights it.
    var surface = opts.surface;
    if (surface && fine && !reduce) {
      surface.addEventListener('pointermove', function (e) {
        var r = canvas.getBoundingClientRect();
        hill.tx = e.clientX - r.left; hill.ty = e.clientY - r.top;
        if (!hill.on) { hill.x = hill.tx; hill.y = hill.ty; hill.on = true; }
        start();
      });
      surface.addEventListener('pointerleave', function () { hill.on = false; start(); });
      surface.addEventListener('pointerdown', function (e) {
        if (e.target.closest && e.target.closest('a,button,input')) return;
        var r = canvas.getBoundingClientRect();
        ripples.push({ x: e.clientX - r.left, y: e.clientY - r.top, start: performance.now() });
        if (ripples.length > 3) ripples.shift();
        start();
      });
    }
  };
})();
