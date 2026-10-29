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

## Lo primero: configurar

Abrir `js/config.js` y completar:

- `whatsapp`: número real, formato `549` + característica sin 0 + número sin 15. Ej: `5493525123456`.
- `horario`, `direccion` (opcional), `mostrarPrecios`.

## Cómo cargar el stock

### Opción A (recomendada): Google Sheets

Así tu viejo actualiza stock y precios desde el celular, sin tocar código.

1. Crear una planilla con estas columnas en la primera fila:

   | id | nombre | categoria | textura | color | ancho_cm | largo_m | espesor_mm | uso | precio | stock | destacado | imagen |
   |----|--------|-----------|---------|-------|----------|---------|------------|-----|--------|-------|-----------|--------|

   - `textura`: `liso`, `madera`, `marmol`, `3d` o `varillado` (dibuja la muestra si no hay foto).
   - `color`: color de la muestra, ej. `#a87b4f`.
   - `precio`: vacío = "Consultar".
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

- Fotos reales de las placas y de trabajos terminados (galería).
- Dirección exacta y número de WhatsApp.
- Dominio propio y link en la bio de Instagram.
