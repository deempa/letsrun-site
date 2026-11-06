// Site-wide components for letsrun.co.il. No framework. Written for this site in the
// spirit of KokonutUI's Marker Text, Spoiler Text, Slide to Confirm,
// Particle Button, Momentum Rail and Scroll Index. Topo Background is the one direct port (topo.js).
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function seen(el, fn, opts) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { fn(e.isIntersecting, e); }); }, opts);
    io.observe(el);
    return io;
  }
  function seeded(text) {
    var n = 7, i;
    for (i = 0; i < text.length; i++) n = (n * 31 + text.charCodeAt(i)) % 1000003;
    return function () { n += 1; var x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };
  }

  /* ---------- Topo maps ---------- */
  $$('[data-topo]').forEach(function (box) {
    var canvas = document.createElement('canvas');
    box.insertBefore(canvas, box.firstChild);
    var s = box.dataset;
    window.startTopo(canvas, {
      interval: +s.interval || 0.06,
      strength: +s.strength || 0.72,
      seed: +s.seed || 26,
      surface: s.surface ? box.closest(s.surface) : null,
    });
  });

  /* ---------- Marker: the pen always travels right to left ---------- */
  function drawMark(el) {
    var old = $('svg', el);
    if (old) old.remove();
    var type = el.dataset.mk || 'highlight';
    var w = el.offsetWidth, h = el.offsetHeight, rand = seeded(el.textContent), d, sw;
    if (type === 'circle') {
      var rx = w / 2 + 9, ry = h / 2 + 2, pts = [], n = 44, i;
      for (i = 0; i <= n; i++) {
        var a = -0.5 - (i / n) * Math.PI * 2.14;
        var grow = 1 + 0.05 * (i / n) + (rand() - 0.5) * 0.012;
        pts.push((w / 2 + Math.cos(a) * rx * grow).toFixed(1) + ' ' + (h / 2 + Math.sin(a) * ry * grow).toFixed(1));
      }
      d = 'M' + pts.join('L'); sw = 2.2;
    } else if (type === 'underline') {
      var u = h * 0.96;
      d = 'M' + (w + 3) + ' ' + (u + rand() * 2) + 'C' + (w * 0.66) + ' ' + (u - 3) + ' ' + (w * 0.33) + ' ' + (u + 3) + ' -3 ' + (u - rand() * 2);
      sw = Math.max(2.4, h * 0.07);
    } else {
      var y = h * 0.7;
      d = 'M' + (w + h * 0.06) + ' ' + (y + 1) + 'C' + (w * 0.66) + ' ' + (y - h * 0.035) + ' ' + (w * 0.33) + ' ' + (y + h * 0.035) + ' ' + (-h * 0.06) + ' ' + (y - 1);
      sw = h * 0.34;
    }
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', 'mk-' + type);
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('pathLength', '1');
    path.setAttribute('stroke-width', sw.toFixed(1));
    svg.appendChild(path);
    el.appendChild(svg);
  }
  function setupMarks() {
    $$('.mk').forEach(function (el) {
      drawMark(el);
      seen(el, function (on) { if (on) el.classList.add('in'); }, { threshold: 0.6 });
    });
  }
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { $$('.mk').forEach(drawMark); }, 150);
  });

  // Blog: mark the last word of the page title, and one strong phrase in each callout.
  $$('.article > .wrap > h1, .blog-title').forEach(function (h) {
    var text = h.textContent.trim(), cut = text.lastIndexOf(' ');
    h.textContent = text.slice(0, cut + 1);
    var mk = document.createElement('span');
    mk.className = 'mk'; mk.textContent = text.slice(cut + 1);
    h.appendChild(mk);
  });

  /* ---------- Spoiler: the meeting point stays hidden until the organiser approves ---------- */
  $$('[data-spoiler]').forEach(function (box) {
    var text = $('.sp', box), btn = $('button', box), canvas = $('canvas', text), map = $('.sp-map', box);
    var ctx = canvas.getContext('2d'), dots = [], raf = 0, onScreen = false, open = false, openedAt = 0, w = 0, h = 0;
    function fit() {
      var r = text.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width + 16; h = r.height + 8;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.round(w * h / 22), rand = seeded('specks');
      dots = [];
      for (var i = 0; i < n; i++) {
        dots.push({ x: rand() * w, y: rand() * h, a: rand() * 6.28, s: 0.1 + rand() * 0.3, r: 0.6 + rand() * 0.8, o: 0.35 + rand() * 0.6 });
      }
    }
    function draw(now) {
      raf = 0;
      var t = open ? clamp((now - openedAt) / 420, 0, 1) : 0;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#0E0E0E';
      dots.forEach(function (d) {
        d.a += (Math.random() - 0.5) * 0.3;
        d.x += Math.cos(d.a) * d.s * (1 + t * 14); d.y += Math.sin(d.a) * d.s * (1 + t * 14);
        if (!open) { if (d.x < 0) d.x = w; if (d.x > w) d.x = 0; if (d.y < 0) d.y = h; if (d.y > h) d.y = 0; }
        ctx.globalAlpha = d.o * (1 - t);
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 6.29); ctx.fill();
      });
      ctx.globalAlpha = 1;
      if (t >= 1) return;
      if (!reduce && onScreen) raf = requestAnimationFrame(draw);
    }
    function wake() { if (!raf) raf = requestAnimationFrame(draw); }
    btn.addEventListener('click', function () {
      open = !open;
      box.classList.toggle('is-open', open);
      btn.setAttribute('aria-pressed', open);
      btn.textContent = open ? '✓ המארגן אישר. לחזור?' : 'לסמן שהמארגן אישר';
      if (map) map.classList.toggle('is-open', open);
      if (open) { openedAt = performance.now(); if (reduce) ctx.clearRect(0, 0, w, h); else wake(); }
      else { fit(); wake(); }
    });
    fit(); draw(performance.now());
    seen(box, function (on) { onScreen = on; if (on && !open) wake(); });
  });

  /* ---------- Trail through the "how it works" steps, drawn by scrolling ---------- */
  var scrollers = [];
  $$('[data-trail]').forEach(function (list) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'trail'); svg.setAttribute('aria-hidden', 'true');
    var base = document.createElementNS(ns, 'path'), casing = document.createElementNS(ns, 'path'), fill = document.createElementNS(ns, 'path');
    base.setAttribute('class', 'trail-base'); casing.setAttribute('class', 'trail-casing'); fill.setAttribute('class', 'trail-fill');
    var runner = document.createElementNS(ns, 'circle');
    runner.setAttribute('r', '8'); runner.setAttribute('class', 'trail-runner');
    [base, casing, fill, runner].forEach(function (n) { svg.appendChild(n); });
    list.insertBefore(svg, list.firstChild);
    list.classList.add('has-trail');
    var length = 0;
    function shape() {
      var h = list.offsetHeight, n = 8, d = 'M22 0', i;
      svg.setAttribute('viewBox', '0 0 44 ' + h);
      svg.style.height = h + 'px';
      for (i = 1; i <= n; i++) {
        var y = (i / n) * h, off = i === n ? 22 : 22 + (i % 2 ? 11 : -11);
        d += 'S' + off + ' ' + (y - h / n / 2) + ' ' + off + ' ' + y;
      }
      [base, casing, fill].forEach(function (p) { p.setAttribute('d', d); });
      length = fill.getTotalLength();
      [casing, fill].forEach(function (p) { p.style.strokeDasharray = length + ' ' + length; });
    }
    shape();
    window.addEventListener('resize', shape);
    scrollers.push(function () {
      var r = list.getBoundingClientRect(), vh = window.innerHeight;
      var p = reduce ? 1 : clamp((vh * 0.68 - r.top) / r.height, 0, 1);
      var off = length * (1 - p);
      casing.style.strokeDashoffset = off; fill.style.strokeDashoffset = off;
      var pt = fill.getPointAtLength(length * p);
      runner.setAttribute('cx', pt.x); runner.setAttribute('cy', pt.y);
      $$('li', list).forEach(function (li) {
        li.classList.toggle('reached', li.getBoundingClientRect().top < vh * 0.68);
      });
    });
  });

  /* ---------- Join button with a burst ---------- */
  $$('[data-join]').forEach(function (btn) {
    var label = $('span', btn), rest = label.textContent, timer;
    btn.addEventListener('click', function () {
      clearTimeout(timer);
      btn.classList.add('done');
      label.textContent = '✓ נקבע!';
      if (!reduce) {
        for (var i = 0; i < 14; i++) {
          var s = document.createElement('i');
          var a = (i / 14) * 6.283 + Math.random() * 0.3, dist = 44 + Math.random() * 34;
          s.style.setProperty('--x', Math.cos(a) * dist + 'px');
          s.style.setProperty('--y', Math.sin(a) * dist * 0.7 + 'px');
          btn.appendChild(s);
          (function (el) { setTimeout(function () { el.remove(); }, 560); })(s);
        }
      }
      timer = setTimeout(function () { btn.classList.remove('done'); label.textContent = rest; }, 2400);
    });
  });

  /* ---------- Slide to start ---------- */
  $$('[data-slide]').forEach(function (box) {
    var input = $('input', box), txt = $('.slide-txt', box), rest = txt.textContent, timer, anim;
    function set(v) { input.value = v; box.style.setProperty('--p', v / 100); }
    function back() {
      if (reduce) { set(0); return; }
      var from = +input.value, t0 = performance.now();
      cancelAnimationFrame(anim);
      (function tick(now) {
        var t = clamp((now - t0) / 280, 0, 1), e = 1 - Math.pow(1 - t, 3);
        set(from * (1 - e));
        if (t < 1) anim = requestAnimationFrame(tick);
      })(t0);
    }
    function finish() {
      box.classList.add('done');
      set(100);
      txt.textContent = '✓ יצאת לדרך!';
      input.disabled = true;
      timer = setTimeout(function () {
        box.classList.remove('done');
        txt.textContent = rest;
        input.disabled = false;
        back();
      }, 2200);
    }
    input.addEventListener('input', function () {
      cancelAnimationFrame(anim);
      box.style.setProperty('--p', input.value / 100);
      if (+input.value >= 96 && !box.classList.contains('done')) finish();
    });
    ['pointerup', 'touchend'].forEach(function (ev) {
      input.addEventListener(ev, function () { if (!box.classList.contains('done')) back(); });
    });
  });

  /* ---------- Momentum rail: native scroll on touch, drag with inertia by mouse ---------- */
  $$('[data-rail-x]').forEach(function (rail) {
    var buttons = rail.parentNode.querySelectorAll('[data-rail-go]');
    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        rail.scrollBy({ left: +b.dataset.railGo * rail.clientWidth * 0.7, behavior: reduce ? 'auto' : 'smooth' });
      });
    });
    if (!fine) return;
    var down = false, moved = 0, lastX = 0, v = 0, anim = 0;
    rail.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse') return;
      down = true; moved = 0; lastX = e.clientX; v = 0;
      cancelAnimationFrame(anim);
      rail.classList.add('dragging');
    });
    window.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - lastX; lastX = e.clientX;
      moved += Math.abs(dx); v = dx;
      rail.scrollLeft -= dx;
    });
    window.addEventListener('pointerup', function () {
      if (!down) return;
      down = false;
      rail.classList.remove('dragging');
      if (reduce) return;
      (function glide() {
        if (Math.abs(v) < 0.4) return;
        rail.scrollLeft -= v; v *= 0.94;
        anim = requestAnimationFrame(glide);
      })();
    });
    rail.addEventListener('click', function (e) { if (moved > 6) { e.preventDefault(); e.stopPropagation(); } }, true);
    $$('a,img', rail).forEach(function (el) { el.setAttribute('draggable', 'false'); });
  });

  /* ---------- Race bib: tilt and rolling number ---------- */
  $$('[data-bib]').forEach(function (bib) {
    var num = $('.bib-num', bib);
    if (num && !reduce) {
      var target = num.textContent, played = false;
      seen(bib, function (on) {
        if (!on || played) return;
        played = true;
        var t0 = performance.now();
        (function tick(now) {
          var t = clamp((now - t0) / 700, 0, 1), out = '';
          for (var i = 0; i < target.length; i++) out += t > (i + 1) / (target.length + 1) ? target[i] : Math.floor(Math.random() * 10);
          num.textContent = t >= 1 ? target : out;
          if (t < 1) requestAnimationFrame(tick);
        })(t0);
      }, { threshold: 0.4 });
    }
    if (fine && !reduce) {
      bib.addEventListener('pointermove', function (e) {
        var r = bib.getBoundingClientRect();
        bib.style.setProperty('--ry', ((e.clientX - r.left) / r.width - 0.5) * 9 + 'deg');
        bib.style.setProperty('--rx', ((e.clientY - r.top) / r.height - 0.5) * -7 + 'deg');
      });
      bib.addEventListener('pointerleave', function () {
        bib.style.setProperty('--ry', '0deg'); bib.style.setProperty('--rx', '0deg');
      });
    }
  });

  /* ---------- Week scrubber on training tables (reads the page's own table) ---------- */
  $$('.article table').forEach(function (table) {
    var rows = $$('tbody tr', table).filter(function (tr) { return $('td.wk', tr); });
    if (rows.length < 3) return;
    var last = rows.length, box = document.createElement('div');
    box.className = 'wk-scrub';
    box.innerHTML = '<label for="wk-range">שבוע <b class="num wk-now">1</b> מתוך <span class="num">' + last + '</span></label>' +
      '<input id="wk-range" type="range" min="1" max="' + last + '" value="1"><p class="wk-what"></p>';
    table.parentNode.insertBefore(box, table);
    var input = $('input', box), now = $('.wk-now', box), what = $('.wk-what', box);
    function render() {
      var n = +input.value, row = rows[n - 1];
      rows.forEach(function (r) { r.classList.toggle('wk-on', r === row); });
      now.textContent = n;
      what.textContent = row.cells[1] ? row.cells[1].innerText : '';
      box.style.setProperty('--p', (n - 1) / (last - 1));
    }
    input.addEventListener('input', render);
    render();
  });

  /* ---------- Route rail + reading progress ---------- */
  var heads = $$('[data-rail]');
  if (!heads.length) heads = $$('.article .body > h2');
  if (heads.length > 1) {
    var nav = document.createElement('nav');
    nav.className = 'rail'; nav.setAttribute('aria-label', 'המסלול של העמוד');
    var ol = document.createElement('ol');
    var links = heads.map(function (h, i) {
      if (!h.id) h.id = 'part-' + (i + 1);
      var li = document.createElement('li'), a = document.createElement('a');
      a.href = '#' + h.id;
      a.innerHTML = '<i></i><span></span>';
      a.lastChild.textContent = h.dataset.rail || h.textContent;
      li.appendChild(a); ol.appendChild(li);
      return a;
    });
    var flagLi = document.createElement('li');
    flagLi.className = 'rail-flag'; flagLi.setAttribute('aria-hidden', 'true');
    ol.appendChild(flagLi);
    nav.appendChild(ol);
    document.body.appendChild(nav);
    var bar = document.createElement('div');
    bar.className = 'progress'; bar.setAttribute('aria-hidden', 'true');
    bar.innerHTML = '<i></i>';
    document.body.appendChild(bar);
    scrollers.push(function () {
      var doc = document.documentElement, y = window.scrollY, vh = window.innerHeight;
      var total = Math.max(1, doc.scrollHeight - vh);
      bar.style.setProperty('--p', clamp(y / total, 0, 1));
      var line = vh * 0.4, active = -1;
      heads.forEach(function (h, i) { if (h.getBoundingClientRect().top < line) active = i; });
      links.forEach(function (a, i) {
        a.classList.toggle('passed', i <= active);
        if (i === active) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
      nav.style.setProperty('--p', active < 0 ? 0 : (active + 0.5) / heads.length);
      var navBox = nav.getBoundingClientRect();
      var covered = $$('.rail-wrap').some(function (w) {
        var r = w.getBoundingClientRect();
        return r.top < navBox.bottom && r.bottom > navBox.top;
      });
      nav.classList.toggle('on', !covered && (active >= 0 || heads[0].getBoundingClientRect().top < vh * 0.7));
      bar.classList.toggle('on', y > 40);
    });
  }

  /* ---------- Scroll loop ---------- */
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; scrollers.forEach(function (f) { f(); }); });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(setupMarks); else setupMarks();
})();
