// Hero animation: the onboarding's solid-silhouette story (couch → shoes → running together),
// ported from docs/onboarding-animation-preview.html. Theme-aware, pauses off-screen,
// shows a still frame when the viewer prefers reduced motion.
(function () {
  var canvas = document.getElementById('hero-canvas');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');

  var D = Math.PI / 180;
  var clamp = function (v, a, b) { a = a === undefined ? 0 : a; b = b === undefined ? 1 : b; return Math.max(a, Math.min(b, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var ease = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  var seg = function (time, a, b) { return ease(clamp((time - a) / (b - a))); };

  // Palette, read from the page's tokens so dark mode gets a light silhouette on a dark street.
  var C = {};
  function readPalette() {
    var cs = getComputedStyle(document.documentElement);
    var v = function (n, f) { var x = cs.getPropertyValue(n).trim(); return x || f; };
    var bg = v('--bg', '#FFFFFF');
    var dark = isDark(bg);
    C = {
      bg: bg,
      ink: v('--ink', '#0E0E0E'),
      onInk: bg,
      farSolid: dark ? '#8C8C86' : '#4A4A4F',
      volt: '#D4FF3F', voltDeep: '#B9E61F',
      surface: v('--surface', '#F5F5F2'),
      hair: v('--hairline', '#E6E6E1'),
      seat: dark ? '#1D1D1B' : '#EFEFEA',
      plant: dark ? '#5E6652' : '#BFC7B0',
      building: dark ? '#131312' : '#F0F0EB',
      trunk: dark ? '#2A2A27' : '#E3E3DE',
      leafA: dark ? '#1F2619' : '#E8EED5',
      leafB: dark ? '#1C201B' : '#E6E9E2',
      dash: dark ? '#33332F' : '#D9D9D3',
      screenOff: dark ? '#55554F' : '#3A3A3D',
    };
  }
  function isDark(color) {
    var m = color.match(/^#([0-9a-f]{6})$/i);
    if (!m) return false;
    var n = parseInt(m[1], 16);
    return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 < 128;
  }

  // ---------- Rig ----------
  var L = { torso: 50, neck: 7, head: 12, upper: 29, fore: 27, thigh: 37, shin: 37, foot: 15 };
  function lerpPose(p, q, t) {
    var r = {};
    for (var k in p) r[k] = Array.isArray(p[k]) ? p[k].map(function (v, i) { return lerp(v, q[k][i], t); }) : lerp(p[k], q[k], t);
    return r;
  }
  function chain(poses, time, marks) {
    var pose = poses[0];
    for (var i = 0; i < marks.length; i++) pose = lerpPose(pose, poses[i + 1], seg(time, marks[i][0], marks[i][1]));
    return pose;
  }
  function dir(deg) { return [Math.sin(deg * D), Math.cos(deg * D)]; }
  function joints(p) {
    var H = [p.x, p.y];
    var tx = Math.sin(p.t * D), ty = -Math.cos(p.t * D);
    var S = [H[0] + tx * L.torso, H[1] + ty * L.torso];
    var hd = (p.t + p.h) * D;
    var Hd = [S[0] + Math.sin(hd) * (L.neck + L.head), S[1] - Math.cos(hd) * (L.neck + L.head)];
    function arm(a) {
      var u = dir(p.t + a[0]); var E = [S[0] + u[0] * L.upper, S[1] + u[1] * L.upper];
      var f = dir(p.t + a[0] + a[1]); return [S, E, [E[0] + f[0] * L.fore, E[1] + f[1] * L.fore]];
    }
    function leg(l) {
      var k = dir(l[0]); var K = [H[0] + k[0] * L.thigh, H[1] + k[1] * L.thigh];
      var s = dir(l[0] + l[1]); var A = [K[0] + s[0] * L.shin, K[1] + s[1] * L.shin];
      var o = dir(l[0] + l[1] + 90 + (l[2] || 0)); return [H, K, A, [A[0] + o[0] * L.foot, A[1] + o[1] * L.foot]];
    }
    return { H: H, S: S, Hd: Hd, aN: arm(p.aN), aF: arm(p.aF), lN: leg(p.lN), lF: leg(p.lF) };
  }
  function polyline(pts, w, color) {
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function shoe(A, F, fill, far) {
    var len = Math.hypot(F[0] - A[0], F[1] - A[1]);
    var ang = Math.atan2(F[1] - A[1], F[0] - A[0]);
    ctx.save(); ctx.translate(A[0], A[1]); ctx.rotate(ang);
    var h = 11;
    roundRect(-5, -h / 2 - 1, len + 9, h, h / 2);
    if (fill > 0.01) {
      ctx.save(); ctx.clip();
      ctx.fillStyle = far ? C.voltDeep : C.volt; ctx.fillRect(-6, -h, (len + 11) * fill + 1, h * 2);
      if (fill < 1) { ctx.fillStyle = C.bg; ctx.fillRect(-6 + (len + 11) * fill, -h, len + 12, h * 2); }
      ctx.restore();
      ctx.lineWidth = 2.5; ctx.strokeStyle = C.ink; roundRect(-5, -h / 2 - 1, len + 9, h, h / 2); ctx.stroke();
    } else {
      ctx.fillStyle = far ? C.farSolid : C.ink; ctx.fill();
    }
    ctx.restore();
  }
  function figure(p, opt) {
    opt = opt || {};
    var J = joints(p);
    var ink = C.ink, farInk = C.farSolid, limb = 12;
    var shoes = opt.shoes || [1, 1];
    polyline(J.lF.slice(0, 3), limb, farInk);
    shoe(J.lF[2], J.lF[3], shoes[1], true);
    polyline(J.aF, limb, farInk);
    polyline([J.H, J.S], 24, opt.shirt || ink);
    ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(J.Hd[0], J.Hd[1], L.head + 1, 0, Math.PI * 2); ctx.fill();
    if (opt.band) {
      var hd = (p.t + p.h) * D;
      ctx.save(); ctx.translate(J.Hd[0], J.Hd[1]); ctx.rotate(hd);
      ctx.fillStyle = C.volt; ctx.fillRect(-L.head, -4, L.head * 2, 4.5); ctx.restore();
    }
    polyline(J.lN.slice(0, 3), limb, ink);
    shoe(J.lN[2], J.lN[3], shoes[0], false);
    polyline(J.aN, limb, ink);
    return J;
  }
  function runPose(phi, amp, x) {
    var s = Math.sin(phi), c = Math.cos(phi);
    var tN = 6 + 36 * amp * s, tF = 6 - 36 * amp * s;
    var kN = -(12 + 88 * amp * Math.pow(Math.max(0, c), 1.2));
    var kF = -(12 + 88 * amp * Math.pow(Math.max(0, -c), 1.2));
    var pose = { x: x, y: 0, t: 4 + 9 * amp, h: -3,
      aN: [-40 * amp * s - 4, 78 + 12 * s], aF: [40 * amp * s - 4, 78 - 12 * s], lN: [tN, kN], lF: [tF, kF] };
    var drop = function (l) { return L.thigh * Math.cos(l[0] * D) + L.shin * Math.cos((l[0] + l[1]) * D); };
    pose.y = -Math.max(drop(pose.lN), drop(pose.lF)) - 5 - 5 * amp * Math.abs(Math.sin(2 * phi));
    return pose;
  }

  // ---------- Props ----------
  function rr(x, y, w, h, r, fill, stroke) {
    roundRect(x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = 1.5; ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function couch(cx, G) {
    rr(cx - 86, G - 92, 172, 54, 16, C.surface, C.hair);
    rr(cx - 92, G - 50, 184, 30, 12, C.seat, C.hair);
    rr(cx - 100, G - 70, 22, 52, 10, C.surface, C.hair);
    rr(cx + 78, G - 70, 22, 52, 10, C.surface, C.hair);
    ctx.fillStyle = C.hair; ctx.fillRect(cx - 84, G - 20, 6, 20); ctx.fillRect(cx + 78, G - 20, 6, 20);
  }
  function room(W, G) {
    ctx.fillStyle = C.hair; ctx.fillRect(0, G, W, 1.5);
    rr(W * 0.16, G - 196, 46, 58, 6, null, C.hair);
    ctx.fillStyle = C.volt; ctx.beginPath(); ctx.arc(W * 0.16 + 23, G - 167, 9, 0, 7); ctx.fill();
    rr(W * 0.1, G - 34, 30, 34, 6, C.surface, C.hair);
    ctx.strokeStyle = C.plant; ctx.lineWidth = 3; ctx.lineCap = 'round';
    [[-10, -28], [0, -40], [10, -30]].forEach(function (d) {
      ctx.beginPath(); ctx.moveTo(W * 0.1 + 15, G - 34);
      ctx.quadraticCurveTo(W * 0.1 + 15 + d[0] * 0.4, G - 34 + d[1] * 0.6, W * 0.1 + 15 + d[0], G - 34 + d[1]); ctx.stroke();
    });
  }
  function bubble(x, y, text, alpha, dark) {
    if (alpha <= 0.01) return;
    ctx.save(); ctx.globalAlpha *= alpha;
    ctx.font = '600 13px Heebo, system-ui, sans-serif'; ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var w = ctx.measureText(text).width + 24, h = 30, yy = y - (1 - alpha) * 6;
    ctx.fillStyle = dark ? C.ink : C.surface;
    roundRect(x - w / 2, yy - h, w, h, 15); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 6, yy - 1); ctx.lineTo(x, yy + 7); ctx.lineTo(x + 6, yy - 1); ctx.fill();
    ctx.fillStyle = dark ? C.onInk : C.ink; ctx.fillText(text, x, yy - h / 2 + 1);
    ctx.restore();
  }
  function pill(x, y, num, unit, alpha) {
    if (alpha <= 0.01) return;
    ctx.save(); ctx.globalAlpha *= alpha;
    ctx.font = '800 15px Nunito, system-ui, sans-serif'; var nw = ctx.measureText(num).width;
    ctx.font = '600 12px Heebo, system-ui, sans-serif'; var uw = ctx.measureText(unit).width;
    var w = nw + uw + 30;
    ctx.fillStyle = C.volt; roundRect(x - w / 2, y - 15, w, 30, 15); ctx.fill();
    ctx.fillStyle = '#0E0E0E'; ctx.textBaseline = 'middle'; ctx.textAlign = 'right'; ctx.direction = 'rtl';
    ctx.fillText(unit, x + w / 2 - 12, y + 1);
    ctx.font = '800 15px Nunito, system-ui, sans-serif'; ctx.direction = 'ltr'; ctx.textAlign = 'left';
    ctx.fillText(num, x - w / 2 + 12, y + 1);
    ctx.restore();
  }

  // ---------- Scenes ----------
  var SIT = { x: 0, y: -44, t: -14, h: 22, aN: [26, 92], aF: [20, 86], lN: [90, -90], lF: [84, -84] };
  var ALERT = { x: 0, y: -44, t: -4, h: -4, aN: [30, 100], aF: [22, 90], lN: [90, -90], lF: [84, -84] };
  var LEAN = { x: 14, y: -58, t: 34, h: -6, aN: [-10, 30], aF: [-18, 26], lN: [52, -60], lF: [44, -52] };
  var STAND = { x: 26, y: -78, t: 2, h: 0, aN: [6, 10], aF: [-6, 12], lN: [3, 0], lF: [-3, 0] };
  var STRETCH = { x: 26, y: -80, t: -6, h: -12, aN: [168, 12], aF: [160, 12], lN: [3, 0], lF: [-3, 0] };
  var BEND = { x: 2, y: -44, t: 50, h: 16, aN: [-30, 18], aF: [-36, 20], lN: [76, -104], lF: [68, -100] };

  var scenes = [
    { period: 6.6, draw: function (W, H, time) {
      var G = H - 26, cx = W * 0.66;
      room(W, G); couch(cx, G);
      var p = chain([SIT, ALERT, LEAN, STAND, STRETCH, STAND], time, [[1.5, 1.9], [2.2, 2.75], [2.75, 3.3], [3.6, 4.3], [4.6, 5.3]]);
      if (time < 1.5) p.aN = [p.aN[0], p.aN[1] + Math.sin(time * 9) * 3];
      if (time > 5.3) p.y += Math.sin((time - 5.3) * 5) * 1.2;
      ctx.save(); ctx.translate(cx - 10, G); ctx.scale(-1, 1);
      var J = figure(p, { shoes: [0, 0] });
      var phoneA = 1 - seg(time, 2.6, 2.9);
      if (phoneA > 0.02) {
        var glow = time > 1.5 ? 0.5 + 0.5 * Math.sin((time - 1.5) * 8) : 0;
        ctx.save(); ctx.globalAlpha *= phoneA; ctx.translate(J.aN[2][0], J.aN[2][1]); ctx.rotate(-0.4);
        rr(-5, -16, 12, 20, 3, C.ink);
        rr(-3.5, -14.5, 9, 17, 2, time > 1.5 ? 'rgba(212,255,63,' + (0.6 + 0.4 * glow) + ')' : C.screenOff);
        ctx.restore();
      }
      ctx.restore();
      var bx = cx - 10 - J.Hd[0];
      bubble(Math.min(Math.max(bx, 92), W - 92), G + J.Hd[1] - 30, 'נועה: יאללה לרוץ?', seg(time, 1.7, 2.0) * (1 - seg(time, 3.4, 3.8)), true);
    } },
    { period: 6.8, draw: function (W, H, time) {
      var G = H - 26, cx = W * 0.66;
      room(W, G); couch(cx, G);
      var p = chain([SIT, BEND, LEAN, STAND], time, [[0.2, 0.8], [3.1, 3.7], [3.7, 4.2]]);
      if (time > 0.8 && time < 3.1) {
        var w = Math.sin(time * 15);
        p.aN = [p.aN[0] + w * 6, p.aN[1] + w * 8]; p.aF = [p.aF[0] - w * 5, p.aF[1] - w * 6];
      }
      if (time > 4.4) {
        var amp = 0.42 * seg(time, 4.4, 4.9) * (1 - seg(time, 6.4, 6.8));
        p = lerpPose(p, runPose((time - 4.4) * 8.5, amp, STAND.x), seg(time, 4.4, 4.7));
      }
      ctx.save(); ctx.translate(cx - 10, G); ctx.scale(-1, 1);
      figure(p, { shoes: [seg(time, 1.0, 1.9), seg(time, 2.0, 2.9)] });
      ctx.restore();
      pill(W * 0.36, 52, '5:30', 'לק״מ', seg(time, 4.6, 5.0) * (1 - seg(time, 6.3, 6.7)));
    } },
    { period: 8.4, draw: function (W, H, time) {
      var G = H - 26, speed = 120, i;
      ctx.fillStyle = C.building;
      for (i = 0; i < 8; i++) {
        var bx = ((i * 64 + time * speed * 0.18) % (W + 80)) - 60, bh = 40 + ((i * 37) % 50);
        ctx.fillRect(bx, G - 70 - bh, 46, bh + 70);
      }
      for (i = 0; i < 4; i++) {
        var tx = ((i * 110 + time * speed * 0.55) % (W + 120)) - 60;
        ctx.fillStyle = C.trunk; ctx.fillRect(tx - 2, G - 46, 4, 46);
        ctx.fillStyle = i % 2 ? C.leafA : C.leafB; ctx.beginPath(); ctx.arc(tx, G - 56, 20, 0, 7); ctx.fill();
      }
      ctx.fillStyle = C.hair; ctx.fillRect(0, G, W, 1.5);
      ctx.fillStyle = C.dash;
      for (i = 0; i < 9; i++) { var dx = ((i * 48 + time * speed) % (W + 48)) - 40; ctx.fillRect(dx, G + 10, 22, 2); }
      var phi = time * 9.4, enter = seg(time, 0.4, 2.4), leadX = W * 0.42;
      var partnerX = lerp(W + 40, leadX + 58, enter);
      ctx.save(); ctx.translate(partnerX, G - 4); ctx.scale(-0.93, 0.93);
      figure(runPose(phi + 1.3, 1, 0), { shirt: C.volt });
      ctx.restore();
      ctx.save(); ctx.translate(leadX, G); ctx.scale(-1, 1);
      var J = figure(runPose(phi, 1, 0), { band: true });
      ctx.restore();
      var headY = G + J.Hd[1];
      bubble(leadX - 10, headY - 22, 'שמעת את הפרק החדש?', seg(time, 2.7, 3.0) * (1 - seg(time, 4.6, 4.9)), false);
      bubble(Math.min(partnerX + 6, W - 84), headY - 18, 'עוד לא! ספרו בקילומטר 3', seg(time, 4.9, 5.2) * (1 - seg(time, 7.0, 7.3)), true);
      pill(W * 0.5, 36, (2.0 + time * 0.08).toFixed(1), 'ק״מ יחד', seg(time, 2.4, 2.8) * (1 - seg(time, 8.0, 8.4)));
    } },
  ];

  // ---------- Canvas plumbing ----------
  var cssW = 0, cssH = 0, dpr = 1;
  function fit() {
    var r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cssW = r.width; cssH = r.height;
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
  }
  function drawScene(i, time, alpha) {
    var k = Math.min(cssW / 300, cssH / 280);
    ctx.save();
    ctx.translate((cssW - 320 * k) / 2, cssH - 300 * k);
    ctx.scale(k, k);
    ctx.globalAlpha = alpha;
    scenes[i].draw(320, 300, time);
    ctx.restore();
  }
  function clear() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, cssW, cssH);
  }

  // One continuous story: each scene plays once, then crossfades into the next.
  var XF = 0.5;
  var total = scenes.reduce(function (s, x) { return s + x.period; }, 0);
  function frameAt(t) {
    clear();
    var acc = 0;
    for (var i = 0; i < scenes.length; i++) {
      var P = scenes[i].period;
      if (t < acc + P) {
        var local = t - acc;
        var fadeIn = i === 0 && t < XF && !started ? 1 : Math.min(1, local / XF);
        drawScene(i, local, fadeIn);
        if (local < XF) {
          var prev = (i + scenes.length - 1) % scenes.length;
          drawScene(prev, scenes[prev].period, 1 - local / XF);
        }
        return;
      }
      acc += P;
    }
  }

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var visible = true, running = false, started = false, t0 = 0, offset = 0, raf = 0;

  function still() { clear(); drawScene(2, 3.6, 1); }
  function loop(now) {
    if (!running) return;
    var t = ((now - t0) / 1000 + offset) % total;
    frameAt(t);
    started = true;
    raf = requestAnimationFrame(loop);
  }
  function start() {
    if (running || reduce) return;
    running = true; t0 = performance.now();
    raf = requestAnimationFrame(loop);
  }
  function stop() {
    if (!running) return;
    offset = ((performance.now() - t0) / 1000 + offset) % total;
    running = false; cancelAnimationFrame(raf);
  }

  readPalette(); fit();
  if (reduce) still(); else { frameAt(0); start(); }

  if (window.ResizeObserver) new ResizeObserver(function () { fit(); if (!running) (reduce ? still() : frameAt(offset)); }).observe(canvas);
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible && !document.hidden) start(); else stop();
    }).observe(canvas);
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else if (visible) start(); });
  var mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
  var repaint = function () { readPalette(); if (!running) (reduce ? still() : frameAt(offset)); };
  if (mq && mq.addEventListener) mq.addEventListener('change', repaint);
  new MutationObserver(repaint).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(repaint);
})();
