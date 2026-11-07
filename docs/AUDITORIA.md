# Encargo de auditoría — Posta 0.1.0

Este documento es el punto de partida para quien audite Posta (GitHub Copilot u otra persona). Describe qué se ha construido, dónde mirar y qué no está verificado todavía.

## 1. Alcance

| Pieza | Dónde | Qué revisar |
|---|---|---|
| Web | `web/` (este repositorio) | Privacidad (cero terceros, CSP), seguridad del plan familiar (importación, XSS), accesibilidad, modo sin conexión, honestidad de los textos |
| App Android | repositorio [`serdie/posta-android`](https://github.com/serdie/posta-android), rama `posta` (fork de `permissionlesstech/bitchat-android`, GPL-3.0) | Solo el diff de Posta sobre upstream: ver §3 |

## 2. Web: puntos calientes

- `web/src/plan/model.ts` → `parsePlan()`: única entrada de datos no confiables (archivos importados y `localStorage`). Límites de longitud, limpieza de caracteres de control, ids, fechas.
- `web/src/plan/ui.ts` → construcción del DOM y de las tarjetas imprimibles. Debe usar solo `textContent`.
- `web/vite.config.ts` → plugin `production()`: inyecta la CSP y genera la lista de precaché del service worker.
- `web/public/sw.js` → no debe interceptar peticiones de otros orígenes ni cachear respuestas con error.
- `web/public/_headers` → cabeceras para Netlify/Cloudflare Pages.

Comprobaciones automáticas en CI (`.github/workflows/web.yml`): tipos, 27 tests, compilación, ausencia de recursos de terceros y CSP en cada página.

## 3. App Android: diff de Posta sobre Bitchat 2.2.0

Base: `upstream/main` en `2fc6f47` (6-nov-2026). Cambios de Posta:

1. **Identidad**: `applicationId = "org.posta.app"` (convive con Bitchat instalada), versión `0.1.0`, nombre «Posta» en todos los idiomas (solo textos visibles; los identificadores de protocolo `bitchat-*` se mantienen a propósito para no romper la compatibilidad), icono propio y lema con atribución a Bitchat (GPL-3.0).
2. **Estados de emergencia** (`app/src/main/java/com/bitchat/android/posta/`):
   - `PostaStatus.kt`: modelo puro. Formato de cable fijo y bilingüe, p. ej. `🟢 ESTOY BIEN / I'M OK — nota`. Viaja como **mensaje de texto normal**: no hay campos nuevos en el protocolo, así que cualquier cliente Bitchat lo recibe.
   - `PostaStatusBar.kt`: fila de botones sobre el compositor + diálogo de confirmación que indica el destino real (privado cifrado / canal / público) y permite una nota de 140 caracteres.
   - `ChatScreen.kt`, `MeshPeerListSheet.kt`: conectan la barra al envío existente (`ChatViewModel.sendMessage`).
   - `ChatUIUtils.kt`: resalta en color la cabecera de los estados recibidos.
   - Tests: `app/src/test/java/com/bitchat/android/posta/PostaStatusTest.kt` (7 casos).
3. **Página de descarga por wifi local** (`hotspot/ApkWebServer.kt`): textos y nombre de archivo con la marca Posta.

### Qué debe vigilar la auditoría

- Que un mensaje cualquiera no pueda hacerse pasar por un estado de forma engañosa en la interfaz (el parser exige el prefijo exacto al inicio).
- Que el diálogo describa correctamente el destino en cada contexto (privado, canal con contraseña, canal geohash, malla pública).
- Que no se haya alterado nada de cifrado, transporte, identidad ni almacenamiento.
- La función de descarga de APK (`util/ApkDownloadSource.kt`, `GitHubReleaseClient.kt`) sigue apuntando a las versiones de Bitchat hasta que Posta publique las suyas. Es compatible pero es otra app: **pendiente de decidir**.

## 4. Estado de las pruebas (7-nov-2026)

- Web: `npm run check` → 27/27 tests; compilación correcta; verificada en navegador (escritorio y 375 px, claro y oscuro), CSP sin violaciones, service worker con 18 recursos en caché.
- Android: `assembleDebug` correcto. `testDebugUnitTest`: 840 tests, 26 fallos. **Los 26 fallos también aparecen en el código original de Bitchat sin modificar** en el mismo equipo (Windows): son pruebas de SQLite/Robolectric dependientes del entorno (`ConversationDatabaseTest`, `ConversationRepositoryTest`, `IncomingMessageAdmissionTest`, `MediaSendingManagerMigrationTest`, `NostrDirectMessageHandlerTest`). Hay que confirmarlo en la CI de Linux.
- **No probado**: teléfonos físicos, Mesh Lab, interoperabilidad real con Bitchat iOS, batería, segundo plano. Es el siguiente hito obligatorio antes de publicar un APK.

## 5. Fuera de alcance de esta versión

iOS nativo, auditoría criptográfica independiente, publicación en tiendas o F-Droid, firma de versiones de producción.
