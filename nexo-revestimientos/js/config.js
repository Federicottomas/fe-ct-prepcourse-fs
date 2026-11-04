// ===============================================================
//  CONFIGURACIÓN DEL SITIO — lo único que hace falta tocar
// ===============================================================
window.NEXO_CONFIG = {
  // Número de WhatsApp con código de país, sin "+", espacios ni guiones.
  // Formato Argentina celular: 549 + característica sin 0 + número sin 15.
  // Ej: (03525) 15-123456  ->  5493525123456
  whatsapp: "5493525488992",   // principal: recibe los presupuestos de la web
  whatsapp2: "5493525309433",  // segundo número, se muestra en Contacto

  instagram: "nexorevestimientos",
  direccion: "", // ej: "Av. San Martín 1234" (opcional, se usa en el link al mapa)
  ciudad: "Jesús María, Córdoba",
  horario: "Lunes a viernes de 8 a 18 h · Sábados de 9 a 13 h",

  // Stock desde Google Sheets (opcional, recomendado).
  // En la planilla: Archivo > Compartir > Publicar en la Web > hoja "productos"
  // > formato CSV, y pegar acá el link que te da.
  // Si queda vacío, se usa el archivo data/productos.json.
  sheetCsvUrl: "",

  // Desperdicio que suma la calculadora por cortes y encastres.
  desperdicio: 0.10,

  // Mostrar precios. Si es false, todos los productos dicen "Consultar".
  mostrarPrecios: true,
};
