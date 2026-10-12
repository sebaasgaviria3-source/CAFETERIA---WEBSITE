/* Bloom Coffee & Brunch: interactions (IIFE, no modules) */
(function () {
  "use strict";

  var B = window.__BRAND__ || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var smooth = function (x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  var easeOut = function (x) { return 1 - Math.pow(1 - clamp(x, 0, 1), 3); };
  var calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function safe(fn, name) { try { fn(); } catch (e) { if (window.console) console.warn("[bloom] " + name + " failed", e); } }

  /* ---------- Nav ---------- */
  function initNav() {
    var nav = $("#nav"), btn = $(".nav__toggle"); if (!nav) return;
    var onScroll = function () { nav.classList.toggle("is-scrolled", window.scrollY > 20); };
    onScroll(); window.addEventListener("scroll", onScroll, { passive: true });
    if (!btn) return;
    var set = function (open) {
      nav.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", String(open));
      btn.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
      document.body.style.overflow = open ? "hidden" : "";
    };
    btn.addEventListener("click", function () { set(btn.getAttribute("aria-expanded") !== "true"); });
    $$(".nav__links a").forEach(function (a) { a.addEventListener("click", function () { set(false); }); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") set(false); });
  }

  /* ---------- Reveal on scroll (threshold ≤ .05 + safety timeout) ---------- */
  function initReveal() {
    var els = $$(".reveal");
    if (!("IntersectionObserver" in window)) { els.forEach(function (el) { el.classList.add("is-in"); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } });
    }, { threshold: 0.05, rootMargin: "0px 0px -6% 0px" });
    els.forEach(function (el) { io.observe(el); });
    setTimeout(function () { els.forEach(function (el) { el.classList.add("is-in"); }); }, 6000);
  }

  /* ---------- Paseo: the drawing opens and the camera lands on the real place ----------
     Per scene, t runs 0→1 over its stretch of scroll:
       0.00–0.34  illustration holds (copy visible)
       0.34–0.60  camera dives into the drawing; the real photo/video unveils
       0.60–0.88  real place holds (caption visible)
       0.88–1.00  exit; the next scene emerges underneath                       */
  function initJourney() {
    var root = $(".journey"); if (!root) return;
    var scenes = $$(".scene", root); if (!scenes.length) return;
    var N = scenes.length;
    var rail = $$(".journey__rail li", root);
    var bar = $(".journey__bar span", root);
    var ENTER = 0.12;

    root.style.setProperty("--scenes", N);
    root.classList.add("is-live");

    // start fetching the real photos a screen before the walk, so each unveil is ready
    var warm = function () { $$(".unveil img", root).forEach(function (im) { im.loading = "eager"; }); };
    if ("IntersectionObserver" in window) {
      var wio = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { warm(); wio.disconnect(); } }, { rootMargin: "100% 0px" });
      wio.observe(root);
    } else warm();

    var data = scenes.map(function (sc, i) {
      sc.style.zIndex = String(N - i);
      sc.style.setProperty("--ox", (sc.getAttribute("data-ox") || 50) + "%");
      sc.style.setProperty("--oy", (sc.getAttribute("data-oy") || 50) + "%");
      return {
        el: sc,
        copy: $(".scene__copy", sc),
        unveil: $(".unveil", sc),
        frame: $(".unveil__frame", sc),
        video: $(".unveil video", sc),
        layers: $$(".layer", sc).map(function (l) { return { el: l, d: parseFloat(l.getAttribute("data-depth")) || 0 }; })
      };
    });

    var ticking = false;
    function render() {
      ticking = false;
      var rect = root.getBoundingClientRect();
      var total = root.offsetHeight - window.innerHeight;
      if (rect.bottom < -50 || rect.top > window.innerHeight + 50) {
        data.forEach(function (s) { if (s.video && !s.video.paused) s.video.pause(); });
        return;
      }
      var prog = clamp(-rect.top / Math.max(total, 1), 0, 1);
      var p = prog * N;
      if (bar) bar.style.transform = "scaleX(" + prog.toFixed(4) + ")";
      var active = clamp(Math.floor(p), 0, N - 1);
      rail.forEach(function (li, i) { li.classList.toggle("is-active", i === active); });

      data.forEach(function (s, i) {
        var t = p - i, first = i === 0, last = i === N - 1;
        var sceneOp = 0, z = 1, illOp = 1, unOp = 0, frameScale = 0.8;

        if (t < (first ? -1e9 : -ENTER) || (!last && t > 1)) {
          sceneOp = 0;
        } else {
          sceneOp = 1;
          if (t < 0) { var e = easeOut((t + ENTER) / ENTER); sceneOp = e; z = 0.86 + 0.14 * e; }
          else if (t < 0.34) { z = 1 + 0.05 * (t / 0.34); }
          else if (t < 0.6) {
            var x = (t - 0.34) / 0.26;
            z = 1.05 + 3.2 * x * x;
            illOp = 1 - smooth((x - 0.45) / 0.55);
            unOp = smooth((x - 0.3) / 0.6);
            frameScale = 0.8 + 0.2 * easeOut(x);
          } else {
            illOp = 0; unOp = 1; z = 4.25;
            frameScale = 1 + 0.04 * clamp((t - 0.6) / 0.28, 0, 1);
            if (!last && t > 0.88) {
              var y = (t - 0.88) / 0.12;
              frameScale = 1.04 + 0.5 * y * y;
              sceneOp = 1 - smooth(y);
            }
          }
        }
        if (calm) { z = 1; frameScale = 1; }

        s.el.style.opacity = sceneOp.toFixed(3);
        s.el.style.visibility = sceneOp <= 0.001 ? "hidden" : "visible";
        if (sceneOp > 0.001) {
          s.layers.forEach(function (l) {
            l.el.style.opacity = illOp.toFixed(3);
            l.el.style.visibility = illOp <= 0.001 ? "hidden" : "visible";
            if (illOp > 0.001) l.el.style.transform = "scale(" + (1 + (z - 1) * (1 + 0.35 * l.d)).toFixed(4) + ")";
          });
          if (s.unveil) s.unveil.style.opacity = unOp.toFixed(3);
          if (s.frame) s.frame.style.transform = "scale(" + frameScale.toFixed(4) + ")";
        }
        if (s.video) {
          if (unOp > 0.2 && sceneOp > 0.2) { if (s.video.paused) { var pr = s.video.play(); if (pr && pr.catch) pr.catch(function () {}); } }
          else if (!s.video.paused) s.video.pause();
        }
        if (s.copy) {
          var a = Math.min(clamp((t - 0.03) / 0.08, 0, 1), clamp((0.32 - t) / 0.06, 0, 1));
          if (first && p < 0.04) a = 1;
          if (last) a = Math.max(a, clamp((t - 0.62) / 0.08, 0, 1));
          s.copy.style.opacity = a.toFixed(3);
          s.copy.style.translate = "0 " + ((1 - a) * 18).toFixed(1) + "px";
          s.copy.style.pointerEvents = a > 0.5 ? "auto" : "none";
        }
      });
    }
    var req = function () { if (!ticking) { ticking = true; requestAnimationFrame(render); } };
    window.addEventListener("scroll", req, { passive: true });
    window.addEventListener("resize", req);
    render();
  }

  /* ---------- Menu tabs (ARIA tabs, arrow keys) ---------- */
  function initTabs() {
    var tabs = $$(".menu__tabs [role='tab']"); if (!tabs.length) return;
    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute("aria-controls"));
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
      var list = tab.parentNode;
      if (list.scrollWidth > list.clientWidth) list.scrollTo({ left: tab.offsetLeft - 16, behavior: "smooth" });
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(t, false); });
      t.addEventListener("keydown", function (e) {
        var n = null;
        if (e.key === "ArrowRight") n = tabs[(i + 1) % tabs.length];
        if (e.key === "ArrowLeft") n = tabs[(i - 1 + tabs.length) % tabs.length];
        if (e.key === "Home") n = tabs[0];
        if (e.key === "End") n = tabs[tabs.length - 1];
        if (n) { e.preventDefault(); select(n, true); }
      });
    });
  }

  /* ---------- Opening status, computed in Vigo's time zone from the official hours ---------- */
  function madridNow() {
    var parts = new Intl.DateTimeFormat("en-GB", { timeZone: B.timeZone || "Europe/Madrid", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
    var map = {}; parts.forEach(function (p) { map[p.type] = p.value; });
    var days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return { day: days[map.weekday], min: (parseInt(map.hour, 10) % 24) * 60 + parseInt(map.minute, 10) };
  }
  function hhmm(m) { return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); }
  var DAY_NAMES = ["el domingo", "el lunes", "el martes", "el miércoles", "el jueves", "el viernes", "el sábado"];
  function initHours() {
    var H = B.hours; if (!H || !window.Intl) return;
    var now = madridNow();
    $$(".hours li[data-days]").forEach(function (li) {
      if (li.getAttribute("data-days").split(",").map(Number).indexOf(now.day) !== -1) li.classList.add("is-today");
    });
    var today = H[now.day], open = !!(today && now.min >= today[0] && now.min < today[1]);
    var label;
    if (open) label = "Abierto ahora · hasta las " + hhmm(today[1]);
    else if (today && now.min < today[0]) label = "Cerrado ahora · abrimos hoy a las " + hhmm(today[0]);
    else {
      for (var k = 1; k <= 7; k++) {
        var d = (now.day + k) % 7;
        if (H[d]) { label = "Cerrado ahora · abrimos " + (k === 1 ? "mañana" : DAY_NAMES[d]) + " a las " + hhmm(H[d][0]); break; }
      }
    }
    $$("[data-open-status]").forEach(function (el) {
      el.classList.toggle("is-open", open);
      var l = $("[data-open-label]", el); if (l) l.textContent = label;
      el.hidden = false;
    });
  }

  /* ---------- Tour carousel ---------- */
  function initTour() {
    var track = $(".tour__track"); if (!track) return;
    $$("[data-tour]").forEach(function (b) {
      b.addEventListener("click", function () {
        var item = $(".tour__item", track);
        var step = item ? item.getBoundingClientRect().width + 16 : track.clientWidth * 0.8;
        track.scrollBy({ left: step * parseInt(b.getAttribute("data-tour"), 10), behavior: calm ? "auto" : "smooth" });
      });
    });
  }

  /* ---------- Map: lazy embed (no API key) ---------- */
  function initMap() {
    var box = $("[data-map]"); if (!box || B.mapEmbed === false) return;
    var load = function () {
      if (box.querySelector("iframe")) return;
      var f = document.createElement("iframe");
      f.title = "Mapa: Bloom Coffee & Brunch, Calle Ángel Llanos 10, Vigo";
      f.loading = "lazy";
      f.referrerPolicy = "no-referrer-when-downgrade";
      f.src = "https://www.google.com/maps?q=" + encodeURIComponent(B.mapsQuery || "Calle Ángel Llanos 10, Vigo") + "&output=embed";
      box.innerHTML = ""; box.appendChild(f);
    };
    if (!("IntersectionObserver" in window)) return load();
    var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { load(); io.disconnect(); } }, { rootMargin: "300px" });
    io.observe(box);
  }

  /* ---------- Videos outside the paseo: play only while visible ---------- */
  function initVideos() {
    var vids = $$("video[data-autoplay]").filter(function (v) { return !v.closest(".journey"); });
    if (!vids.length || !("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var v = en.target;
        if (en.isIntersecting && !calm) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); }
        else v.pause();
      });
    }, { threshold: 0.25 });
    vids.forEach(function (v) { v.muted = true; io.observe(v); });
  }

  function boot() {
    safe(initNav, "nav");
    safe(initHours, "hours");
    safe(initReveal, "reveal");
    safe(initJourney, "journey");
    safe(initTabs, "tabs");
    safe(initTour, "tour");
    safe(initMap, "map");
    safe(initVideos, "videos");
    $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
