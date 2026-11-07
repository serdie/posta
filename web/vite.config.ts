/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, join, relative, resolve } from "node:path";

const root = import.meta.dirname;
const page = (name: string) => resolve(root, name);

/**
 * Inserta las piezas comunes (cabecera y pie) en cada página en tiempo de
 * compilación, para que el HTML final funcione sin JavaScript.
 * Uso: <!-- @include header --> en el HTML.
 */
function partials(): Plugin {
  return {
    name: "posta-partials",
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        const current = basename(ctx.filename);
        return html.replace(/<!--\s*@include\s+([\w-]+)\s*-->/g, (_m, name: string) => {
          const src = readFileSync(resolve(root, "partials", `${name}.html`), "utf8");
          return src.replace(/data-nav href="\.\/([\w-]+\.html)"/g, (full: string, href: string) =>
            href === current ? `${full} aria-current="page"` : full,
          );
        });
      },
    },
  };
}

/** Política de seguridad: nada de terceros, nada en línea. */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "font-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join("; ");

/** En producción: añade la CSP a cada página y prepara la lista de precaché del service worker. */
function production(): Plugin {
  let outDir = "";
  return {
    name: "posta-production",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    transformIndexHtml(html) {
      return html.replace(
        "<meta charset=\"utf-8\">",
        `<meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="${CSP}">`,
      );
    },
    closeBundle() {
      const files: string[] = [];
      const walk = (dir: string) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const full = join(dir, entry.name);
          if (entry.isDirectory()) walk(full);
          else files.push(relative(outDir, full).split("\\").join("/"));
        }
      };
      walk(outDir);
      // Las fuentes .woff antiguas no hacen falta: todos los navegadores actuales usan .woff2.
      const precache = files
        .filter((f) => !["sw.js", "_headers"].includes(f) && !f.endsWith(".woff"))
        .map((f) => `./${f}`)
        .sort();
      const hash = createHash("sha256");
      for (const f of precache) hash.update(f);
      const swPath = join(outDir, "sw.js");
      const sw = readFileSync(swPath, "utf8")
        .replace("__POSTA_BUILD__", hash.digest("hex").slice(0, 12))
        .replace("__POSTA_PRECACHE__", JSON.stringify(precache));
      writeFileSync(swPath, sw);
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [partials(), production()],
  build: {
    target: "es2022",
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        index: page("index.html"),
        plan: page("plan.html"),
        guia: page("guia.html"),
        app: page("app.html"),
        privacidad: page("privacidad.html"),
        kit: page("kit.html"),
      },
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
});
