# CAFETERIA---WEBSITE
Profesional website for brazilizan - inspired in food and brunch

Web de **Bloom Coffee & Brunch** (Calle Ángel Llanos 10, Vigo): web pública en HTML/CSS/JS sin compilación + panel privado de stock en PHP.

## Estructura

| Ruta | Qué es |
|---|---|
| `index.html`, `styles.css`, `main.js` | Web pública (carta digital, paseo ilustrado, el local, horarios y contacto) |
| `lib/manifest.js` | Datos del negocio (horario usado por el indicador «Abierto ahora», mapa) |
| `assets/img`, `assets/video` | Fotos (WebP 800/1600 px) y vídeos (MP4 + WebM) |
| `admin/` | Panel privado de stock (PHP 8) |
| `admin/data/` | Datos del panel (contraseña cifrada, inventario). Bloqueado por `.htaccess` y no se sube a git |
| `.htaccess`, `robots.txt`, `sitemap.xml` | Caché, seguridad y SEO |

## Publicar en Hostinger

1. Sube **todo el contenido** de esta carpeta a `public_html` (incluidos los archivos que empiezan por punto, como `.htaccess`).
2. Abre `https://tu-dominio/admin/` **inmediatamente** y crea la contraseña del panel (mínimo 10 caracteres). El primer acceso es el que la fija.
3. Comprueba que `https://tu-dominio/admin/data/inventory.php` devuelve un error 404 (los datos no deben verse).

## Panel de stock

- Altas, edición y archivo de artículos con unidad (unidades, kg, g, litros, ml, paquetes, cajas), categoría y stock mínimo.
- Entradas, salidas y ajustes por recuento con historial de movimientos.
- Avisos «Stock bajo» y «Agotado · por reponer», indicadores clave, buscador y filtros, exportación a CSV.
- Seguridad: sesión con cookie segura, bloqueo de 15 min tras 5 intentos fallidos y protección contra peticiones falsificadas (CSRF). Los datos se guardan en archivos protegidos que no se pueden leer desde la web.
- **¿Olvidaste la contraseña?** Borra `admin/data/auth.php` por FTP y vuelve a entrar en `/admin/` para crear una nueva (el inventario no se pierde).
- Copia de seguridad: descarga la carpeta `admin/data/` por FTP o usa «Exportar CSV».

## Pendiente de confirmar

- Información de alérgenos de cada producto (la web lo indica como pendiente).
- Precios de tapas, cócteles y raciones de churros (la web indica «Precio en el local»).
- Textos legales: aviso legal, privacidad y cookies (titular, NIF…).
- La página de carta más reciente muestra precios distintos e ilegibles para Despertar Bloom, Dulce Encuentro y una tosta «Serena». Se han usado los de la carta legible (7,80 €, 6,20 € y 7,00 €).
