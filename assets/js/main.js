/* PPS · motor de la página.
   1) Portada: video ligado al scroll (blob en streaming, interpolación, seeks en cola, escrituras solo al cambiar).
   2) Secciones: entradas, contadores, proceso horizontal, prueba hidrostática, proyectos.
   3) Agenda: arma la solicitud y abre el correo del visitante. */
(function () {
  "use strict";
  var D = window.PPS_DATA, C = window.PPS_CONFIG;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var nf = new Intl.NumberFormat("en-US");
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var clamp = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };
  var smooth = function (p, a, b) { var t = clamp((p - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  /* Las cinco condiciones de portada fija. Deben coincidir carácter por carácter con styles.css */
  var GATES = [
    "(max-width: 720px)",
    "(orientation: portrait) and (max-width: 1024px)",
    "(orientation: portrait) and (pointer: coarse)",
    "(orientation: landscape) and (pointer: coarse) and (max-height: 560px)",
    "(prefers-reduced-motion: reduce)"
  ];
  var MQLS = GATES.map(function (q) { return window.matchMedia(q); });
  var RM = window.matchMedia("(prefers-reduced-motion: reduce)");
  var gated = function () { return MQLS.some(function (m) { return m.matches; }); };

  $("#year").textContent = new Date().getFullYear();

  /* ---------- Navegación ---------- */
  var nav = $("#nav"), burger = $("#burger"), menu = $("#menu");
  function setMenu(open) {
    menu.classList.toggle("is-open", open);
    menu.setAttribute("aria-hidden", String(!open));
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
  }
  burger.addEventListener("click", function () { setMenu(!menu.classList.contains("is-open")); });
  $$("a", menu).forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") setMenu(false); });

  /* ---------- Clientes ---------- */
  (function () {
    var half = Math.ceil(D.clients.length / 2);
    var mk = function (list) { var r = list.map(function (c) { return "<span>" + esc(c) + "</span>"; }).join(""); return r + r + r + r; };
    $("#marquee-a").innerHTML = mk(D.clients.slice(0, half));
    $("#marquee-b").innerHTML = mk(D.clients.slice(half));
    $("#clients-sr").textContent = "Clientes: " + D.clients.join(", ") + ".";
  })();

  /* ---------- Proceso: paneles ---------- */
  var track = $("#proc-track"), procSec = $("#proceso"), procN = $("#proc-n"), procRail = $(".process__rail");
  track.innerHTML = D.process.map(function (st, i) {
    var n = (i < 9 ? "0" : "") + (i + 1);
    return '<li class="panel"><div class="panel__img" data-n="' + n + '"><img src="assets/img/' + st.img + '.webp" alt="' + esc(st.alt) + '" loading="lazy"></div>' +
      '<div class="panel__body"><p class="panel__key">' + n + " · " + esc(st.key) + "</p><h3>" + esc(st.title) + "</h3><p>" + esc(st.text) + "</p>" +
      '<ul class="panel__specs">' + st.specs.map(function (s) { return "<li><span>" + esc(s[0]) + "</span><b>" + esc(s[1]) + "</b></li>"; }).join("") + "</ul></div></li>";
  }).join("");
  var panels = $$(".panel", track), procMax = 0, procTop = 0, procLen = 0;
  function layoutProcess() {
    if (gated()) { procSec.style.height = ""; procMax = 0; return; }
    procMax = Math.max(0, track.scrollWidth - window.innerWidth);
    procSec.style.height = (window.innerHeight + procMax) + "px";
    procTop = procSec.getBoundingClientRect().top + window.scrollY;
    procLen = procMax;
  }

  /* ---------- Portada ---------- */
  var hero = $("#inicio"), stage = $("#stage"), video = $("#hero-video"), weld = $("#weld"), ring = $("#ring");
  var hud = $(".hud"), hudPd = $("#hud-pd"), cue = $(".cue"), seam = $(".seam");
  var VIDEO_URL = "assets/hero-scrub.mp4", VIDEO_BYTES = 9760170, POSTER = "assets/img/hero-first.jpg";

  // Divide cada titular en palabras, una sola vez. El lector de pantalla recibe la frase completa.
  var seed = 7;
  function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
  $$("[data-split]").forEach(function (el) {
    var words = el.textContent.trim().split(/\s+/), n = words.length;
    el.innerHTML = '<span class="sr-only">' + esc(words.join(" ")) + '</span><span aria-hidden="true">' + words.map(function (w, i) {
      var th = (i / n) * 0.5 + rnd() * 0.05, jx = (i % 2 ? -1 : 1) * (40 + rnd() * 50);
      return '<span class="w"><span class="wi" style="--th:' + th.toFixed(3) + ";--jx:" + jx.toFixed(0) + 'px">' + esc(w) + "</span></span>";
    }).join(" ") + "</span>";
  });

  var bands = $$(".band").map(function (el, i, all) {
    return { el: el, a: +el.dataset.a, b: +el.dataset.b, first: i === 0, last: i === all.length - 1, op: -1, k: -1, vis: null };
  });
  var loadK = 0, loadT0 = 0;

  function updateBands(p) {
    for (var i = 0; i < bands.length; i++) {
      var B = bands[i], len = B.b - B.a, f = Math.min(0.02, len / 3);
      var op = (B.first ? 1 : smooth(p, B.a, B.a + f)) * (B.last ? 1 : 1 - smooth(p, B.b - f, B.b));
      var k = clamp((p - B.a) / Math.min(0.035, len * 0.35), 0, 1);
      if (B.first) k = Math.max(k, loadK);
      if (Math.abs(op - B.op) > 0.004 || (op === 0) !== (B.op === 0) || (op === 1) !== (B.op === 1)) {
        B.op = op; B.el.style.opacity = op.toFixed(3);
        var vis = op > 0;
        if (vis !== B.vis) { B.vis = vis; B.el.style.visibility = vis ? "visible" : "hidden"; }
      }
      if (Math.abs(k - B.k) > 0.008 || (k === 1 && B.k !== 1) || (k === 0 && B.k !== 0)) { B.k = k; B.el.style.setProperty("--k", k.toFixed(3)); }
    }
  }

  var cache = { wo: -1, ws: -1, ho: -1, co: -1, pg: -1, pp: -1, n: "", pd: "", pdAt: 0 };
  function setVar(el, name, key, v, eps) {
    if (Math.abs(v - cache[key]) < (eps || 0.004) && !(v === 0 && cache[key] !== 0) && !(v === 1 && cache[key] !== 1)) return;
    cache[key] = v; el.style.setProperty(name, v.toFixed(4));
  }
  function updateHeroExtras(p, now) {
    setVar(weld, "--wo", "wo", 1 - smooth(p, 0.15, 0.27));
    setVar(weld, "--ws", "ws", clamp(p / 0.27, 0, 1));
    setVar(hud, "--ho", "ho", smooth(p, 0.24, 0.3) * (1 - smooth(p, 0.75, 0.8)));
    setVar(cue, "--co", "co", 1 - smooth(p, 0.01, 0.06));
    if (now - cache.pdAt > 100) {
      var txt = nf.format(Math.round(1800000 * smooth(p, 0.24, 0.5) / 1000) * 1000);
      if (txt !== cache.pd) { cache.pd = txt; cache.pdAt = now; hudPd.textContent = txt; }
    }
  }

  function heroProgress() {
    var r = hero.getBoundingClientRect(), range = r.height - window.innerHeight;
    return range > 0 ? clamp(-r.top / range, 0, 1) : 0;
  }

  // Seeks en cola: nunca se escribe currentTime mientras hay uno en curso.
  var seekBusy = false, pendingTime = null;
  function requestSeek(t) {
    if (!video.duration || !isFinite(video.duration)) return;
    t = clamp(t, 0, video.duration - 0.04);
    if (seekBusy) { pendingTime = t; return; }
    if (Math.abs(video.currentTime - t) < 0.012) return;
    seekBusy = true; video.currentTime = t;
  }
  video.addEventListener("seeked", function () {
    seekBusy = false;
    if (pendingTime !== null) { var t = pendingTime; pendingTime = null; requestSeek(t); }
  });
  video.addEventListener("error", function () { seekBusy = false; pendingTime = null; failVideo(); });

  var heroInit = false, fetchStarted = false;
  function failVideo() { stage.classList.add("video-failed"); stage.classList.remove("video-ready"); }
  function startBlobFetch() { if (fetchStarted) return; fetchStarted = true; loadHeroBlob().catch(failVideo); }
  function loadHeroBlob() {
    var ctrl = new AbortController(), watchdog = setTimeout(function () { ctrl.abort(); }, 20000);
    return fetch(VIDEO_URL, { priority: "low", signal: ctrl.signal }).then(function (res) {
      if (!res.ok || !res.body) throw new Error("video");
      var total = Number(res.headers.get("Content-Length")) || VIDEO_BYTES, reader = res.body.getReader(), chunks = [], got = 0, last = 0;
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) return;
          clearTimeout(watchdog); watchdog = setTimeout(function () { ctrl.abort(); }, 20000);
          chunks.push(r.value); got += r.value.length;
          var frac = Math.min(1, got / total), now = performance.now();
          if (now - last > 100 || frac === 1) { last = now; ring.style.setProperty("--ld", Math.round(126 * (1 - frac))); }
          return pump();
        });
      }
      return pump().then(function () {
        clearTimeout(watchdog); ring.style.setProperty("--ld", 0);
        video.src = URL.createObjectURL(new Blob(chunks, { type: "video/mp4" }));
        video.load();
        video.addEventListener("canplay", function () {
          requestSeek(shown * video.duration);
          stage.classList.add("video-ready");
        }, { once: true });
      });
    });
  }
  function initHeroOnce() {
    if (heroInit) return; heroInit = true;
    $("#poster").style.backgroundImage = "url('" + POSTER + "')";
    var im = new Image(); im.onload = startBlobFetch; im.onerror = startBlobFetch; im.src = POSTER;
    setTimeout(startBlobFetch, 4000);
    loadT0 = performance.now();
  }

  /* ---------- Bucle único: descansa cuando todo convergió ---------- */
  var target = 0, shown = 0, procTarget = 0, procShown = 0, rafId = null, lastTick = 0, scrubOn = false, heroOnScreen = true;
  var parallax = $$("[data-parallax]").map(function (el) { return { el: el, f: +el.dataset.parallax, y: null, on: false }; });

  function tick(now) {
    var dt = Math.min(100, now - (lastTick || now)); lastTick = now;
    var e = 1 - Math.pow(1 - 0.16, dt / 16.667), busy = false;

    if (scrubOn) {
      if (loadK < 1) { loadK = clamp((now - loadT0 - 250) / 1300, 0, 1); loadK = 1 - Math.pow(1 - loadK, 3); busy = true; }
      shown += (target - shown) * e;
      if (Math.abs(target - shown) < 0.0004) shown = target; else busy = true;
      if (heroOnScreen) { requestSeek(shown * (video.duration || 0)); updateBands(shown); updateHeroExtras(shown, now); }

      if (procMax > 0) {
        procShown += (procTarget - procShown) * e;
        if (Math.abs(procTarget - procShown) < 0.0004) procShown = procTarget; else busy = true;
        if (Math.abs(procShown - cache.pp) > 0.0005 || procShown !== cache.pp && (procShown === 0 || procShown === 1)) {
          cache.pp = procShown;
          track.style.transform = "translate3d(" + (-procShown * procMax).toFixed(1) + "px,0,0)";
          procRail.style.setProperty("--pp", procShown.toFixed(4));
          var idx = Math.min(panels.length - 1, Math.round(procShown * (panels.length - 1))), lbl = (idx < 9 ? "0" : "") + (idx + 1);
          if (lbl !== cache.n) { cache.n = lbl; procN.textContent = lbl; }
          for (var i = 0; i < panels.length; i++) panels[i].firstChild.firstChild.style.setProperty("--px", ((procShown * (panels.length - 1) - i) * 26).toFixed(1));
        }
      }
    }

    for (var j = 0; j < parallax.length; j++) {
      var P = parallax[j]; if (!P.on) continue;
      var r = P.el.parentNode.getBoundingClientRect(), y = Math.round((r.top + r.height / 2 - window.innerHeight / 2) * -P.f);
      if (y !== P.y) { P.y = y; P.el.style.translate = "0 " + y + "px"; }
    }

    if (busy) rafId = requestAnimationFrame(tick); else { rafId = null; lastTick = 0; }
  }
  function kick() { if (rafId === null) rafId = requestAnimationFrame(tick); }

  function onScroll() {
    var y = window.scrollY, docH = document.documentElement.scrollHeight - window.innerHeight;
    nav.classList.toggle("is-scrolled", y > 40);
    setVar(seam, "--pg", "pg", docH > 0 ? clamp(y / docH, 0, 1) : 0, 0.0008);
    if (scrubOn) {
      target = heroProgress();
      procTarget = procLen > 0 ? clamp((y - procTop) / procLen, 0, 1) : 0;
    }
    kick();
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  new IntersectionObserver(function (e) { heroOnScreen = e[0].isIntersecting; if (heroOnScreen) kick(); }).observe(hero);
  var pIO = new IntersectionObserver(function (es) {
    es.forEach(function (en) { parallax.forEach(function (P) { if (P.el.parentNode === en.target) P.on = en.isIntersecting && !RM.matches; }); });
    kick();
  }, { rootMargin: "20% 0px" });
  parallax.forEach(function (P) { pIO.observe(P.el.parentNode); });

  function enableScrub() {
    if (scrubOn) return; scrubOn = true;
    initHeroOnce();
    bands.forEach(function (B) { B.op = -1; B.k = -1; B.vis = null; });
    cache.wo = cache.ws = cache.ho = cache.co = cache.pp = -1;
    layoutProcess();
    target = shown = heroProgress(); updateBands(shown); updateHeroExtras(shown, performance.now());
    onScroll();
  }
  function disableScrub() {
    scrubOn = false;
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; lastTick = 0; }
    track.style.transform = ""; layoutProcess();
  }
  function applyHeroMode() { if (gated()) disableScrub(); else enableScrub(); onScroll(); }
  MQLS.forEach(function (m) { m.addEventListener("change", applyHeroMode); });
  var rz; window.addEventListener("resize", function () { clearTimeout(rz); rz = setTimeout(function () { layoutProcess(); onScroll(); }, 150); });
  window.addEventListener("load", function () { layoutProcess(); onScroll(); });

  /* ---------- Entradas y contadores ---------- */
  function count(el) {
    if (el.dataset.done) return; el.dataset.done = "1";
    var to = parseFloat(el.dataset.count), dec = parseInt(el.dataset.decimals || "0", 10);
    var fmt = function (v) { return dec ? v.toFixed(dec) : nf.format(Math.round(v)); };
    if (RM.matches) { el.textContent = fmt(to); return; }
    var run = String(parseInt(el.dataset.run || "0", 10) + 1); el.dataset.run = run;
    var t0 = performance.now(), dur = 1900;
    (function step(t) {
      if (el.dataset.run !== run) return;
      var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4);
      el.textContent = fmt(to * e);
      if (k < 1) requestAnimationFrame(step); else el.textContent = fmt(to);
    })(t0);
  }
  $$(".figures__list, .made__grid, .faq__list, .specs__copy, .plant__copy, .agenda__copy").forEach(function (g) {
    $$(".rv", g).forEach(function (el, i) { el.style.setProperty("--d", (i * 0.09).toFixed(2) + "s"); });
  });
  var io = new IntersectionObserver(function (entries) {
    // Las entradas y los contadores se repiten cada vez que el bloque vuelve a entrar en pantalla.
    entries.forEach(function (en) {
      var el = en.target;
      if (!en.isIntersecting) {
        if (RM.matches || !el.classList.contains("in")) return;
        clearTimeout(el._doneT);
        el.classList.remove("in", "done");
        $$("[data-count]", el).forEach(function (c) { delete c.dataset.done; c.dataset.run = String(parseInt(c.dataset.run || "0", 10) + 1); });
        return;
      }
      if (en.intersectionRatio < 0.18 || el.classList.contains("in")) return;
      el.classList.add("in");
      $$("[data-count]", el).forEach(count);
      el._doneT = setTimeout(function () { el.classList.add("done"); }, 1600);
    });
  }, { threshold: [0, 0.18], rootMargin: "0px 0px -6% 0px" });
  $$(".rv").forEach(function (el) { io.observe(el); });

  // Las animaciones en bucle solo corren en pantalla y con la pestaña visible.
  var liveIO = new IntersectionObserver(function (es) { es.forEach(function (en) { en.target.classList.toggle("live", en.isIntersecting); }); });
  liveIO.observe($(".marquee"));
  document.addEventListener("visibilitychange", function () { document.body.classList.toggle("paused", document.hidden); });

  /* ---------- Prueba hidrostática: mantener presionado ---------- */
  (function () {
    var box = $("#hydro"), btn = $("#hydro-btn"), psi = $("#hydro-psi"), note = $("#hydro-note"), specs = $$("#specs-list .spec");
    var ticks = "", i;
    for (i = 0; i <= 10; i++) { var a = (i / 10) * 270 * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); ticks += '<line x1="' + (110 + c * 74).toFixed(1) + '" y1="' + (110 + s * 74).toFixed(1) + '" x2="' + (110 + c * (i % 5 ? 79 : 83)).toFixed(1) + '" y2="' + (110 + s * (i % 5 ? 79 : 83)).toFixed(1) + '"/>'; }
    $("#hydro-ticks").innerHTML = ticks;
    var hp = 0, holding = false, done = false, raf = null, last = 0, lastTxt = "";
    function paint() {
      box.style.setProperty("--hp", hp.toFixed(4));
      var t = nf.format(Math.round(hp * 5000 / 50) * 50);
      if (t !== lastTxt) { lastTxt = t; psi.textContent = t; }
    }
    function finish() {
      done = true; holding = false; hp = 1; paint(); box.classList.add("is-done");
      $("span", btn).textContent = "Presión de prueba alcanzada";
      note.textContent = "5,000 PSI: la presión máxima de prueba en nuestra planta.";
      specs.forEach(function (sp, k) { setTimeout(function () { sp.classList.add("is-lit"); }, RM.matches ? 0 : 140 * k); });
    }
    function loop(now) {
      var dt = Math.min(60, now - (last || now)); last = now;
      if (holding) hp = Math.min(1, hp + dt / 1900); else hp = Math.max(0, hp - dt / 900);
      paint();
      if (hp >= 1) { raf = null; finish(); return; }
      if (hp > 0 || holding) raf = requestAnimationFrame(loop); else { raf = null; last = 0; }
    }
    function press(e) { if (done) return; if (RM.matches) { finish(); return; } if (e && e.cancelable) e.preventDefault(); holding = true; if (!raf) { last = 0; raf = requestAnimationFrame(loop); } }
    function release() { holding = false; }
    btn.addEventListener("pointerdown", press);
    ["pointerup", "pointerleave", "pointercancel", "blur"].forEach(function (ev) { btn.addEventListener(ev, release); });
    btn.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    btn.addEventListener("keydown", function (e) { if ((e.key === " " || e.key === "Enter") && !e.repeat) press(e); else if (e.key === " " || e.key === "Enter") e.preventDefault(); });
    btn.addEventListener("keyup", release);
    window.PPS_pinHydro = function () { if (!done) finish(); };
  })();

  /* ---------- Proyectos ---------- */
  (function () {
    var list = $("#ledger"), filters = $("#filters"), more = $("#ledger-more"), countEl = $("#ledger-count");
    var state = { f: "all", all: false }, TOP = 8;
    var maxPD = Math.max.apply(null, D.projects.map(function (p) { return p.pd; }));
    var defs = [["all", "Todos"]].concat(Object.keys(D.sectors).map(function (k) { return [k, D.sectors[k]]; })).concat([["x", "Exportación"]]);
    var match = function (p, f) { return f === "all" || (f === "x" ? !!p.x : p.s === f); };
    defs.forEach(function (d) {
      var n = D.projects.filter(function (p) { return match(p, d[0]); }).length; if (!n) return;
      var b = document.createElement("button"); b.type = "button"; b.setAttribute("aria-pressed", String(d[0] === "all"));
      b.innerHTML = esc(d[1]) + "<small>" + n + "</small>";
      b.addEventListener("click", function () { state.f = d[0]; $$("button", filters).forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); }); render(); });
      filters.appendChild(b);
    });
    more.addEventListener("click", function () { state.all = !state.all; render(); });
    function render() {
      var rows = D.projects.filter(function (p) { return match(p, state.f); }).sort(function (a, b) { return b.pd - a.pd; });
      var total = rows.reduce(function (a, p) { return a + p.pd; }, 0), shownRows = state.all ? rows : rows.slice(0, TOP);
      list.innerHTML = shownRows.map(function (p, i) {
        return '<li class="row" style="animation-delay:' + Math.min(i, 10) * 40 + 'ms"><span class="row__c">' + esc(p.c) + (p.x ? '<span class="tag">Exportación</span>' : "") + '</span><span class="row__p">' + esc(p.p) + '</span><span class="row__l">' + esc(p.l) + " · " + esc(p.y) + '</span><span class="row__pd">' + nf.format(p.pd) + '<small>PD</small></span><span class="bar"><i data-w="' + Math.max(0.02, p.pd / maxPD).toFixed(3) + '"></i></span></li>';
      }).join("");
      countEl.textContent = rows.length + " proyectos · " + nf.format(total) + " PD";
      more.hidden = rows.length <= TOP;
      more.textContent = state.all ? "Ver menos" : "Ver los " + rows.length + " proyectos";
      requestAnimationFrame(function () { requestAnimationFrame(function () { $$(".bar i", list).forEach(function (b) { b.style.setProperty("--w", b.dataset.w); }); }); });
    }
    render();
  })();

  $("#faq-chat").addEventListener("click", function () { if (window.PPS_openChat) window.PPS_openChat(); else $("#chat-fab").click(); });

  /* ---------- Agenda ---------- */
  var DOW = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"], MON = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  function businessDays(n) {
    var out = [], d = new Date(); d.setHours(12, 0, 0, 0);
    while (out.length < n) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() !== 0 && d.getDay() !== 6) out.push({ label: DOW[d.getDay()] + " " + d.getDate() + " " + MON[d.getMonth()], dow: DOW[d.getDay()], day: d.getDate(), mon: MON[d.getMonth()] });
    }
    return out;
  }
  var days = businessDays(C.meetingDaysAhead || 8);
  window.PPS_SLOTS = { days: days.map(function (d) { return d.label; }), hours: C.meetingHours };
  $("#pick-day").innerHTML = days.map(function (d, i) {
    return '<label><input type="radio" name="dia" value="' + d.label + '"' + (i === 0 ? " checked" : "") + "><span><small>" + d.dow + "</small>" + d.day + " " + d.mon + "</span></label>";
  }).join("");
  $("#pick-time").innerHTML = C.meetingHours.map(function (h, i) {
    return '<label><input type="radio" name="hora" value="' + h + '"' + (i === 2 ? " checked" : "") + "><span>" + h + "</span></label>";
  }).join("");

  // Arma el texto de la solicitud y el enlace de correo. Lo usan el formulario y el chat.
  window.PPS_buildRequest = function (d) {
    var lines = [
      "Solicitud de reunión · PPS", "",
      "Nombre:    " + d.nombre,
      "Empresa:   " + d.empresa,
      "País:      " + (d.pais || "-"),
      "Sector:    " + (d.sector || "-"),
      "Correo:    " + d.correo,
      "Teléfono:  " + (d.telefono || "-"),
      "Modalidad: " + (d.modalidad || "Videollamada") + " (30 minutos)",
      "Fecha:     " + d.dia + ", " + d.hora + " (hora de Lima)"
    ];
    if (d.detalle) lines.push("", "Requerimiento:", d.detalle);
    var text = lines.join("\n"), subject = "Solicitud de reunión · " + d.empresa + " · " + d.dia + " " + d.hora;
    if (C.leadWebhook) { try { fetch(C.leadWebhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d), keepalive: true }).catch(function () {}); } catch (e) {} }
    return {
      text: text,
      mail: "mailto:" + C.salesEmail + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(text),
      wa: C.salesWhatsApp ? "https://wa.me/" + C.salesWhatsApp + "?text=" + encodeURIComponent(text) : ""
    };
  };

  var form = $("#booking"), err = $("#booking-error");
  var stepForm = $('[data-step="form"]', form), stepDone = $('[data-step="done"]', form);
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var d = {}; new FormData(form).forEach(function (v, k) { d[k] = String(v).trim(); });
    var bad = [];
    ["nombre", "empresa", "correo"].forEach(function (k) {
      var ok = !!d[k] && (k !== "correo" || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d[k]));
      form.elements[k].classList.toggle("is-bad", !ok); if (!ok) bad.push(k);
    });
    if (bad.length) {
      err.hidden = false;
      err.textContent = bad.indexOf("correo") > -1 && d.correo ? "Revise el correo: parece incompleto." : "Complete nombre, empresa y correo para poder confirmarle la reunión.";
      form.elements[bad[0]].focus(); return;
    }
    err.hidden = true;
    var r = window.PPS_buildRequest(d);
    $("#booking-summary").textContent = r.text;
    $("#send-mail").href = r.mail;
    var wa = $("#send-wa"); wa.hidden = !r.wa; if (r.wa) wa.href = r.wa;
    stepForm.hidden = true; stepDone.hidden = false;
    stepDone.scrollIntoView({ block: "nearest", behavior: RM.matches ? "auto" : "smooth" });
    window.location.href = r.mail;
  });
  $("#booking-edit").addEventListener("click", function () { stepDone.hidden = true; stepForm.hidden = false; });

  /* ---------- Movimiento reducido, en vivo y en ambos sentidos ---------- */
  function pinToFinalStates() {
    $$(".rv").forEach(function (el) { el.classList.add("in", "done"); });
    $$("[data-count]").forEach(count);
    if (window.PPS_pinHydro) window.PPS_pinHydro();
    parallax.forEach(function (P) { P.on = false; P.el.style.translate = ""; P.y = null; });
  }
  RM.addEventListener("change", function (e) { if (e.matches) pinToFinalStates(); applyHeroMode(); });
  if (RM.matches) pinToFinalStates();

  applyHeroMode();
})();
