# TriAgent v2 Plan

## Objetivo

Llevar TriAgent desde su estado actual de MVP arquitectónico a un orquestador realmente usable que:

1. Planifique tareas.
2. Cree y administre worktrees por sesion.
3. Ejecute agentes reales por rondas y dependencias.
4. Monitoree progreso en una TUI conectada al bus de eventos.
5. Haga merge seguro o escale a resolucion manual.
6. Deje trazabilidad suficiente para reintentos, debugging y cleanup.

## Estado Actual

El proyecto ya tiene buena base en:

- Separacion de modulos.
- Validacion de configuracion.
- Drivers con `node-pty` y fallback a `spawn`.
- Git worktrees y merge helpers.
- Event bus tipado.
- Suite de tests razonable.

La brecha principal es que el flujo operativo todavia no existe completo:

- `Session.execute()` no ejecuta trabajo real.
- `Session.merge()` no integra ramas.
- La TUI no consume el bus ni controla la sesion.
- No hay persistencia de `sessionId`, worktrees, branches ni logs reales.
- Varias opciones de config existen en schema/defaults pero no tienen efecto runtime.

## Principios de v2

- El core debe ser ejecutable sin la TUI.
- La TUI debe ser una vista del estado, no la fuente de verdad.
- Cada sesion debe ser resumible o al menos inspeccionable.
- El runtime debe preferir seguridad operacional sobre "magia".
- La configuracion expuesta debe corresponder a comportamiento real.

## Roadmap Propuesto

## Fase 1: Runtime Real de Sesion

### Objetivo

Cerrar la mayor deuda: pasar de plan/setup a ejecucion real.

### Entregables

- Persistir `sessionId` en `Session`.
- Persistir metadata de worktrees y branches por agente.
- Implementar `execute()` con:
  - calculo de rondas via `Scheduler.computeRounds()`
  - cambio de estado de tareas
  - emision de `task:started`, `task:completed`, `task:failed`
  - dispatch paralelo por ronda
  - uso de `max_concurrent` por agente
  - manejo de reintentos segun `session.max_retries`
- Implementar `merge()` con:
  - emision de `git:merge:start`, `git:merge:success`, `git:merge:conflict`
  - respeto por `git.auto_merge`
  - estrategia `sequential` y camino `manual`
- Cleanup controlado de worktrees al finalizar o fallar.

### Cambios tecnicos

- Extender `Session` con estado interno durable:
  - `sessionId`
  - `worktreesByAgent`
  - `driversByAgent`
  - `taskIndex`
- Crear un modelo explicito de `SessionRunState`.
- Conectar cada tarea con su `cwd` correcto de worktree.
- Definir comportamiento cuando una tarea falla:
  - abortar sesion
  - continuar tareas independientes
  - saltar dependientes fallidos

### Riesgos

- Si varias tareas del mismo agente comparten branch/worktree, el historial puede mezclarse.
- Si no se define una politica de fallo consistente, la sesion quedara en estado ambiguo.

### Criterio de done

- `triagent start "..."` ejecuta al menos una sesion completa con agentes mock.
- Existen tests de extremo a extremo para rounds, fallo y merge.

## Fase 2: Estado Reactivo y TUI Real

### Objetivo

Hacer que la interfaz refleje la ejecucion real y permita operar la sesion.

### Entregables

- Crear store derivado del `TriAgentEventBus`.
- Conectar `App` al bus en vez de recibir props estaticas.
- Mostrar:
  - estado por agente
  - output reciente
  - progreso por tarea
  - fase actual
  - errores de auth y merge
- Reemplazar aprobacion por `readline` con overlay de Ink o justificar mantener CLI simple sin duplicar UX.
- Hotkeys minimas:
  - aprobar/rechazar
  - pausar/resumir agente
  - abortar sesion
  - alternar panel/log detail

### Cambios tecnicos

- Introducir un `SessionViewModel` o store basado en reducer.
- Suscribirse al bus y derivar estado de UI.
- Separar componentes de presentacion de componentes conectados.

### Riesgos

- La TUI puede volverse compleja demasiado pronto si tambien intenta controlar el runtime.

### Criterio de done

- La TUI renderiza estado vivo sin mocks de props.
- Las pruebas de TUI validan cambios de estado basados en eventos reales.

## Fase 3: Orquestacion Robusta

### Objetivo

Evitar que el sistema solo funcione en demos.

### Entregables

- Health checks reales para PATH y auth.
- Uso efectivo de `auth_check`.
- Timeouts por tarea/agente.
- Politica de cancelacion y shutdown limpio.
- Deteccion de sesiones huerfanas y cleanup seguro.
- Mejor manejo de conflictos de Git y reporte accionable.

### Cambios tecnicos

- Diferenciar errores de:
  - proceso
  - auth
  - merge
  - config
  - dependencia no satisfecha
- Agregar archivos de estado por sesion en `.triagent/`.
- Escribir logs/eventos a disco en `session.log_dir`.

### Riesgos

- El mayor riesgo es que los agentes reales tengan contratos CLI distintos a los mocks.

### Criterio de done

- Las sesiones fallidas dejan evidencia util y no ensucian el repo silenciosamente.
- `triagent cleanup` entiende sesiones y worktrees propios, no solo `git worktree prune`.

## Fase 4: Planner y Scheduler v2

### Objetivo

Reducir decisiones ingenuas del planner y hacer el routing mas confiable.

### Entregables

- Reemplazar heuristica simple por planner de dos niveles:
  - parseo rapido heuristico
  - opcion de planner enriquecido con reglas o prompt-driven planning
- Mejor modelado de dominios y capacidades.
- Soporte para `targetPaths` inferidos o declarados.
- Scheduler con:
  - fairness
  - capacidad por agente
  - colas por dominio
  - dependencias parciales

### Decisiones

- Si se quiere mantener "zero API cost", el planner debe seguir siendo local.
- Si se prioriza calidad, agregar un modo opcional con LLM planner.

### Criterio de done

- El planner deja de producir splits artificiales del tipo `frontend: <task>` y genera subtareas accionables.
- La asignacion mejora con casos reales de repo, no solo keywords.

## Fase 5: DX, CLI y Producto

### Objetivo

Pulir la experiencia para que el proyecto sea adoptable.

### Entregables

- `triagent logs <sessionId>` funcional.
- `triagent resume <sessionId>` o decidir explicitamente que no se soporta.
- `triagent doctor` para diagnostico completo.
- Mejor `status` con PATH, version, auth y config efectiva.
- Documentacion operativa:
  - flujo de sesion
  - fallos comunes
  - permisos y riesgos
  - guia de integracion por agente

### Criterio de done

- Un usuario nuevo puede instalar, configurar, correr una sesion y entender por que fallo sin leer el codigo.

## Orden Recomendado de Implementacion

1. Runtime real de `Session`.
2. Persistencia de estado y logs.
3. Merge y cleanup confiables.
4. TUI conectada al bus.
5. Hardening operacional.
6. Planner/scheduler v2.
7. DX y comandos secundarios.

## Backlog Tecnico Detallado

### Core

- Convertir `Session` en maquina de estados explicita.
- Definir `SessionResult`.
- Modelar `TaskResult` por subtask.
- Persistir `sessionId` y metadata por agente.

### Drivers

- Crear factories reales en runtime desde config.
- Normalizar contratos de entrada por agente.
- Soportar stdin adicional si algun agente lo requiere.
- Añadir timeout, abort y reason codes.

### Git

- Usar paths por sesion y agente: `.triagent/worktrees/<sessionId>/<agent>`.
- Guardar branch names generados.
- Asegurar cleanup idempotente.
- Resolver estrategia para varias tareas del mismo agente.

### TUI

- Reducer basado en eventos.
- Vista de errores y conflictos.
- Overlay de aprobacion.
- Navegacion minima por teclado.

### Config

- Eliminar o implementar flags huerfanas.
- Validar mejor `domains` y nombres de agentes.
- Permitir defaults parciales con merge sobre `DEFAULT_CONFIG`.

### Testing

- E2E de sesion exitosa.
- E2E de fallo de agente.
- E2E de auth failure.
- E2E de merge conflict.
- Tests de resume/cleanup si se implementan.

## Riesgos Mayores

### 1. Contrato real con los agentes

El proyecto asume que Claude, Forge y Codex aceptan prompts y flags de una forma uniforme. Eso rara vez aguanta mucho tiempo. Hay que encapsular diferencias reales por driver.

### 2. Modelo de concurrencia

Hoy la unidad de aislamiento es "un worktree por agente". Eso sirve para un agente trabajando en una rama, pero no para multiples tareas concurrentes del mismo agente si se quiere paralelismo real.

### 3. Mezcla entre runtime y UI

Si la TUI empieza a controlar demasiado pronto la sesion, el sistema sera mas dificil de testear y automatizar.

### 4. Config que promete mas de lo que hace

Cada flag expuesto pero no implementado reduce confianza. En v2 hay que o implementarlo o removerlo.

## Decisiones de Arquitectura que Recomiendo

- Mantener event bus tipado.
- Mantener worktrees como aislamiento principal.
- Mantener planner local por defecto.
- Separar completamente:
  - core runtime
  - adapters/drivers
  - UI
  - persistencia de sesiones

Tambien recomiendo agregar:

- `src/core/session-state.ts`
- `src/core/runtime.ts`
- `src/core/session-store.ts`
- `src/persistence/session-repo.ts`

## Propuesta de Sprints

### Sprint 1

- Implementar `Session.execute()`
- Persistir `sessionId`
- Crear metadata de worktrees
- Emitir eventos de tarea reales
- E2E con agentes mock

### Sprint 2

- Implementar `Session.merge()`
- Cleanup confiable
- Logs a disco
- `logs` funcional

### Sprint 3

- TUI conectada al bus
- aprobacion en Ink o simplificacion deliberada
- errores y progreso en vivo

### Sprint 4

- hardening operacional
- `auth_check`
- timeouts
- recovery/cleanup

### Sprint 5

- planner/scheduler v2
- documentacion final
- polish de CLI

## Definition of Done de v2

TriAgent v2 esta listo cuando:

- Una tarea multi-step se ejecuta de verdad de punta a punta.
- Los agentes trabajan en worktrees aislados y trazables.
- Los fallos quedan visibles y recuperables.
- El merge automatico funciona o escala correctamente a manual.
- La TUI refleja el estado real.
- Los comandos de soporte (`status`, `logs`, `cleanup`) son utiles de verdad.

## Recomendacion Final

No conviene empezar por planner mas sofisticado ni por embellecer la TUI. La prioridad correcta es:

1. hacer real el runtime
2. hacer observable la sesion
3. endurecer Git y procesos
4. despues mejorar inteligencia y UX

Si ese orden se invierte, TriAgent se vera mejor pero seguira sin resolver el problema central.
