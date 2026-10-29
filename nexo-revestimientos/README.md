# Nexo Revestimientos — sitio web

Sitio de catálogo para **Nexo Revestimientos** (placas de PVC, Jesús María, Córdoba).
Es HTML + CSS + JavaScript puro: no necesita servidor ni base de datos, se puede subir gratis a
GitHub Pages, Netlify o Vercel.

## Qué tiene

- **Catálogo** con filtros por tipo, buscador y "solo con stock".
- **Indicador de stock** en cada placa: En stock / Últimas N unidades / Sin stock.
- **Calculadora**: con el ancho y alto de la pared dice cuántas placas hacen falta (+10% de desperdicio).
- **Presupuesto**: el cliente agrega placas y cantidades y lo manda armado por WhatsApp.
- **Contacto**: WhatsApp, Instagram, ubicación y horario.

## Logo

En `marca/` está el logo redibujado en vector (`logo.svg`, escala a cualquier tamaño sin perder calidad),
en PNG de 4096 × 4096 (con fondo y transparente) y en 1080 × 1080 para la foto de perfil de Instagram.

## Lo primero: configurar

Abrir `js/config.js` y completar:

- `whatsapp`: número real, formato `549` + característica sin 0 + número sin 15. Ej: `5493525123456`.
- `horario`, `direccion` (opcional), `mostrarPrecios`.

## Cómo cargar el stock

### Opción A (recomendada): Google Sheets

Así tu viejo actualiza stock y precios desde el celular, sin tocar código.

1. Crear una planilla con estas columnas en la primera fila (cada fila es un color):

   | id | grupo | nombre | categoria | tipo | perfil | color_nombre | color | textura | ancho_cm | espesor_mm | largo_m | unidad | uso | precio | stock | destacado | imagen |
   |----|-------|--------|-----------|------|--------|--------------|-------|---------|----------|------------|---------|--------|-----|--------|-------|-----------|--------|

   - `grupo`: las filas con el mismo grupo se muestran en una sola tarjeta con selector de color
     (ej. todos los colores de "Perfil de borde"). Vacío = tarjeta propia.
   - `tipo`: `panel` (entra en la calculadora) o `perfil`.
   - `perfil`: dibujo del corte: `moldura`, `borde`, `j` o `h` (unión).
   - `textura`: `liso` o `madera`. `color`: color de la muestra, ej. `#c9b59a`.
   - `unidad`: `m` (se vende por metro lineal) o `u` (por unidad).
   - `precio`: precio de venta al público. Vacío = "Consultar".
   - `stock`: metros o unidades disponibles. Vacío = "Consultar stock". `0` = "Sin stock".
   - `destacado`: `si` o vacío.
   - `imagen`: link a una foto (opcional; si está, reemplaza la muestra dibujada).
2. **Archivo → Compartir → Publicar en la Web** → elegir la hoja → **CSV** → Publicar.
3. Pegar el link en `sheetCsvUrl` dentro de `js/config.js`.

Los cambios en la planilla aparecen en la web en unos minutos (Google cachea el CSV).

### Opción B: editar `data/productos.json`

Mismos campos que la planilla. Sirve si no se configura la planilla o si falla.

## Probarlo en la compu

```bash
cd nexo-revestimientos
python3 -m http.server 8000
# abrir http://localhost:8000
```

(Abrir el `index.html` con doble clic no carga el stock, porque el navegador bloquea leer archivos locales.)

## Publicarlo

La forma más simple es Netlify Drop (https://app.netlify.com/drop): arrastrar la carpeta
`nexo-revestimientos` y listo. Después se puede conectar un dominio tipo `nexorevestimientos.com.ar`
(los `.com.ar` se registran en NIC Argentina).

## Pendientes / ideas

- Fotos reales de los paneles y de trabajos terminados (galería). Pedirle al proveedor las fotos oficiales.
- Precios de venta al público y stock real.
- Dirección exacta y número de WhatsApp.
- Dominio propio y link en la bio de Instagram.
