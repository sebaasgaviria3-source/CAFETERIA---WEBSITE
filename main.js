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

  /* ---------- Paseo: each photo opens into the next ----------
     Scroll position p runs 0 → N-1 (+ a short final hold). In segment i:
       0–HOLD     scene i rests, copy visible
       HOLD–1     scene i dives toward its focal point (data-fx/fy on the plate)
                  while scene i+1 opens out of that same point through a growing
                  rounded window (clip-path inset) and settles from 1.22 → 1.
     Reduced motion: plain crossfades, no zoom or clipping. */
  function initJourney() {
    var root = $(".journey"); if (!root) return;
    var stage = $(".journey__stage", root);
    var scenes = $$(".scene", root); if (!scenes.length || !stage) return;
    var N = scenes.length, HOLD = 0.38, TAIL = 0.5;
    var rail = $$(".journey__rail li", root);
    var bar = $(".journey__bar span", root);
    var inOut = function (x) { x = clamp(x, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };

    root.style.setProperty("--scenes", N);
    root.classList.add("is-live");

    // fetch every photo a screen before the walk so each opening is ready
    var warm = function () { $$(".scene img", root).forEach(function (im) { im.loading = "eager"; if (im.decode) im.decode().catch(function () {}); }); };
    if ("IntersectionObserver" in window) {
      var wio = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { warm(); wio.disconnect(); } }, { rootMargin: "100% 0px" });
      wio.observe(root);
    } else warm();

    var data = scenes.map(function (s, i) {
      s.style.zIndex = String(i + 1);
      return {
        el: s, inner: $(".scene__in", s), plate: $(".scene__plate", s), copy: $(".scene__copy", s), video: $("video", s),
        fx: parseFloat(s.getAttribute("data-fx")) || 0.5, fy: parseFloat(s.getAttribute("data-fy")) || 0.5, x: 0, y: 0
      };
    });
    var W = 0, H = 0;
    // focal points in stage pixels (offsets ignore transforms, so this is the resting layout)
    function measure() {
      W = stage.clientWidth; H = stage.clientHeight;
      data.forEach(function (d) {
        d.x = d.plate.offsetLeft + d.plate.offsetWidth * d.fx;
        d.y = d.plate.offsetTop + d.plate.offsetHeight * d.fy;
        d.pl = d.plate.offsetLeft; d.pt = d.plate.offsetTop; d.pw = d.plate.offsetWidth; d.ph = d.plate.offsetHeight;
        d.inner.style.transformOrigin = d.x.toFixed(1) + "px " + d.y.toFixed(1) + "px";
      });
    }

    function setCopy(d, a) {
      if (!d.copy) return;
      d.copy.style.opacity = a.toFixed(3);
      d.copy.style.transform = calm ? "none" : "translateY(" + ((1 - a) * 16).toFixed(1) + "px)";
      d.copy.style.visibility = a <= 0.01 ? "hidden" : "visible";
    }

    var ticking = false;
    function render() {
      ticking = false;
      var rect = root.getBoundingClientRect();
      if (rect.bottom < -50 || rect.top > window.innerHeight + 50) {
        data.forEach(function (d) { if (d.video && !d.video.paused) d.video.pause(); });
        return;
      }
      var total = root.offsetHeight - window.innerHeight;
      var prog = clamp(-rect.top / Math.max(total, 1), 0, 1);
      var p = prog * (N - 1 + TAIL);
      if (bar) bar.style.transform = "scaleX(" + prog.toFixed(4) + ")";

      var seg = clamp(Math.floor(p), 0, N - 1);            // scene at rest / diving out
      var e = seg < N - 1 ? inOut((p - seg - HOLD) / (1 - HOLD)) : 0;  // opening progress of seg+1
      var active = e > 0.5 ? seg + 1 : seg;
      rail.forEach(function (li, i) { li.classList.toggle("is-active", i === active); });

      data.forEach(function (d, i) {
        var show = i === seg || (i === seg + 1 && e > 0);
        d.el.style.visibility = show ? "visible" : "hidden";
        if (d.video) {
          var play = show && !calm;
          if (play && d.video.paused) { var pr = d.video.play(); if (pr && pr.catch) pr.catch(function () {}); }
          else if (!play && !d.video.paused) d.video.pause();
        }
        if (!show) return;

        if (i === seg) {                                     // the scene you are in
          d.el.style.clipPath = "none"; d.el.style.opacity = "1";
          d.inner.style.transform = calm ? "none" : "scale(" + (1 + 0.6 * e).toFixed(4) + ")";
          setCopy(d, 1 - clamp(e / 0.35, 0, 1));
        } else {                                             // the next one, opening from the focal point
          var src = data[seg];
          if (calm) { d.el.style.opacity = e.toFixed(3); d.el.style.clipPath = "none"; d.inner.style.transform = "none"; }
          else {
            // the window grows in two moves: from a small pane at the focal point to
            // exactly the next photo (only photo shows), then out to the whole scene
            var sc = 1.22 - 0.22 * e, ox = src.x, oy = src.y;
            var pl = ox + (d.pl - ox) * sc, pt = oy + (d.pt - oy) * sc;
            var pr = ox + (d.pl + d.pw - ox) * sc, pb = oy + (d.pt + d.ph - oy) * sc;
            var w0 = Math.min(src.pw, d.pw) * 0.2, h0 = Math.min(src.ph, d.ph) * 0.2;
            var l, t, r, b, rad, k;
            if (e < 0.6) {
              k = e / 0.6;
              l = (ox - w0 / 2) + (pl - (ox - w0 / 2)) * k; t = (oy - h0 / 2) + (pt - (oy - h0 / 2)) * k;
              r = (ox + w0 / 2) + (pr - (ox + w0 / 2)) * k; b = (oy + h0 / 2) + (pb - (oy + h0 / 2)) * k;
              rad = 24 * sc;
            } else {
              k = smooth((e - 0.6) / 0.4);
              l = pl * (1 - k); t = pt * (1 - k); r = pr + (W - pr) * k; b = pb + (H - pb) * k;
              rad = 24 * sc * (1 - k);
            }
            r = W - r; b = H - b;
            d.el.style.opacity = "1";
            d.el.style.clipPath = "inset(" + t.toFixed(1) + "px " + r.toFixed(1) + "px " + b.toFixed(1) + "px " + l.toFixed(1) + "px round " + rad.toFixed(1) + "px)";
            d.inner.style.transformOrigin = src.x.toFixed(1) + "px " + src.y.toFixed(1) + "px";
            d.inner.style.transform = "scale(" + (1.22 - 0.22 * e).toFixed(4) + ")";
          }
          setCopy(d, clamp((e - 0.7) / 0.3, 0, 1));
        }
      });
      // restore each scene's own origin once it is the resting scene again
      var cur = data[seg]; cur.inner.style.transformOrigin = cur.x.toFixed(1) + "px " + cur.y.toFixed(1) + "px";
    }
    var req = function () { if (!ticking) { ticking = true; requestAnimationFrame(render); } };
    window.addEventListener("scroll", req, { passive: true });
    window.addEventListener("resize", function () { measure(); req(); });
    window.addEventListener("load", function () { measure(); req(); });
    measure(); render();
  }

  /* ---------- La carta: ARIA tabs (vertical index on desktop, chips on mobile) ---------- */
  function initTabs() {
    var tabs = $$(".menu__tabs [role='tab']"); if (!tabs.length) return;
    var list = tabs[0].parentNode;
    var mq = window.matchMedia ? window.matchMedia("(min-width: 980px)") : null;
    var orient = function () { list.setAttribute("aria-orientation", mq && mq.matches ? "vertical" : "horizontal"); };
    orient(); if (mq && mq.addEventListener) mq.addEventListener("change", orient);
    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute("aria-controls"));
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
      if (list.scrollWidth > list.clientWidth) list.scrollTo({ left: tab.offsetLeft - 16, behavior: calm ? "auto" : "smooth" });
      // on the sticky chip bar, bring the top of the sheet back under it
      var book = $(".menu__book"), panel = document.getElementById(tab.getAttribute("aria-controls"));
      if (book && panel && !(mq && mq.matches)) {
        var top = panel.getBoundingClientRect().top - list.getBoundingClientRect().bottom;
        if (top < 0) window.scrollBy({ top: top - 12, behavior: calm ? "auto" : "smooth" });
      }
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(t, false); });
      t.addEventListener("keydown", function (e) {
        var n = null;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") n = tabs[(i + 1) % tabs.length];
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") n = tabs[(i - 1 + tabs.length) % tabs.length];
        if (e.key === "Home") n = tabs[0];
        if (e.key === "End") n = tabs[tabs.length - 1];
        if (n) { e.preventDefault(); select(n, true); }
      });
    });
  }

  /* ---------- La carta: the arched photo opens onto the dish you point at ----------
     Thumbnails work everywhere (buttons); pointing at a dish with a photo does
     the same on devices with a fine pointer. The new photo opens as a circle
     rising from the bottom of the arch; reduced motion gets a crossfade. */
  function initCarte() {
    var fine = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    $$(".sheet").forEach(function (sheet) {
      var frame = $(".sheet__frame", sheet); if (!frame) return;
      var thumbs = $$(".sheet__thumb", sheet);
      var current = ($(".sheet__img", frame).getAttribute("src").match(/img\/(.+)-800\.webp/) || [])[1];
      function show(name, alt) {
        if (!name || name === current) return;
        current = name;
        thumbs.forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-photo") === name)); });
        $$(".carte__item--photo", sheet).forEach(function (li) { li.classList.toggle("is-shown", li.getAttribute("data-photo") === name); });
        var im = new Image();
        im.className = "sheet__img is-entering";
        im.alt = alt || "";
        im.sizes = "(max-width: 979px) 92vw, 440px";
        im.srcset = "assets/img/" + name + "-800.webp 800w, assets/img/" + name + "-1600.webp 1600w";
        im.src = "assets/img/" + name + "-800.webp";
        var go = function () {
          if (current !== name) return;                 // a newer choice already won
          frame.appendChild(im);
          requestAnimationFrame(function () { requestAnimationFrame(function () { im.classList.add("is-open"); }); });
          setTimeout(function () {
            if (current !== name) return;                 // the newer photo cleans up instead
            $$(".sheet__img", frame).forEach(function (o) { if (o !== im) o.remove(); });
            im.classList.remove("is-entering", "is-open");
          }, 850);
        };
        if (im.decode) im.decode().then(go, go); else im.onload = go;
      }
      thumbs.forEach(function (b) { b.addEventListener("click", function () { show(b.getAttribute("data-photo"), b.getAttribute("data-alt")); }); });
      if (fine) $$(".carte__item--photo", sheet).forEach(function (li) {
        li.addEventListener("mouseenter", function () { show(li.getAttribute("data-photo"), li.getAttribute("data-alt")); });
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
    safe(initCarte, "carte");
    safe(initTour, "tour");
    safe(initMap, "map");
    safe(initVideos, "videos");
    $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
