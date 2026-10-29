// Fondo animado: un rincón dibujado como plano técnico donde se van colocando
// los paneles de PVC uno por uno. Cada vuelta usa una terminación distinta.
(function () {
  "use strict";

  var canvas = document.getElementById("obra");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");

  var W = 4.2, D = 4.2, H = 2.6;   // medidas del ambiente en metros
  var LAMA = 0.2;                  // ancho del panel: 20 cm
  var N = Math.round(W / LAMA);    // paneles por pared
  var CICLO = 20;                  // segundos por vuelta
  var C = Math.cos(Math.PI / 6), S = 0.5;

  var ACABADOS = [
    { nombre: "Blanco", base: [233, 234, 230] },
    { nombre: "Fresno almendro", base: [201, 181, 154] },
    { nombre: "Negro", base: [52, 55, 59] },
    { nombre: "Valencia", base: [154, 108, 72] }
  ];

  var quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var ancho, alto, dpr, s, ox, oy, mobil;

  var slot = document.getElementById("hero-slot");

  // Escala según el espacio reservado en el inicio (#hero-slot).
  function medir() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    ancho = window.innerWidth; alto = window.innerHeight;
    canvas.width = Math.round(ancho * dpr); canvas.height = Math.round(alto * dpr);
    mobil = ancho < 900;
    var r = slot ? slot.getBoundingClientRect() : { width: ancho * 0.44, height: alto * 0.68 };
    s = Math.min((r.width * (mobil ? 0.8 : 0.96)) / ((W + D) * C), (r.height * 0.94) / (H + 1 + (W + D) * S));
    ubicar();
    if (quieto) dibujar(14);
  }

  // El dibujo acompaña al inicio al hacer scroll y, al llegar a la mitad de la pantalla, queda fijo.
  function ubicar() {
    var r = slot ? slot.getBoundingClientRect() : { left: ancho * 0.5, top: alto * 0.15, width: ancho * 0.44, height: alto * 0.68 };
    var cx = r.left + r.width / 2;
    var cy = Math.max(r.top + r.height / 2, alto * 0.5);
    ox = cx - ((W - D) * C * s) / 2;
    var arriba = -(H + 1) * s, abajo = (W + D) * S * s;
    oy = cy - (arriba + abajo) / 2;
  }

  // Proyección isométrica: x a lo largo de la pared derecha, z de la izquierda, y hacia arriba.
  function p(x, y, z) { return [ox + (x - z) * C * s, oy + (x + z) * S * s - y * s]; }

  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function suave(t) { t = clamp(t); return t * t * (3 - 2 * t); }
  function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
  function mezcla(c, k) { return [Math.round(c[0] * k), Math.round(c[1] * k), Math.round(c[2] * k)].map(function (v) { return Math.min(255, v); }); }

  function linea(a, b, t, color, grosor) {
    if (t <= 0) return;
    var pa = p(a[0], a[1], a[2]), pb = p(b[0], b[1], b[2]);
    ctx.strokeStyle = color; ctx.lineWidth = grosor;
    ctx.beginPath(); ctx.moveTo(pa[0], pa[1]);
    ctx.lineTo(pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t);
    ctx.stroke();
  }

  function poligono(pts) {
    ctx.beginPath();
    pts.forEach(function (q, i) { var v = p(q[0], q[1], q[2]); i ? ctx.lineTo(v[0], v[1]) : ctx.moveTo(v[0], v[1]); });
    ctx.closePath();
  }

  function texto(str, q, alpha, alinear) {
    var v = p(q[0], q[1], q[2]);
    ctx.fillStyle = "rgba(205,212,220," + alpha + ")";
    ctx.font = "600 " + Math.max(10, Math.round(s * 0.11)) + "px Montserrat, Arial, sans-serif";
    if ("letterSpacing" in ctx) ctx.letterSpacing = "2px";
    ctx.textAlign = alinear || "center";
    ctx.fillText(str, v[0], v[1]);
  }

  function cota(a, b, etiqueta, t, alpha, desplazTexto) {
    var col = "rgba(190,198,208," + 0.55 * alpha + ")";
    linea(a, b, suave(t), col, 1);
    if (t > 0.6) {
      var k = suave((t - 0.6) / 0.4) * alpha;
      var m = [(a[0] + b[0]) / 2 + desplazTexto[0], (a[1] + b[1]) / 2 + desplazTexto[1], (a[2] + b[2]) / 2 + desplazTexto[2]];
      texto(etiqueta, m, 0.75 * k);
      // topes de la cota
      [a, b].forEach(function (q) {
        linea([q[0], q[1] - 0.08, q[2]], [q[0], q[1] + 0.08, q[2]], 1, "rgba(190,198,208," + 0.55 * k + ")", 1);
      });
    }
  }

  // Un panel de la pared derecha (z=0) o izquierda (x=0), deslizándose desde arriba.
  function panel(lado, i, t, acabado, alpha) {
    if (t <= 0) return;
    var k = suave(t), off = (1 - k) * H * 0.9;
    var a0 = i * LAMA, a1 = a0 + LAMA;
    var pts = lado === "der"
      ? [[a0, off, 0], [a1, off, 0], [a1, H + off, 0], [a0, H + off, 0]]
      : [[0, off, a0], [0, off, a1], [0, H + off, a1], [0, H + off, a0]];
    var luz = lado === "der" ? 1 : 0.78; // la pared izquierda recibe menos luz
    var base = mezcla(acabado.base, luz);
    var top = p.apply(null, pts[3]), bot = p.apply(null, pts[0]);
    var g = ctx.createLinearGradient(top[0], top[1], bot[0], bot[1]);
    g.addColorStop(0, rgba(mezcla(base, 1.12), 0.5 * alpha * k));
    g.addColorStop(1, rgba(mezcla(base, 0.8), 0.38 * alpha * k));
    poligono(pts); ctx.fillStyle = g; ctx.fill();
    // junta del machimbre: sombra + filo de luz
    var j0 = pts[1], j1 = pts[2];
    linea(j0, j1, 1, "rgba(0,0,0," + 0.45 * alpha * k + ")", 1.4);
    linea([j0[0], j0[1], j0[2]], [j1[0], j1[1], j1[2]], 1, "rgba(255,255,255," + 0.12 * alpha * k + ")", 0.6);
  }

  function dibujar(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, ancho, alto);

    var vuelta = Math.floor(t / CICLO);
    var acabado = ACABADOS[vuelta % ACABADOS.length];
    var u = t - vuelta * CICLO;
    var salida = 1 - suave((u - 16.4) / 2);   // se desarma al final de la vuelta
    var tenue = 1;
    var A = salida * tenue;
    if (A <= 0) return;

    var plano = "rgba(196,204,214," + 0.42 * A + ")";
    var fino = "rgba(196,204,214," + 0.08 * A + ")";

    // 1. Plano: grilla del piso y contorno de paredes, trazados en secuencia.
    for (var g = 0.6; g < W; g += 0.6) {
      var tg = suave((u - 0.2 - g * 0.12) / 0.8);
      linea([g, 0, 0], [g, 0, D], tg, fino, 1);
      linea([0, 0, g], [W, 0, g], tg, fino, 1);
    }
    var trazos = [
      [[0, 0, 0], [0, H, 0]],
      [[0, 0, 0], [W, 0, 0]], [[0, 0, 0], [0, 0, D]],
      [[W, 0, 0], [W, H, 0]], [[0, 0, D], [0, H, D]],
      [[0, H, 0], [W, H, 0]], [[0, H, 0], [0, H, D]],
      [[W, 0, 0], [W, 0, D]], [[0, 0, D], [W, 0, D]]
    ];
    trazos.forEach(function (l, i) { linea(l[0], l[1], suave((u - i * 0.22) / 0.9), plano, 1.2); });

    // 2. Cotas
    var tc = (u - 1.9) / 1.1;
    cota([0, H + 0.32, 0], [W, H + 0.32, 0], "4,20 M", tc, A, [0, 0.14, 0]);
    cota([0, H + 0.32, 0], [0, H + 0.32, D], "4,20 M", tc - 0.15, A, [0, 0.14, 0]);
    cota([0, 0, D + 0.3], [0, H, D + 0.3], "2,60 M", tc - 0.3, A, [0, 0, 0.5]);

    // 3. Paneles: del rincón hacia afuera, en las dos paredes a la vez.
    ctx.save();
    poligono([[0, 0, D], [0, 0, 0], [W, 0, 0], [W, H, 0], [0, H, 0], [0, H, D]]);
    ctx.clip(); // los paneles entran desde el borde del techo
    for (var i = 0; i < N; i++) {
      var tp = (u - 3.1 - i * 0.2) / 0.95;
      panel("izq", i, tp, acabado, A);
      panel("der", i, tp - 0.12, acabado, A);
    }
    ctx.restore();

    // 4. Moldura superior y perfiles de borde.
    var tm = suave((u - 8.1) / 1.6);
    var plata = "rgba(236,240,244," + 0.8 * A + ")";
    linea([0, H, 0], [W, H, 0], tm, plata, 2.2);
    linea([0, H, 0], [0, H, D], tm, plata, 2.2);
    linea([W, 0, 0], [W, H, 0], suave((u - 9.2) / 0.8), plata, 1.6);
    linea([0, 0, D], [0, H, D], suave((u - 9.2) / 0.8), plata, 1.6);

    // 5. Brillo que recorre los paneles terminados.
    var tb = (u - 10.2) / 2.6;
    if (tb > 0 && tb < 1) {
      ctx.save();
      poligono([[0, 0, D], [0, 0, 0], [W, 0, 0], [W, H, 0], [0, H, 0], [0, H, D]]);
      ctx.clip();
      var cxb = ox - D * C * s + (W + D) * C * s * (tb * 1.4 - 0.2);
      var gb = ctx.createLinearGradient(cxb - s * 0.9, 0, cxb + s * 0.9, 0);
      gb.addColorStop(0, "rgba(255,255,255,0)");
      gb.addColorStop(0.5, "rgba(255,255,255," + 0.16 * A + ")");
      gb.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gb; ctx.fillRect(0, 0, ancho, alto);
      ctx.restore();
    }

    // 6. Ficha del panel colocado.
    var tf = suave((u - 9) / 1);
    if (tf > 0) {
      var piso = p(0, H + 0.95, 0);
      ctx.textAlign = "center";
      ctx.font = "600 " + Math.max(10, Math.round(s * 0.1)) + "px Montserrat, Arial, sans-serif";
      if ("letterSpacing" in ctx) ctx.letterSpacing = "3px";
      ctx.fillStyle = "rgba(205,212,220," + 0.7 * tf * A + ")";
      ctx.fillText("PANEL PVC 20 CM · 10 MM · " + acabado.nombre.toUpperCase(), piso[0], piso[1]);
    }
  }

  var inicio = performance.now();
  function cuadro(ahora) {
    var y = window.scrollY || 0;
    canvas.style.opacity = String(Math.max(0.22, 1 - y / (alto * 1.1)));
    ubicar();
    dibujar((ahora - inicio) / 1000);
    requestAnimationFrame(cuadro);
  }

  window.addEventListener("resize", medir);
  medir();
  if (quieto) {
    // Sin animación: queda el ambiente terminado.
    dibujar(14);
    window.addEventListener("scroll", function () {
      canvas.style.opacity = String(Math.max(0.22, 1 - window.scrollY / (alto * 1.1)));
      ubicar(); dibujar(14);
    }, { passive: true });
  } else {
    requestAnimationFrame(cuadro);
  }
})();
