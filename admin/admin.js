/* Bloom Coffee & Brunch · panel de stock (client) */
(function () {
  "use strict";
  var app = document.getElementById("app");
  if (!app) return;
  var CSRF = app.getAttribute("data-csrf");
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var state = { items: [], movements: [], categories: [], units: [] };
  var filters = { q: "", cat: "", status: "" };

  var fmtNum = function (n) { return Number(n).toLocaleString("es-ES", { maximumFractionDigits: 3 }); };
  var fmtDate = function (iso) {
    var d = new Date(iso);
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" }) + " " + d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  };
  var statusOf = function (it) { return it.archived ? "archived" : it.qty <= 0 ? "out" : it.qty <= it.min ? "low" : "ok"; };
  var STATUS_LABEL = { ok: "En stock", low: "Stock bajo", out: "Agotado · por reponer", archived: "Archivado" };
  var TYPE_LABEL = { in: "Entrada", out: "Salida", adjust: "Ajuste" };

  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text != null) e.textContent = text;
    return e;
  }

  function toast(msg) {
    var t = $("[data-toast]"); t.textContent = msg; t.classList.add("is-on");
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("is-on"); }, 2600);
  }

  function api(method, payload) {
    var opts = { method: method, credentials: "same-origin", headers: { "Accept": "application/json" } };
    if (payload) {
      payload.csrf = CSRF;
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(payload);
    }
    return fetch("api.php" + (method === "GET" ? "?action=state" : ""), opts).then(function (r) {
      if (r.status === 401) { location.reload(); throw new Error("Sesión caducada"); }
      return r.json().then(function (j) { if (!j.ok) throw new Error(j.error || "Error"); return j; });
    });
  }

  function load(json) {
    state = json;
    renderFilters();
    render();
  }

  /* ---------- render ---------- */
  function renderFilters() {
    var sel = $("[data-filter='cat']"), cur = sel.value;
    sel.length = 1;
    state.categories.forEach(function (c) { sel.appendChild(el("option", { value: c }, c)); });
    sel.value = cur;
  }

  function render() {
    var active = state.items.filter(function (i) { return !i.archived; });
    $("[data-kpi='total']").textContent = active.length;
    $("[data-kpi='low']").textContent = active.filter(function (i) { return statusOf(i) === "low"; }).length;
    $("[data-kpi='out']").textContent = active.filter(function (i) { return statusOf(i) === "out"; }).length;

    var q = filters.q.trim().toLowerCase();
    var rows = state.items.filter(function (i) {
      var st = statusOf(i);
      if (filters.status ? st !== filters.status : st === "archived") return false;
      if (filters.cat && i.category !== filters.cat) return false;
      if (q && (i.name + " " + i.category + " " + (i.notes || "")).toLowerCase().indexOf(q) === -1) return false;
      return true;
    }).sort(function (a, b) {
      var rank = { out: 0, low: 1, ok: 2, archived: 3 };
      return (rank[statusOf(a)] - rank[statusOf(b)]) || a.name.localeCompare(b.name, "es");
    });

    var tb = $("[data-rows]"); tb.textContent = "";
    rows.forEach(function (it) {
      var st = statusOf(it), tr = el("tr", { "data-status": st });
      var name = el("td", { "data-label": "Artículo" });
      name.appendChild(el("strong", null, it.name));
      if (it.notes) name.appendChild(el("small", null, it.notes));
      tr.appendChild(name);
      tr.appendChild(el("td", { "data-label": "Categoría" }, it.category));
      tr.appendChild(el("td", { "class": "num", "data-label": "Stock" }, fmtNum(it.qty) + " " + it.unit));
      tr.appendChild(el("td", { "class": "num", "data-label": "Mínimo" }, fmtNum(it.min) + " " + it.unit));
      var badge = el("td", { "data-label": "Estado" }); badge.appendChild(el("span", { "class": "badge badge--" + st }, STATUS_LABEL[st])); tr.appendChild(badge);
      var acts = el("td", { "class": "acts" });
      if (!it.archived) {
        acts.appendChild(el("button", { "class": "btn btn--sm btn--primary", "data-act": "in", "data-id": it.id }, "+ Entrada"));
        acts.appendChild(el("button", { "class": "btn btn--sm btn--ghost", "data-act": "out", "data-id": it.id }, "− Salida"));
        acts.appendChild(el("button", { "class": "btn btn--sm btn--ghost", "data-act": "adjust", "data-id": it.id }, "Ajustar"));
        acts.appendChild(el("button", { "class": "btn btn--sm btn--ghost", "data-act": "edit", "data-id": it.id }, "Editar"));
        acts.appendChild(el("button", { "class": "btn btn--sm btn--quiet", "data-act": "archive", "data-id": it.id }, "Archivar"));
      } else {
        acts.appendChild(el("button", { "class": "btn btn--sm btn--ghost", "data-act": "restore", "data-id": it.id }, "Restaurar"));
      }
      tr.appendChild(acts);
      tb.appendChild(tr);
    });
    $("[data-empty]").hidden = rows.length > 0;

    var mb = $("[data-moves]"); mb.textContent = "";
    state.movements.slice(0, 150).forEach(function (m) {
      var tr = el("tr");
      tr.appendChild(el("td", { "data-label": "Fecha" }, fmtDate(m.at)));
      tr.appendChild(el("td", { "data-label": "Artículo" }, m.item));
      var ty = el("td", { "data-label": "Tipo" }); ty.appendChild(el("span", { "class": "badge badge--mv-" + m.type }, TYPE_LABEL[m.type] || m.type)); tr.appendChild(ty);
      var sign = m.type === "out" ? "−" : m.qty > 0 ? "+" : m.qty < 0 ? "−" : "±";
      tr.appendChild(el("td", { "class": "num", "data-label": "Cantidad" }, sign + fmtNum(Math.abs(m.qty)) + " " + m.unit));
      tr.appendChild(el("td", { "class": "num", "data-label": "Stock tras" }, fmtNum(m.after) + " " + m.unit));
      tr.appendChild(el("td", { "data-label": "Nota" }, m.note || "—"));
      mb.appendChild(tr);
    });
    $("[data-moves-empty]").hidden = state.movements.length > 0;
  }

  /* ---------- item dialog ---------- */
  var itemDlg = $("[data-item-dialog]"), itemForm = $("[data-item-form]");
  function openItem(it) {
    itemForm.reset();
    $("[data-item-error]").hidden = true;
    var cat = itemForm.elements.category; cat.length = 0;
    state.categories.forEach(function (c) { cat.appendChild(el("option", { value: c }, c)); });
    var unit = itemForm.elements.unit; unit.length = 0;
    state.units.forEach(function (u) { unit.appendChild(el("option", { value: u }, u)); });
    $("[data-item-title]").textContent = it ? "Editar artículo" : "Nuevo artículo";
    $("[data-initial]").hidden = !!it;
    itemForm.elements.id.value = it ? it.id : "";
    if (it) {
      itemForm.elements.name.value = it.name; cat.value = it.category; unit.value = it.unit;
      itemForm.elements.min.value = it.min; itemForm.elements.notes.value = it.notes || "";
    }
    itemDlg.showModal();
    itemForm.elements.name.focus();
  }
  $("[data-item-save]").addEventListener("click", function (e) {
    e.preventDefault();
    var f = itemForm.elements;
    var payload = { action: "item.save", id: f.id.value || 0, name: f.name.value, category: f.category.value, newCategory: f.newCategory.value, unit: f.unit.value, min: f.min.value, notes: f.notes.value };
    if (!f.id.value) payload.qty = f.qty.value;
    api("POST", payload).then(function (j) { load(j); itemDlg.close(); toast("Artículo guardado"); })
      .catch(function (err) { var m = $("[data-item-error]"); m.textContent = err.message; m.hidden = false; });
  });

  /* ---------- movement dialog ---------- */
  var moveDlg = $("[data-move-dialog]"), moveForm = $("[data-move-form]"), moveItem = null;
  function moveHint() {
    if (!moveItem) return;
    var type = moveForm.elements.type.value;
    $("[data-qty-label]").textContent = type === "adjust" ? "Cantidad contada (" + moveItem.unit + ")" : "Cantidad (" + moveItem.unit + ")";
    $("[data-move-hint]").textContent = "Stock actual: " + fmtNum(moveItem.qty) + " " + moveItem.unit + " · mínimo " + fmtNum(moveItem.min) + " " + moveItem.unit;
  }
  function openMove(it, type) {
    moveItem = it;
    moveForm.reset();
    moveForm.elements.id.value = it.id;
    moveForm.elements.type.value = type;
    $("[data-move-title]").textContent = it.name;
    $("[data-move-error]").hidden = true;
    moveHint();
    moveDlg.showModal();
    moveForm.elements.qty.focus();
  }
  Array.prototype.forEach.call(moveForm.elements.type, function (r) { r.addEventListener("change", moveHint); });
  $("[data-move-save]").addEventListener("click", function (e) {
    e.preventDefault();
    var f = moveForm.elements;
    api("POST", { action: "move", id: f.id.value, type: f.type.value, qty: f.qty.value, note: f.note.value })
      .then(function (j) { load(j); moveDlg.close(); toast("Movimiento registrado"); })
      .catch(function (err) { var m = $("[data-move-error]"); m.textContent = err.message; m.hidden = false; });
  });

  /* ---------- events ---------- */
  $("[data-new]").addEventListener("click", function () { openItem(null); });
  $("[data-rows]").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-act]"); if (!b) return;
    var id = Number(b.getAttribute("data-id"));
    var it = state.items.filter(function (i) { return i.id === id; })[0]; if (!it) return;
    var act = b.getAttribute("data-act");
    if (act === "edit") openItem(it);
    else if (act === "archive" || act === "restore") {
      if (act === "archive" && !confirm("¿Archivar «" + it.name + "»? Podrás restaurarlo desde el filtro «Archivados».")) return;
      api("POST", { action: "item.archive", id: id, archived: act === "archive" }).then(function (j) { load(j); toast(act === "archive" ? "Artículo archivado" : "Artículo restaurado"); }).catch(function (err) { toast(err.message); });
    } else openMove(it, act);
  });
  document.querySelectorAll("[data-filter]").forEach(function (inp) {
    inp.addEventListener("input", function () { filters[inp.getAttribute("data-filter")] = inp.value; render(); });
  });
  [itemDlg, moveDlg].forEach(function (d) {
    d.addEventListener("click", function (e) { if (e.target === d) d.close(); });
  });

  api("GET").then(load).catch(function (err) { toast(err.message); });
  // keep alerts current if someone else updates stock from another device
  setInterval(function () {
    if (document.visibilityState === "visible" && !itemDlg.open && !moveDlg.open) api("GET").then(load).catch(function () {});
  }, 60000);
})();
