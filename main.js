/* Bloom Coffee Brunch Brasil: interactions (IIFE, no modules) */
(function () {
  "use strict";

  var B = window.__BRAND__ || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  function safe(fn, name) { try { fn(); } catch (e) { if (window.console) console.warn("[bloom] " + name + " failed", e); } }

  /* ---------- Splash ---------- */
  function initSplash() {
    var s = $(".splash"); if (!s) return;
    var hide = function () { s.classList.add("is-hidden"); };
    if (document.readyState === "complete") setTimeout(hide, 500);
    else window.addEventListener("load", function () { setTimeout(hide, 300); });
    setTimeout(hide, 2500);
  }

  /* ---------- Nav ---------- */
  function initNav() {
    var nav = $("#nav"), btn = $(".nav__toggle"); if (!nav) return;
    var onScroll = function () { nav.classList.toggle("is-scrolled", window.scrollY > 40); };
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

  /* ---------- Journey: scroll-scrubbed fly-through over real photos ---------- */
  function initJourney() {
    var root = $(".journey"); if (!root) return;
    var scenes = $$(".scene", root); if (!scenes.length) return;
    var N = scenes.length;
    var rail = $$(".journey__rail li", root);
    var bar = $(".journey__bar span", root);
    var ENTER = 0.22, EXIT = 0.78;
    var calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    root.style.setProperty("--scenes", N);
    root.classList.add("is-live");

    var data = scenes.map(function (sc, i) {
      sc.style.zIndex = String(N - i);
      return {
        el: sc,
        shot: $(".shot", sc),
        copy: $(".scene__copy", sc),
        layers: $$(".layer", sc).map(function (l) { return { el: l, d: parseFloat(l.getAttribute("data-depth")) || 0 }; })
      };
    });

    // Zoom origin = centre of the photo, so the camera "enters" the picture
    function measure() {
      data.forEach(function (s) {
        if (!s.shot) return;
        var cx = s.shot.offsetLeft + s.shot.offsetWidth / 2;
        var cy = s.shot.offsetTop + s.shot.offsetHeight / 2;
        // offsetLeft/Top ignore the translate(-50%,-50%) on .shot
        cx -= s.shot.offsetWidth / 2; cy -= s.shot.offsetHeight / 2;
        var w = s.el.clientWidth || 1, h = s.el.clientHeight || 1;
        s.el.style.setProperty("--ox", (cx / w * 100).toFixed(2) + "%");
        s.el.style.setProperty("--oy", (cy / h * 100).toFixed(2) + "%");
      });
    }

    var ease = function (x) { return 1 - Math.pow(1 - x, 3); };
    var ticking = false;

    function render() {
      ticking = false;
      var rect = root.getBoundingClientRect();
      var total = root.offsetHeight - window.innerHeight;
      if (rect.bottom < -50 || rect.top > window.innerHeight + 50) return;
      var prog = clamp(-rect.top / Math.max(total, 1), 0, 1);
      var p = prog * N;
      if (bar) bar.style.transform = "scaleX(" + prog.toFixed(4) + ")";
      var active = clamp(Math.floor(p), 0, N - 1);
      rail.forEach(function (li, i) { li.classList.toggle("is-active", i === active); });

      data.forEach(function (s, i) {
        var t = p - i, z = 1, op = 0, last = i === N - 1, first = i === 0;
        if (t < (first ? -1e9 : -ENTER) || (!last && t > 1)) {
          op = 0;
        } else if (t < 0) {                      // emerging from behind
          var e = ease((t + ENTER) / ENTER);
          z = 0.86 + 0.14 * e; op = e;
        } else if (!last && t > EXIT) {          // diving into the photo
          var x = (t - EXIT) / (1 - EXIT);
          z = 1.05 + 1.9 * x * x;
          op = 1 - clamp((x - 0.3) / 0.7, 0, 1);
        } else {                                 // hold, slow drift
          z = 1 + 0.05 * clamp(t, 0, 1); op = 1;
        }
        if (calm) z = 1;
        s.el.style.opacity = op.toFixed(3);
        s.el.style.visibility = op <= 0.001 ? "hidden" : "visible";
        if (op > 0.001) {
          s.layers.forEach(function (l) {
            var sc = 1 + (z - 1) * (l.d ? 1.25 : 0.55);
            l.el.style.transform = "scale(" + sc.toFixed(4) + ")";
          });
        }
        if (s.copy) {
          var a = last ? clamp((t - 0.05) / 0.12, 0, 1)
                       : Math.min(clamp((t - 0.06) / 0.12, 0, 1), clamp((0.74 - t) / 0.1, 0, 1));
          if (first && p < 0.06) a = 1;
          s.copy.style.opacity = a.toFixed(3);
          s.copy.style.translate = "0 " + ((1 - a) * 20).toFixed(1) + "px";
          s.copy.style.pointerEvents = a > 0.5 ? "auto" : "none";
        }
      });
    }
    var req = function () { if (!ticking) { ticking = true; requestAnimationFrame(render); } };
    window.addEventListener("scroll", req, { passive: true });
    window.addEventListener("resize", function () { measure(); req(); });
    window.addEventListener("load", function () { measure(); req(); });
    measure();
    render();
  }

  /* ---------- Menu tabs (ARIA tabs, arrow-key navigation) ---------- */
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
      if (tab.scrollIntoView && tab.parentNode.scrollWidth > tab.parentNode.clientWidth) {
        tab.parentNode.scrollTo({ left: tab.offsetLeft - 16, behavior: "smooth" });
      }
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(t, false); });
      t.addEventListener("keydown", function (e) {
        var k = e.key, n = null;
        if (k === "ArrowRight") n = tabs[(i + 1) % tabs.length];
        if (k === "ArrowLeft") n = tabs[(i - 1 + tabs.length) % tabs.length];
        if (k === "Home") n = tabs[0];
        if (k === "End") n = tabs[tabs.length - 1];
        if (n) { e.preventDefault(); select(n, true); }
      });
    });
  }

  /* ---------- Hours: highlight today's row (not an "open now" claim) ---------- */
  function initHours() {
    var d = new Date().getDay();
    $$(".hours li[data-days]").forEach(function (li) {
      var days = li.getAttribute("data-days").split(",").map(Number);
      if (days.indexOf(d) !== -1) li.classList.add("is-today");
    });
  }

  /* ---------- Brand data from lib/manifest.js ---------- */
  function initBrand() {
    $$("[data-brand='address']").forEach(function (el) { if (B.address) el.innerHTML = B.address; });
    var star = B.star || {};
    var price = $("[data-brand='star.price']");
    if (price && star.price) { price.textContent = star.price; price.hidden = false; }
    var note = $("[data-brand='star.note']");
    if (note && star.note) note.textContent = star.note;

    var links = {
      phone: B.phone && { href: "tel:" + B.phone.replace(/\s+/g, ""), text: B.phone },
      whatsapp: B.whatsapp && { href: "https://wa.me/" + B.whatsapp.replace(/\D/g, ""), text: "WhatsApp", ext: true },
      instagram: B.instagram && { href: B.instagram, text: "Instagram", ext: true },
      email: B.email && { href: "mailto:" + B.email, text: B.email }
    };
    Object.keys(links).forEach(function (k) {
      var li = $(".contact [data-brand='" + k + "']"); var v = links[k];
      if (!li || !v || li.children.length > 0) return;
      var a = document.createElement("a");
      a.href = v.href; a.textContent = v.text;
      if (v.ext) { a.target = "_blank"; a.rel = "noopener"; }
      li.appendChild(a); li.hidden = false;
    });
    if (B.mapsQuery) {
      var url = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(B.mapsQuery);
      $$("[data-brand='maps'], .visit__map-fallback").forEach(function (a) { a.href = url; });
    }
    $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
  }

  /* ---------- Map: lazy embed (no API key) ---------- */
  function initMap() {
    var box = $("[data-map]"); if (!box || B.mapEmbed === false) return;
    var load = function () {
      if (box.querySelector("iframe")) return;
      var f = document.createElement("iframe");
      f.title = "Mapa: cómo llegar a Bloom Coffee Brunch Brasil";
      f.loading = "lazy";
      f.referrerPolicy = "no-referrer-when-downgrade";
      f.src = "https://www.google.com/maps?q=" + encodeURIComponent(B.mapsQuery || "Bloom Coffee Brunch Vigo") + "&output=embed";
      box.innerHTML = ""; box.appendChild(f);
    };
    if (!("IntersectionObserver" in window)) return load();
    var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { load(); io.disconnect(); } }, { rootMargin: "300px" });
    io.observe(box);
  }

  /* ---------- Videos: play only while visible ---------- */
  function initVideos() {
    var vids = $$("video[data-autoplay]"); if (!vids.length || !("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var v = en.target;
        if (en.isIntersecting) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); }
        else v.pause();
      });
    }, { threshold: 0.05 });
    vids.forEach(function (v) { v.muted = true; io.observe(v); });
  }

  function boot() {
    safe(initSplash, "splash");
    safe(initNav, "nav");
    safe(initBrand, "brand");
    safe(initHours, "hours");
    safe(initReveal, "reveal");
    safe(initJourney, "journey");
    safe(initTabs, "tabs");
    safe(initMap, "map");
    safe(initVideos, "videos");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
