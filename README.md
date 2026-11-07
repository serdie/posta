# Posta

**Que no se corte la voz cuando se corta la red.**

Posta es una app libre y gratuita para hablar con la gente cercana sin internet ni cobertura móvil: los mensajes viajan de teléfono en teléfono por Bluetooth, como las antiguas postas de correo. Está pensada para familias, colegios y comunidades que quieren estar preparadas antes de una emergencia.

- Sin cuenta, sin número de teléfono, sin correo.
- Sin anuncios, sin suscripciones, sin analítica, sin servidores.
- Mensajes privados cifrados de extremo a extremo (Noise XX).
- Compatible con **Bitchat** en Android e iPhone.
- Estados de emergencia de un toque: 🟢 Estoy bien · 📍 Voy al punto de encuentro · 🟠 Necesito ayuda · 🔴 Urgencia médica.

## Qué hay en este repositorio

```
web/                 Web pública (Vite + TypeScript, sin dependencias de terceros en ejecución)
  index.html         Portada con simulador interactivo de la malla
  plan.html          Plan familiar de emergencia (solo en tu dispositivo, funciona sin conexión, imprime tarjetas)
  guia.html          Guía antes / durante / después
  app.html           Instalación y estado real de cada versión
  privacidad.html    Qué protege Posta y qué no
docs/AUDITORIA.md    Encargo de auditoría: alcance, puntos calientes, estado de las pruebas
.github/             CI de la web e instrucciones de revisión para Copilot
mobile/android/      (no versionado aquí) App Android: repositorio propio, fork de bitchat-android
```

## La app Android

La app parte de [bitchat-android](https://github.com/permissionlesstech/bitchat-android) (GPL-3.0), que ya resuelve la malla Bluetooth y el cifrado, y añade la capa de emergencia de Posta. Vive en su propio repositorio, [serdie/posta-android](https://github.com/serdie/posta-android) (rama `posta`, con `upstream` apuntando a Bitchat para incorporar sus mejoras). Detalle del diff en [`docs/AUDITORIA.md`](docs/AUDITORIA.md).

Compilar (JDK 21 y Android SDK 37):

```bash
cd mobile/android
./gradlew :app:assembleDebug
```

El APK queda en `mobile/android/app/build/outputs/apk/debug/`. En redes con inspección TLS, Java puede necesitar `JAVA_TOOL_OPTIONS=-Djavax.net.ssl.trustStoreType=Windows-ROOT` (Windows).

**Estado:** compila y pasa sus tests; falta la validación en teléfonos físicos antes de publicar ninguna descarga. En iPhone, usa Bitchat: habla el mismo protocolo.

## La web

```bash
cd web
npm ci
npm run dev      # desarrollo
npm run check    # tipos + tests
npm run build    # producción en web/dist
```

`web/dist` es estático: se puede servir desde cualquier hosting. Para Netlify o Cloudflare Pages, `public/_headers` ya incluye las cabeceras de seguridad; en otros servidores, replica la CSP de `vite.config.ts`.

Principios que la CI vigila: ningún recurso de terceros, CSP estricta en todas las páginas, y el plan familiar nunca sale del dispositivo.

## Límites, sin rodeos

La entrega no está garantizada: depende de que haya teléfonos con la app lo bastante cerca. El canal público lo puede leer cualquiera al alcance. Nadie puede prometer seguridad o anonimato absolutos: las señales de radio se pueden detectar y quien tenga tu móvil desbloqueado puede leerlo. Posta no sustituye al 112. Todavía no tiene auditoría de seguridad independiente.

## Licencia

GPL-3.0 (ver [LICENSE](LICENSE)). Gracias a las personas que mantienen [Bitchat](https://github.com/permissionlesstech/bitchat) y [Bitchat Android](https://github.com/permissionlesstech/bitchat-android).
