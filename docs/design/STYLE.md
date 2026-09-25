# Estilo visual (basado en nerdearla.com)

Tokens en `apps/web/src/app/globals.css` → clases Tailwind (`bg-surface-2`, `text-accent`, `font-display`, `rounded-cta`…). **No usar colores hex sueltos.**

| Token | Valor | Uso |
|---|---|---|
| `ink` | `#000` | fondo de página |
| `surface` / `surface-2` | `#0a0a0a` / `#111` | secciones / cards y header |
| `glass`, `line` | blanco 4% / 8% | cards translúcidas, bordes |
| `text`, `text-soft`, `text-muted` | `#fff`, `#b0b0b0`, `#929292` | jerarquía de texto |
| `brand` (+`bright`, `soft`, `tint`) | `#E02832` | CTA principal, badge LIVE, barra superior |
| `accent` | `#FFBA00` | segunda línea de titulares, métricas grandes, foco |
| `teal` / `teal-deep` | `#00ACA8` / `#007673` | links, estado ok/conectado |
| `mist` | `#D8E3E6` | paneles claros puntuales |

- **Tipografía:** titulares `font-display` (Barlow Condensed 600–700, reemplazo libre de Rift Soft), tracking levemente negativo, a veces uppercase en labels y chips. Cuerpo Roboto 400.
- **Botones:** CTA = `bg-brand text-white rounded-cta font-display font-semibold`; secundario = borde `line-strong`, fondo transparente; chips = `rounded-chip` con borde `brand` sobre `brand-tint`.
- **Titular tipo Nerdearla:** línea 1 blanca, línea 2 `text-accent`, ambas en `font-display` uppercase.
- **Stats:** número grande en `text-accent font-display`, label uppercase chico en `text-muted`.
- **Subtítulos (audiencia/overlay):** legibilidad antes que marca: Roboto grande, blanco sobre `ink`; parcial en `text-muted`; overlay con `text-shadow` y fondo transparente.
