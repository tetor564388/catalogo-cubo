# Catálogo CUBO para iPhone (app web)

Sitio estático, sin servidor. Archivos:
- index.html, estilos.css, manifest.webmanifest, icon-180/192/512.png
- config.js: DROPBOX_APP_KEY (sustituir), CARPETA_POR_DEFECTO, REDIRECT_URI (opcional)
- logica.js: lógica pura (nombres, Vieja, Referencia, CSV, fusión, progreso), igual que Core/*.cs de la PC
- dropbox.js: OAuth2 PKCE (redirect y también modo de código pegado para la app de pantalla de inicio), list_folder, download, upload (modo update con rev), get_thumbnail_v2, get_temporary_link
- app.js: pantallas Revisar / Ver archivo / Progreso / Ajustes
- test/prueba.js: `node test/prueba.js` (debe decir TODO BIEN)

Publicar: subir la carpeta tal cual (sin test/) a cualquier hosting estático con HTTPS. Poner la URL final en Redirect URIs de la app de Dropbox.
