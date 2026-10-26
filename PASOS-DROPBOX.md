# Conectar el Catálogo del iPhone con tu Dropbox

Solo se hace una vez y es gratis. Te toma unos 5 minutos. Hazlo en la computadora.

1. Entra a **https://www.dropbox.com/developers/apps** con tu cuenta de Dropbox de siempre.
2. Aprieta el botón azul **Create app**.
3. Escoge así:
   - **Scoped access**
   - **Full Dropbox**
   - En el nombre escribe algo como **CatalogoCUBO-Hector** (si dice que ya existe, agrégale un número).
   - Aprieta **Create app**.
4. Arriba, entra a la pestaña **Permissions** y palomea estas tres:
   - `files.metadata.read`
   - `files.content.read`
   - `files.content.write`

   Luego aprieta **Submit** hasta abajo.
5. Regresa a la pestaña **Settings**:
   - En **Redirect URIs** pega esta dirección y aprieta **Add**:
     `DIRECCION_DE_LA_APP` *(yo te la paso)*
   - Busca **App key** y copia ese código de letras y números.
6. Mándame el **App key**. Es el único dato que necesito.
   - El **App secret** no me lo mandes ni lo compartas. No hace falta.

Cuando yo te avise que ya está lista:

7. En tu iPhone abre **Safari** y entra a la dirección de la app.
8. Aprieta el botón **Compartir** (el cuadrito con la flecha) y luego **Agregar a pantalla de inicio**.
9. Abre la app desde su ícono y aprieta **Entrar con Dropbox**.
   - Dropbox te muestra un código. Cópialo, regresa a la app, pégalo y aprieta **Listo**.
   - Si en vez del código te regresa sola a la app, también está bien.
10. Listo. Ya no tienes que volver a entrar.

Si tu carpeta Cubo no aparece sola, ve a **Ajustes > Elegir otra carpeta** y búscala.
