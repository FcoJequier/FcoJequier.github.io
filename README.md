# fcojequier.github.io

Portfolio de **Francisco Jequier**, Agentic Software Engineer · [fcojequier.github.io](https://fcojequier.github.io)

Sitio estático hecho con [Astro](https://astro.build), en español e inglés. La versión principal tiene forma de app de chat de escritorio. En `/lab/` hay otras direcciones de diseño del mismo contenido:

| Ruta | Versión |
|---|---|
| `/` y `/en/` | Chat (principal) |
| `/lab/editor/` | Editor de código con paleta de comandos, terminal y asistente |
| `/lab/plano/` | Hoja de dibujo técnico |
| `/lab/bento/` | Tablero de tarjetas |

## Desarrollo

```bash
npm ci
npm run dev      # http://localhost:4321
npm run build    # genera dist/
```

Todo el texto está en `src/content.ts`. Cada push a `main` se publica en GitHub Pages con `.github/workflows/deploy.yml`.
