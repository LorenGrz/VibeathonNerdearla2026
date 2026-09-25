# Planning — cómo se construyó LiveSubs

Todo lo que se usó para planificar y paralelizar el desarrollo durante la Vibeathon Nerdearla
(24–25 sep 2026): el plan aprobado, las specs que compartieron los agentes y el prompt de cada
tarea.

```
docs/planning/
├── PLAN.md              # plan aprobado: contexto, arquitectura, olas, verificación
├── specs/
│   ├── CONTRACT.md      # contrato del dominio, puertos, REST y WebSocket (fuente de verdad)
│   └── STYLE.md         # paleta y tipografía extraídas de nerdearla.com
└── tasks/
    ├── README.md        # tablero: olas, agente/modelo por tarea, ownership de archivos
    └── T00…T13-*.md     # un prompt autocontenido por tarea, con comando de aceptación
```

## Método

1. **Plan + contrato primero.** `PLAN.md` fija el stack y las olas; `specs/CONTRACT.md` fija
   nombres de clases, puertos, DTOs y eventos para que agentes en paralelo no choquen.
2. **Tareas por dificultad → modelo.** Difícil = opus (`reasoner`), media = sonnet (`worker`),
   fácil = haiku (`worker` con `model: haiku`). Cada tarea lista qué archivos puede tocar.
3. **Olas en paralelo con worktrees.** Cada agente trabaja en su `git worktree` y su rama; el
   integrador revisa, corre la verificación en `main` y mergea con `--no-ff`.
4. **Mock primero.** Transcriptor y traductor Mock permiten verificar todo sin API key.

## Registro de ejecución

| Ola | Tarea                    | Agente / modelo   | Resultado                                                            |
| --- | ------------------------ | ----------------- | -------------------------------------------------------------------- |
| 0   | T0 scaffold              | integrador (opus) | Monorepo pnpm, Nest 12 + Next 16.3, CI                               |
| 0   | T1 dominio               | reasoner (opus)   | 61 tests; `AbortSignalLike` en puertos (ver CONTRACT)                |
| 1   | T2 Gemini Live + chunked | reasoner (opus)   | Detectó que el modelo Live por defecto estaba dado de baja           |
| 1   | T3 orquestador           | reasoner (opus)   | Sesiones concurrentes, backoff, métricas                             |
| 1   | T4 ingesta ffmpeg        | worker (sonnet)   | Chunks de 100 ms, `GET /samples`                                     |
| 1   | T5 traductor             | worker (sonnet)   | Glosario + contexto por sesión                                       |
| 1   | T6 exporters             | worker (haiku)    | SRT/VTT/TXT, 23 tests                                                |
| 1   | T7 realtime + REST       | worker (sonnet)   | Gateways Socket.IO, export, e2e                                      |
| 1   | T8 web audiencia         | worker (sonnet)   | `/`, `/s/[id]`, overlay OBS                                          |
| 1   | T9 panel producción      | worker (sonnet)   | `/admin`, demo de 2 sesiones                                         |
| 2   | T10 docs + Docker        | worker (haiku)    | README, SCALING, compose (precios inventados corregidos al integrar) |
| 2   | T11 integración          | integrador (opus) | Composition root, e2e de concurrencia, prueba con Gemini real        |
| 2   | T12 micrófono            | reasoner (opus)   | AudioWorklet → `/mic` → pipeline                                     |

### Correcciones hechas al integrar

- Cableado entre módulos (repositorios globales, adapter de Socket.IO) y exporters del dominio.
- Fuente `file` restringida a `SAMPLES_DIR` (la API no tiene auth).
- Con Gemini real: modelo de texto `gemini-3.5-flash-lite` (2.5-flash cerrado a proyectos nuevos,
  3.8-flash ~6 s por llamada), timer de parciales de 6 s (evitaba subtítulos de una palabra),
  timeout de traducción 8 s con 3 intentos, latencia medida también en traducciones.
- `SCALING.md`: precios y cuotas inventados reemplazados por fórmula y links oficiales.
