(function () {
  "use strict";

  var CFG = window.NEXO_CONFIG || {};
  var CART_KEY = "nexo-presupuesto";
  var STOCK_BAJO = { m: 30, u: 10 }; // debajo de esto se muestra "Últimos…"

  var items = [];   // filas tal cual vienen (cada color es una fila)
  var grupos = [];  // filas agrupadas por "grupo" -> una tarjeta cada una
  var elegido = {}; // grupo -> índice de la variante elegida
  var filtro = { cat: "Todos", q: "", soloStock: false };
  var cart = loadCart();

  var $ = function (sel) { return document.querySelector(sel); };
  var fmtPeso = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
  var fmtNum = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

  // ---------- Carga de datos ----------

  function cargarProductos() {
    if (CFG.sheetCsvUrl) {
      return fetch(CFG.sheetCsvUrl, { cache: "no-store" })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then(csvAProductos)
        .catch(cargarJson);
    }
    return cargarJson();
  }

  function cargarJson() {
    return fetch("data/productos.json", { cache: "no-store" }).then(function (r) { return r.json(); });
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
        grupo: o.grupo,
        nombre: o.nombre,
        categoria: o.categoria || "Otros",
        tipo: o.tipo || "panel",
        perfil: o.perfil,
        color_nombre: o.color_nombre,
        color: o.color || "#cfd3d6",
        textura: o.textura || "liso",
        ancho_cm: num(o.ancho_cm),
        espesor_mm: num(o.espesor_mm),
        largo_m: num(o.largo_m),
        unidad: o.unidad || "u",
        uso: o.uso,
        precio: num(o.precio),
        stock: num(o.stock),
        destacado: /^(si|sí|true|x|1)$/i.test(o.destacado || ""),
        imagen: o.imagen
      };
    }).filter(function (p) { return p.nombre; });
  }

  function agrupar(lista) {
    var porClave = {}, out = [];
    lista.forEach(function (p) {
      var k = p.grupo || p.id;
      if (!porClave[k]) { porClave[k] = { clave: k, variantes: [] }; out.push(porClave[k]); }
      porClave[k].variantes.push(p);
    });
    return out;
  }

  // ---------- Utilidades ----------

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function esOscuro(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    if (!m) return false;
    var n = parseInt(m[1], 16);
    return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) < 90;
  }
  function waLink(texto) { return "https://wa.me/" + (CFG.whatsapp || "") + "?text=" + encodeURIComponent(texto); }
  function conPrecio(p) { return CFG.mostrarPrecios !== false && p.precio; }
  function porUnidad(p) { return p.unidad === "m" ? "por metro" : "por unidad"; }
  function cantidad(p, q) { return p.unidad === "m" ? fmtNum.format(q) + " m" : q + (q === 1 ? " unidad" : " unidades"); }
  function nombreCompleto(p) { return p.nombre + (p.grupo && p.color_nombre ? " · " + p.color_nombre : ""); }
  function porId(id) { return items.find(function (p) { return p.id === id; }); }
  function variante(g) { return g.variantes[elegido[g.clave] || 0]; }
  function anchoM(p) { return p.ancho_cm ? p.ancho_cm / 100 : null; }

  // Cortes de los perfiles (vista de frente del extremo), con el panel de 10 mm punteado.
  var PERFILES = {
    moldura: '<path class="pf" d="M30 10h12v34q0 18 18 18h40v10H30z"/>',
    borde: '<rect class="pnl" x="44" y="32" width="70" height="16"/><path class="pf" d="M28 22h56v8H36v20h48v8H28z"/>',
    j: '<rect class="pnl" x="44" y="32" width="70" height="16"/><path class="pf" d="M28 8h8v14h48v8H36v20h64v8H28z"/>',
    h: '<rect class="pnl" x="2" y="32" width="46" height="16"/><rect class="pnl" x="72" y="32" width="46" height="16"/><path class="pf" d="M14 22h92v8H64v20h42v8H14v-8h42V30H14z"/>'
  };

  function swatch(p) {
    var oscuro = esOscuro(p.color) ? " dark" : "";
    if (p.imagen) return '<div class="swatch"><img src="' + esc(p.imagen) + '" alt="' + esc(nombreCompleto(p)) + '" loading="lazy">';
    if (p.tipo === "perfil" && PERFILES[p.perfil]) {
      return '<div class="swatch s-perfil' + oscuro + '" style="--c:' + esc(p.color) + '">' +
        '<svg viewBox="0 0 120 80" aria-hidden="true">' + PERFILES[p.perfil] + "</svg>";
    }
    var tex = p.textura === "madera" ? " madera" : "";
    var lamas = p.ancho_cm >= 25 ? " ancha" : "";
    return '<div class="swatch s-lama' + tex + lamas + oscuro + '" style="--c:' + esc(p.color) + '">';
  }

  function badge(p) {
    if (p.stock == null) return '<span class="badge ask">Consultar stock</span>';
    if (p.stock <= 0) return '<span class="badge out">Sin stock · consultar ingreso</span>';
    if (p.stock <= (STOCK_BAJO[p.unidad] || 10)) {
      return '<span class="badge low">' + (p.unidad === "m" ? "Últimos " + fmtNum.format(p.stock) + " m" : "Últimas " + p.stock + " unidades") + "</span>";
    }
    return '<span class="badge ok">En stock</span>';
  }

  // ---------- Catálogo ----------

  function renderChips() {
    var cats = ["Todos"];
    items.forEach(function (p) { if (cats.indexOf(p.categoria) < 0) cats.push(p.categoria); });
    $("#chips").innerHTML = cats.map(function (c) {
      return '<button type="button" class="chip" aria-pressed="' + (c === filtro.cat) + '" data-cat="' + esc(c) + '">' + esc(c) + "</button>";
    }).join("");
  }

  function card(g) {
    var p = variante(g);
    var specs = p.tipo === "panel"
      ? "<dt>Ancho</dt><dd>" + fmtNum.format(p.ancho_cm) + " cm</dd>" +
        "<dt>Espesor</dt><dd>" + fmtNum.format(p.espesor_mm) + " mm</dd>" +
        "<dt>Venta</dt><dd>Por metro lineal</dd>" +
        "<dt>Cubre</dt><dd>" + fmtNum.format(anchoM(p)) + " m² por metro</dd>"
      : (p.largo_m ? "<dt>Largo</dt><dd>" + fmtNum.format(p.largo_m) + " m</dd>" : "") +
        (p.espesor_mm ? "<dt>Para</dt><dd>Panel de " + fmtNum.format(p.espesor_mm) + " mm</dd>" : "");
    if (p.uso) specs += "<dt>Uso</dt><dd>" + esc(p.uso) + "</dd>";

    var colores = g.variantes.length > 1
      ? '<div class="colors"><span class="colors-label">Color: <strong>' + esc(p.color_nombre) + "</strong></span>" +
        '<div class="dots">' + g.variantes.map(function (v, i) {
          return '<button type="button" class="dot" style="--c:' + esc(v.color) + '" data-grupo="' + esc(g.clave) + '" data-i="' + i +
            '" aria-pressed="' + (v === p) + '" title="' + esc(v.color_nombre) + '"><span class="sr-only">' + esc(v.color_nombre) + "</span></button>";
        }).join("") + "</div></div>"
      : "";

    var precio = conPrecio(p)
      ? '<span class="price">' + fmtPeso.format(p.precio) + "<small>" + porUnidad(p) + "</small></span>"
      : '<span class="price">Consultar<small>precio por WhatsApp</small></span>';

    var enCart = cart[p.id];
    return (
      '<article class="card">' + swatch(p) + badge(p) +
        (p.destacado ? '<span class="tag-dest">Más pedido</span>' : "") + "</div>" +
        '<div class="card-body">' +
          '<span class="card-cat">' + esc(p.categoria) + "</span>" +
          "<h3>" + esc(p.nombre) + "</h3>" + colores +
          '<dl class="specs">' + specs + "</dl>" +
          '<div class="card-foot">' + precio +
            '<button type="button" class="add' + (enCart ? " added" : "") + '" data-add="' + esc(p.id) + '">' +
              (enCart ? "✓ " + cantidad(p, enCart) : "Agregar") + "</button>" +
          "</div>" +
        "</div>" +
      "</article>"
    );
  }

  function renderGrid() {
    var q = filtro.q.trim().toLowerCase();
    var lista = grupos.filter(function (g) {
      var p = g.variantes[0];
      if (filtro.cat !== "Todos" && p.categoria !== filtro.cat) return false;
      if (filtro.soloStock && !g.variantes.some(function (v) { return v.stock == null || v.stock > 0; })) return false;
      if (q) {
        var texto = g.variantes.map(function (v) { return v.nombre + " " + v.categoria + " " + (v.color_nombre || "") + " " + (v.uso || ""); }).join(" ");
        if (texto.toLowerCase().indexOf(q) < 0) return false;
      }
      return true;
    });
    $("#grid").innerHTML = lista.map(card).join("");
    $("#empty").hidden = lista.length > 0;
  }

  // ---------- Calculadora ----------

  function paneles() { return items.filter(function (p) { return p.tipo === "panel" && p.ancho_cm; }); }

  function renderCalcSelect() {
    $("#calc-prod").innerHTML = paneles().map(function (p) {
      return '<option value="' + esc(p.id) + '">' + esc(p.nombre) + "</option>";
    }).join("");
  }

  function calcular() {
    var p = porId($("#calc-prod").value);
    var ancho = num($("#calc-ancho").value) || 0, alto = num($("#calc-alto").value) || 0;
    var area = ancho * alto - (num($("#calc-desc").value) || 0);
    var out = $("#calc-out");
    if (!p || area <= 0) {
      out.innerHTML = '<span class="sub">Completá las medidas para ver el cálculo.</span>';
      return null;
    }
    var desp = CFG.desperdicio != null ? CFG.desperdicio : 0.1;
    var metros = Math.ceil((area * (1 + desp)) / anchoM(p));
    var tiras = alto > 0 ? Math.ceil(metros / alto) : 0;
    var barras = Math.ceil((2 * (ancho + alto)) / 3);
    out.innerHTML =
      '<span class="big">' + metros + " metros lineales</span>" +
      '<span class="sub">' + fmtNum.format(area) + " m² + " + Math.round(desp * 100) + "% de desperdicio · el panel cubre " +
        fmtNum.format(anchoM(p)) + " m² por metro</span>" +
      (tiras ? '<span class="sub">Equivale a unas ' + tiras + " tiras de " + fmtNum.format(alto) + " m.</span>" : "") +
      '<span class="sub">Para el contorno: ' + barras + " perfiles o molduras de 3 m.</span>" +
      (conPrecio(p) ? '<span class="sub">Estimado del panel: ' + fmtPeso.format(metros * p.precio) + "</span>" : "") +
      (p.stock != null && p.stock < metros ? '<span class="sub warn">Hay ' + fmtNum.format(Math.max(p.stock, 0)) + " m en stock, consultá por el resto.</span>" : "");
    return { p: p, metros: metros };
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
    var ids = Object.keys(cart).filter(porId);
    $("#cartbar").hidden = ids.length === 0;
    if (!ids.length) { $("#cart-panel").hidden = true; $("#cart-open").setAttribute("aria-expanded", "false"); }
    var total = 0, todosConPrecio = true;
    var lineas = ["Hola Nexo! Quiero pedir presupuesto por:"];
    $("#cart-count").textContent = ids.length + (ids.length === 1 ? " producto" : " productos");
    $("#cart-list").innerHTML = ids.map(function (id) {
      var p = porId(id), q = cart[id];
      if (conPrecio(p)) total += q * p.precio; else todosConPrecio = false;
      lineas.push("• " + cantidad(p, q) + " de " + nombreCompleto(p));
      return '<li><span class="nm">' + esc(nombreCompleto(p)) + "<small>" + (p.unidad === "m" ? "Metros lineales" : "Unidades") +
        (conPrecio(p) ? " · " + fmtPeso.format(p.precio) + " " + porUnidad(p) : "") + "</small></span>" +
        '<span class="qty"><button type="button" data-dec="' + esc(id) + '" aria-label="Restar uno">−</button>' +
        '<input type="number" min="0" inputmode="numeric" id="qty-' + esc(id) + '" data-qty="' + esc(id) + '" value="' + q + '" aria-label="Cantidad">' +
        '<button type="button" data-inc="' + esc(id) + '" aria-label="Sumar uno">+</button></span></li>';
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
      var dot = e.target.closest("[data-grupo]");
      if (dot) { elegido[dot.getAttribute("data-grupo")] = +dot.getAttribute("data-i"); renderGrid(); return; }
      var b = e.target.closest("[data-add]");
      if (!b) return;
      var id = b.getAttribute("data-add"), p = porId(id);
      setQty(id, (cart[id] || 0) + (p.unidad === "m" ? 10 : 1));
    });

    ["calc-prod", "calc-ancho", "calc-alto", "calc-desc"].forEach(function (id) {
      document.getElementById(id).addEventListener("input", calcular);
    });
    $("#calc-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var r = calcular();
      if (!r) return;
      setQty(r.p.id, r.metros);
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
  cargarProductos().then(function (lista) {
    items = lista;
    grupos = agrupar(items);
    var conDato = items.filter(function (p) { return p.stock != null; });
    var conStock = conDato.filter(function (p) { return p.stock > 0; }).length;
    $("#stock-note").textContent = grupos.length + " productos · " + items.length + " variantes de color" +
      (conDato.length ? " · " + conStock + " con stock" : " · stock a confirmar por WhatsApp");
    renderChips();
    renderGrid();
    renderCalcSelect();
    calcular();
    renderCart();
  }).catch(function () {
    $("#stock-note").textContent = "No pudimos cargar el catálogo. Consultanos por WhatsApp.";
  });
})();
