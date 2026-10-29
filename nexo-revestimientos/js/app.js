(function () {
  "use strict";

  var CFG = window.NEXO_CONFIG || {};
  var STOCK_BAJO = 10; // a partir de cuántas unidades se muestra "Últimas"
  var CART_KEY = "nexo-presupuesto";

  var productos = [];
  var filtro = { cat: "Todas", q: "", soloStock: false };
  var cart = loadCart();

  var $ = function (sel) { return document.querySelector(sel); };
  var fmtPeso = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
  var fmtNum = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

  // ---------- Carga de datos ----------

  function cargarProductos() {
    if (CFG.sheetCsvUrl) {
      return fetch(CFG.sheetCsvUrl, { cache: "no-store" })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then(function (txt) { return { lista: csvAProductos(txt), origen: "planilla" }; })
        .catch(function () { return cargarJson(); });
    }
    return cargarJson();
  }

  function cargarJson() {
    return fetch("data/productos.json", { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (lista) { return { lista: lista, origen: "archivo" }; });
  }

  // CSV simple con soporte de comillas (formato que exporta Google Sheets).
  function parseCsv(txt) {
    var filas = [], fila = [], campo = "", comillas = false;
    for (var i = 0; i < txt.length; i++) {
      var c = txt[i];
      if (comillas) {
        if (c === '"' && txt[i + 1] === '"') { campo += '"'; i++; }
        else if (c === '"') comillas = false;
        else campo += c;
      } else if (c === '"') comillas = true;
      else if (c === ",") { fila.push(campo); campo = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && txt[i + 1] === "\n") i++;
        fila.push(campo); filas.push(fila); fila = []; campo = "";
      } else campo += c;
    }
    if (campo || fila.length) { fila.push(campo); filas.push(fila); }
    return filas.filter(function (f) { return f.some(function (v) { return v.trim() !== ""; }); });
  }

  function num(v) {
    if (v === undefined || v === null) return null;
    var s = String(v).replace(/[$\s]/g, "");
    if (s === "") return null;
    // "52.000" o "2,95" -> formato argentino
    if (/,/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
    var n = Number(s);
    return isNaN(n) ? null : n;
  }

  function csvAProductos(txt) {
    var filas = parseCsv(txt);
    var cab = filas.shift().map(function (h) { return h.trim().toLowerCase(); });
    return filas.map(function (f, i) {
      var o = {};
      cab.forEach(function (h, j) { o[h] = (f[j] || "").trim(); });
      return {
        id: o.id || "p" + i,
        nombre: o.nombre,
        categoria: o.categoria || "Otros",
        textura: o.textura || "liso",
        color: o.color || "#cfd3d6",
        ancho_cm: num(o.ancho_cm),
        largo_m: num(o.largo_m),
        espesor_mm: num(o.espesor_mm),
        uso: o.uso,
        precio: num(o.precio),
        stock: num(o.stock) || 0,
        destacado: /^(si|sí|true|x|1)$/i.test(o.destacado || ""),
        imagen: o.imagen
      };
    }).filter(function (p) { return p.nombre; });
  }

  // ---------- Utilidades ----------

  function m2(p) { return p.ancho_cm && p.largo_m ? (p.ancho_cm / 100) * p.largo_m : null; }
  function medida(p) {
    var a = p.ancho_cm >= 100 ? fmtNum.format(p.ancho_cm / 100) + " m" : fmtNum.format(p.ancho_cm) + " cm";
    return a + " × " + fmtNum.format(p.largo_m) + " m";
  }
  function esOscuro(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    if (!m) return false;
    var n = parseInt(m[1], 16);
    return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) < 90;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function waLink(texto) {
    return "https://wa.me/" + (CFG.whatsapp || "") + "?text=" + encodeURIComponent(texto);
  }
  function mostrarPrecio(p) { return CFG.mostrarPrecios !== false && p.precio; }

  // ---------- Catálogo ----------

  function renderChips() {
    var cats = ["Todas"];
    productos.forEach(function (p) { if (cats.indexOf(p.categoria) < 0) cats.push(p.categoria); });
    $("#chips").innerHTML = cats.map(function (c) {
      return '<button type="button" class="chip" aria-pressed="' + (c === filtro.cat) + '" data-cat="' + esc(c) + '">' + esc(c) + "</button>";
    }).join("");
  }

  function badge(p) {
    if (p.stock <= 0) return '<span class="badge out">Sin stock · consultar ingreso</span>';
    if (p.stock <= STOCK_BAJO) return '<span class="badge low">Últimas ' + p.stock + " unidades</span>";
    return '<span class="badge ok">En stock</span>';
  }

  function card(p) {
    var sup = m2(p);
    var swatch = p.imagen
      ? '<img src="' + esc(p.imagen) + '" alt="' + esc(p.nombre) + '" loading="lazy">'
      : "";
    // "3d-ondas" -> s-3d: la parte después del guion es solo descriptiva
    var claseTex = "s-" + esc(String(p.textura || "liso").split("-")[0]) + (esOscuro(p.color) ? " dark" : "");
    var precio = mostrarPrecio(p)
      ? '<span class="price">' + fmtPeso.format(p.precio) + "<small>por placa" + (sup ? " · " + fmtPeso.format(p.precio / sup) + "/m²" : "") + "</small></span>"
      : '<span class="price">Consultar<small>precio por WhatsApp</small></span>';
    var enCart = cart[p.id];
    return (
      '<article class="card">' +
        '<div class="swatch ' + claseTex + '" style="--c:' + esc(p.color) + '">' + swatch + badge(p) +
          (p.destacado ? '<span class="tag-dest">Destacado</span>' : "") + "</div>" +
        '<div class="card-body">' +
          '<span class="card-cat">' + esc(p.categoria) + "</span>" +
          "<h3>" + esc(p.nombre) + "</h3>" +
          '<dl class="specs">' +
            "<dt>Medida</dt><dd>" + medida(p) + "</dd>" +
            (p.espesor_mm ? "<dt>Espesor</dt><dd>" + fmtNum.format(p.espesor_mm) + " mm</dd>" : "") +
            (sup ? "<dt>Cubre</dt><dd>" + fmtNum.format(sup) + " m² por placa</dd>" : "") +
            (p.uso ? "<dt>Uso</dt><dd>" + esc(p.uso) + "</dd>" : "") +
          "</dl>" +
          '<div class="card-foot">' + precio +
            '<button type="button" class="add' + (enCart ? " added" : "") + '" data-add="' + esc(p.id) + '">' +
              (enCart ? "✓ Agregado" : "Agregar") + "</button>" +
          "</div>" +
        "</div>" +
      "</article>"
    );
  }

  function renderGrid() {
    var q = filtro.q.trim().toLowerCase();
    var lista = productos.filter(function (p) {
      if (filtro.cat !== "Todas" && p.categoria !== filtro.cat) return false;
      if (filtro.soloStock && p.stock <= 0) return false;
      if (q && (p.nombre + " " + p.categoria + " " + (p.uso || "")).toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) {
      return (b.stock > 0) - (a.stock > 0) || b.destacado - a.destacado;
    });
    $("#grid").innerHTML = lista.map(card).join("");
    $("#empty").hidden = lista.length > 0;
  }

  // ---------- Calculadora ----------

  function renderCalcSelect() {
    $("#calc-prod").innerHTML = productos.map(function (p) {
      return '<option value="' + esc(p.id) + '">' + esc(p.nombre) + " (" + medida(p) + ")</option>";
    }).join("");
  }

  function calcular() {
    var p = productos.find(function (x) { return x.id === $("#calc-prod").value; });
    var area = (num($("#calc-ancho").value) || 0) * (num($("#calc-alto").value) || 0) - (num($("#calc-desc").value) || 0);
    var out = $("#calc-out");
    if (!p || !m2(p) || area <= 0) {
      out.innerHTML = '<span class="sub">Completá las medidas para ver el cálculo.</span>';
      return null;
    }
    var desp = CFG.desperdicio != null ? CFG.desperdicio : 0.1;
    var placas = Math.ceil((area * (1 + desp)) / m2(p));
    out.innerHTML =
      '<span class="big">' + placas + " placas</span>" +
      '<span class="sub">' + fmtNum.format(area) + " m² + " + Math.round(desp * 100) + "% de desperdicio · " +
      fmtNum.format(m2(p)) + " m² por placa</span>" +
      (mostrarPrecio(p) ? '<span class="sub">Estimado: ' + fmtPeso.format(placas * p.precio) + "</span>" : "") +
      (p.stock > 0 && p.stock < placas ? '<span class="sub" style="color:var(--warn)">Hay ' + p.stock + " en stock, consultá por el resto.</span>" : "") +
      (p.stock <= 0 ? '<span class="sub" style="color:var(--out)">Sin stock por ahora, consultá el próximo ingreso.</span>' : "");
    return { p: p, placas: placas };
  }

  // ---------- Presupuesto ----------

  function loadCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) { /* sin almacenamiento */ }
  }

  function setQty(id, qty) {
    if (qty > 0) cart[id] = qty; else delete cart[id];
    saveCart();
    renderCart();
    renderGrid();
  }

  function renderCart() {
    var ids = Object.keys(cart).filter(function (id) {
      return productos.some(function (p) { return p.id === id; });
    });
    var bar = $("#cartbar");
    bar.hidden = ids.length === 0;
    if (!ids.length) { $("#cart-panel").hidden = true; $("#cart-open").setAttribute("aria-expanded", "false"); }
    var total = 0, todosConPrecio = true;
    var lineas = ["Hola Nexo! Quiero pedir presupuesto por:"];
    $("#cart-count").textContent = ids.length + (ids.length === 1 ? " producto" : " productos");
    $("#cart-list").innerHTML = ids.map(function (id) {
      var p = productos.find(function (x) { return x.id === id; });
      var q = cart[id];
      if (mostrarPrecio(p)) total += q * p.precio; else todosConPrecio = false;
      lineas.push("• " + q + " × " + p.nombre + " (" + medida(p) + ")");
      return '<li><span class="nm">' + esc(p.nombre) + "<small>" + medida(p) +
        (mostrarPrecio(p) ? " · " + fmtPeso.format(p.precio) + " c/u" : "") + "</small></span>" +
        '<span class="qty"><button type="button" data-dec="' + esc(id) + '" aria-label="Quitar una">−</button>' +
        '<input type="number" min="0" inputmode="numeric" id="qty-' + esc(id) + '" data-qty="' + esc(id) + '" value="' + q + '" aria-label="Cantidad">' +
        '<button type="button" data-inc="' + esc(id) + '" aria-label="Sumar una">+</button></span></li>';
    }).join("");
    var txtTotal = total ? "Total estimado: " + fmtPeso.format(total) + (todosConPrecio ? "" : " + productos a consultar") : "";
    $("#cart-total").textContent = txtTotal;
    if (txtTotal) lineas.push("", txtTotal);
    lineas.push("", "Mi nombre es: ");
    $("#cart-send").href = waLink(lineas.join("\n"));
  }

  // ---------- Eventos ----------

  function bind() {
    $("#chips").addEventListener("click", function (e) {
      var b = e.target.closest("[data-cat]");
      if (!b) return;
      filtro.cat = b.getAttribute("data-cat");
      renderChips(); renderGrid();
    });
    $("#q").addEventListener("input", function (e) { filtro.q = e.target.value; renderGrid(); });
    $("#solo-stock").addEventListener("change", function (e) { filtro.soloStock = e.target.checked; renderGrid(); });

    $("#grid").addEventListener("click", function (e) {
      var b = e.target.closest("[data-add]");
      if (!b) return;
      var id = b.getAttribute("data-add");
      setQty(id, (cart[id] || 0) + 1);
    });

    ["calc-prod", "calc-ancho", "calc-alto", "calc-desc"].forEach(function (id) {
      document.getElementById(id).addEventListener("input", calcular);
    });
    $("#calc-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var r = calcular();
      if (!r) return;
      setQty(r.p.id, r.placas);
      $("#cart-panel").hidden = false;
      $("#cart-open").setAttribute("aria-expanded", "true");
    });

    $("#cart-open").addEventListener("click", function () {
      var panel = $("#cart-panel");
      panel.hidden = !panel.hidden;
      this.setAttribute("aria-expanded", String(!panel.hidden));
    });
    $("#cart-list").addEventListener("click", function (e) {
      var inc = e.target.closest("[data-inc]"), dec = e.target.closest("[data-dec]");
      if (inc) setQty(inc.getAttribute("data-inc"), cart[inc.getAttribute("data-inc")] + 1);
      if (dec) setQty(dec.getAttribute("data-dec"), cart[dec.getAttribute("data-dec")] - 1);
    });
    $("#cart-list").addEventListener("change", function (e) {
      var id = e.target.getAttribute("data-qty");
      if (id) setQty(id, Math.max(0, Math.floor(num(e.target.value) || 0)));
    });
    $("#cart-clear").addEventListener("click", function () { cart = {}; saveCart(); renderCart(); renderGrid(); });
  }

  function datosContacto() {
    document.querySelectorAll("[data-wa]").forEach(function (a) { a.href = waLink(a.getAttribute("data-wa")); });
    var n = String(CFG.whatsapp || "");
    $("#wa-num").textContent = n ? "+" + n.replace(/^(\d{2})(\d)(\d{4})(\d+)$/, "$1 $2 $3 $4") : "—";
    var ig = $("#ig-link");
    ig.href = "https://instagram.com/" + CFG.instagram;
    ig.textContent = "@" + CFG.instagram;
    var map = $("#map-link");
    map.href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent((CFG.direccion || "") + " " + CFG.ciudad);
    map.textContent = (CFG.direccion ? CFG.direccion + ", " : "") + CFG.ciudad;
    $("#horario").textContent = CFG.horario || "";
    $("#year").textContent = new Date().getFullYear();
    $("#desp-pct").textContent = Math.round((CFG.desperdicio != null ? CFG.desperdicio : 0.1) * 100);
  }

  // ---------- Inicio ----------

  datosContacto();
  bind();
  cargarProductos().then(function (r) {
    productos = r.lista;
    var conStock = productos.filter(function (p) { return p.stock > 0; }).length;
    $("#stock-note").textContent = conStock + " de " + productos.length + " modelos con stock";
    renderChips();
    renderGrid();
    renderCalcSelect();
    calcular();
    renderCart();
  }).catch(function () {
    $("#stock-note").textContent = "No pudimos cargar el stock. Consultanos por WhatsApp.";
  });
})();
