# BITÁCORA DEL TFG — Plataforma de conciencia cibersituacional (detección multi-etapa + grafo de ataque razonado)

> ## LÉEME PRIMERO (para cualquier IA / agente)
> Este archivo es **la memoria del proyecto**. Antes de ayudar:
> 1. Lee **§1 Contexto** y **§2 Decisiones clave** para entender el proyecto. **No revoques una decisión de §2 sin un motivo explícito y sin avisar.**
> 2. Mira **§4 Estado actual** para ver en qué punto estamos y qué toca.
> 3. Cuando termines de ayudar, **añade una entrada al final (Diario)** con la plantilla de §6 y **actualiza §4** si algo cambió.
> Idioma: documentación y diario en **español**; código y nombres técnicos en **inglés**.

---

## 1. Contexto del proyecto
- **Qué es:** Trabajo Fin de Grado del Grado en Ingeniería y Sistemas de Datos (ETSIT-UPM).
- **Tutor objetivo:** Prof. Víctor Villagrá / Carmen Sánchez-Zas — grupo RSTI, Dpto. de Ingeniería de Sistemas Telemáticos (DIT).
- **Fechas:** arranque ~agosto 2026 · defensa junio 2027.
- **Objetivo:** plataforma de datos que detecta ataques multi-etapa en tiempo real y prioriza incidentes de forma explicable, fusionando telemetría (red/host) con inteligencia de amenazas (CTI) alineada con MITRE ATT&CK, y razonando sobre rutas de ataque hacia activos críticos. Fin: reducir la fatiga de alertas y aportar conciencia cibersituacional.
- **Arquitectura (resumen):** dos planos (telemetría + CTI) que convergen en una capa de correlación, sobre tres pilares:
  - **Pilar A** — detección multi-etapa por CEP (secuencias de la kill chain).
  - **Pilar B** — grafo de ataque + razonamiento lógico de rutas.
  - **Pilar C** — priorización explicable de incidentes.
- **Núcleo mínimo defendible:** Pilares A + B + evaluación. El Pilar C avanzado y las extensiones (LLM+RAG para sembrar el grafo, cadena de suministro) son trabajo futuro si falta tiempo.
- **Documentos de apoyo (en `docs/`):** anteproyecto, planning ago2026–jun2027, estudio de recursos/coste, guía de infra y acceso remoto, estudios de temas.

## 2. Decisiones clave (no revocar sin motivo)
| Área | Decisión | Por qué |
|---|---|---|
| Grafo / consultas | Neo4j + Cypher + GDS (property graph). Alternativa streaming: Memgraph | Estándar de facto en seguridad (BloodHound); analítica de grafos (centralidad, caminos) |
| SPARQL / RDF / OWL | Descartado | No es el estándar en operaciones de seguridad; se sustituye por lo de arriba + Datalog |
| Razonamiento de rutas | Datalog estilo MulVAL (Soufflé) | Security-native, canónico, explicable, corre en el portátil |
| Streaming + CEP | Apache Flink + FlinkCEP (no Spark) | Streaming real con estado; habilita detección multi-etapa |
| Bus de eventos | Redpanda (no Kafka) | Compatible con la API de Kafka, sin JVM/ZooKeeper |
| Store analítico | ClickHouse (no Cassandra) | OLAP columnar rápido para hunting |
| Orquestación | Dagster (no Airflow) | Orientado a assets, moderno |
| API / servicios | FastAPI (no Flask) | Async, tipado |
| Plataforma CTI | OpenCTI (STIX 2.1) + MISP + feeds | Grafo CTI nativo con conector ATT&CK |
| Extracción de TTPs | TRAM / SecureBERT: línea base en inferencia **y fine-tuning propio** sobre corpus anotado (ML-2) | Es el componente con mejor encaje con la línea de la tutora; cabe en la RTX 5070 (~110M par.) |
| Uso de ML | **REVISADA el 26-07-2026** (`ROADMAP.md` §2, rev. 2). Antes: "solo inferencia, nada de entrenar". Ahora: **el ML tiene entidad propia** en cuatro componentes (ML-1 anomalías, ML-2 extracción de TTPs, ML-3 grafo, ML-4 scoring), entrenando **modelos pequeños** en local. Sigue descartado entrenar un LLM desde cero | (i) El trabajo se presenta a un Grado en Ingeniería y **Sistemas de Datos**; (ii) acerca el proyecto a la línea de la tutora. Contención: **regla §2.5 del roadmap** — si en febrero el núcleo no está cerrado, se recorta por el orden ML-4 → ML-1 → ML-3 → ML-2 |
| Infra | Contenedores Docker en 1 host (WSL2), no una VM por servicio | Evitar overhead; opcional VMs víctima/atacante para telemetría real |
| Cómputo | Portátil propio para todo el desarrollo; nube solo para fase de despliegue | El portátil (64 GB/16c) es coste hundido y más potente que las VMs de gama media |
| Despliegue K8s | minikube/kind local; si se quiere nube: Azure for Students / GitHub Student Pack | La prueba GCP de 300 $ ya está gastada y no se puede repetir |
| Docker | Docker Engine dentro de WSL (no Docker Desktop) | Montaje profesional, igual que en servidores reales |
| Frontend (F8, extra) | **REVISADA el 23-09-2026 y el 21-10-2026.** Stack del portal de PIDS: React 19 + Vite 8 + Tailwind 4 + shadcn/ui + TanStack Query + Recharts; los grafos existentes (pipeline, demo, panel P2) en SVG propio. **El explorador del grafo de ataque (APT29 day1, ~20 nodos) usa React Flow (`@xyflow/react`)**, cargado solo en su ruta. **Cytoscape.js sigue reservado para el grafo de ataque real de F5**; Zustand, innecesario por ahora | Stack ya probado en PIDS; el lienzo del grafo y el redibujado de los cuadros de Grafana se trasladan casi tal cual. React Flow da zoom, minimapa, nodos agrupados y selección por teclado para un grafo pequeño e interactivo sin reescribirlo en SVG; Cytoscape compensa cuando haya cientos de nodos con disposición automática. El frontend no es núcleo del TFG: es un escaparate para enseñar hacia dónde va |
| Diseño del portal | **REVISADA el 21-10-2026.** Dos temas sobre los mismos tokens: **modo claro gris de baja luminancia, por defecto** (sin superficies blancas) y **modo oscuro opcional** (pizarra profunda, sin negro puro ni neón), con un botón siempre visible y la elección recordada. Color intenso solo para la escala de severidad. Contraste AA de los dos temas comprobado por un test | El gris sigue siendo el de por defecto porque el blanco brillante fatiga la vista en turnos largos y resta protagonismo a la severidad; el oscuro se añade porque es el estándar en muchos SOC y lo pidió Javier (vuelve, como opción, el «tema oscuro» que ROADMAP F8.1 preveía). Texto ≥ 4,5:1 y gráficos ≥ 3:1 (WCAG AA) en los dos, medidos y no a ojo |
| Procedencia de las cifras del portal | Toda cifra lleva chip «documentado» (con su fuente) o «ilustrativo»; las documentadas salen de un único `frontend/src/api/simulado/corpus.ts` y, desde el 21-10-2026, de las copias de `frontend/src/api/datos/` (capas ATT&CK y resultados de ML-1, copiadas con `npm run sincronizar-datos`, con su origen y su SHA-256). Lo no documentado se enseña como tal, nunca se rellena | Que ninguna captura haga pasar un dato inventado por uno medido; `corpus.ts` será el oráculo de la primera prueba de integración con la API |
| Asistente de respuesta | **Las reglas deciden, el LLM solo redacta.** Acciones por motor de reglas determinista (ATT&CK → NIST SP 800-61 / D3FEND, priorizadas y con coste de negocio); el LLM (+RAG, solo inferencia) queda para explicar, sin poder inventar acciones ni cifras | Explicabilidad y auditabilidad (Pilar C); responde a «¿cómo mantienes la explicabilidad con modelos de por medio?» |

## 3. Convenciones
- **Entorno:** WSL2 (Ubuntu) como host Docker; `.wslconfig` con `memory=44GB`, `processors=24`, `swap=8GB`; systemd activado (`/etc/wsl.conf`).
- **Ejecución:** `docker compose` con perfiles por fase (levantar solo el subconjunto necesario).
- **Datos:** el working set en el disco interno; datasets grandes/"fríos" en disco externo (git-ignored). `docker system prune` periódico para no hinchar el disco.
- **Git:** rama `main` estable; ramas `feat/<fase>` por trabajo; commits pequeños y descriptivos.
- **Editor:** VS Code + WSL/Remote-SSH; en remoto, sobre Tailscale.
- **Rutas:** el repo vive en `~/proyectos/tfg-ciberconciencia` (disco Linux, no `/mnt/c`).
- **Ejecución por agentes (23-09-2026):** en `frontend/` un agente puede instalar, compilar, pasar el linter y los tests de forma autónoma (`npm`), porque es un extra y no toca servicios. El pipeline, los servicios, los topics y las tablas siguen siendo paso a paso, con los comandos ejecutados por Javier. `git commit`/`push` siempre los ejecuta Javier (ver Autoría).
- **Autoría (REGLA ESTRICTA):** todos los commits son exclusivamente de Javier Saguar <javisaguarantona@gmail.com>. **Ningún agente de IA debe figurar como autor ni co-autor**: prohibido añadir `Co-Authored-By`, "Generated with", "Assisted by" o cualquier atribución similar en mensajes de commit, PRs o código. Ninguna IA debe ejecutar `git commit`/`git push` de forma autónoma; los comandos se proponen y los ejecuta Javier. Guardián técnico: hook `.githooks/commit-msg` (activar tras clonar con `git config core.hooksPath .githooks`).

## 4. Estado actual
- **Fase:** **F2 CERRADA** (30-07-2026, con pendientes reubicados y anotados en el roadmap). **F3 (Pilar A, CEP) arrancando por F3.1.**
- **Hecho:** matriz de cobertura ATT&CK (300 técnicas / 2.301 reglas, 34 observadas, 11,3 % activación). MLflow con 10 experimentos de ML-1 (Isolation Forest, Random Forest, variantes SMOTE); control de volumen (AUC 0,941) fijado como línea base permanente para F7. Laboratorio de emulación operativo en VirtualBox y **dataset final generado**: 14.895 eventos (14.765 benignos / 130 maliciosos), 4 técnicas, tres fuentes de contaminación identificadas y filtradas.
- **Pendientes reubicados al cerrar F2:** validación cruzada evaluador-vs-SQL → F7 · autoencoder y modelo secuencial → F3.3/F7 (🟢) · publicación en `det.anomalies` → F3.3 · integración del dataset del laboratorio en ML-1 (requiere ruta CSV → OCSF, hoy inexistente).
- **F3.1 hecho (30-07):** corpus reproducible cargado con `scripts/load_f3_corpus.sh` (550.494 eventos, 9 datasets, 1.199 alertas); verdad conocida de apt29 day1 en `docs/scenarios/apt29-day1.md`; **ancla de P1 decidida con datos: `T1003.*`, no `T1003.001`** (la subtécnica exacta cubre 6 de 7 variantes y falla con Mimikatz); `WITHIN` de P1 = 10 min, medido sobre los 4 min 47 s del núcleo real.
- **Deuda de reproducibilidad:** los scripts de `emulation/` en el repo son la versión **previa** a las tres correcciones de contaminación, y `run-lab.ps1` solo existe dentro de la VM (`C:\Lab`). Pendiente copiarlos a `\\VBOXSVR\Shared` → `emulation/`.
- **Duplicados resueltos (31-07):** `alert_id` determinista (`sha1(event_hash|rule_id)`) + `ReplacingMergeTree`. Corpus re-detectado entero: 1.168 filas, **0 duplicados**. Las cifras vuelven a ser publicables.
- **P1 resuelto en batch (31-07): 7 de 7 variantes de LSASS_campaign → DoD 2 de F3 cumplido.** Vista `tfg.p1_campanas` como oráculo de la versión en streaming. 10 campañas, 0 sin etapa de refuerzo.
- **⚠️ Limitación medida del normalizador:** el 15 % de los eventos normalizados son byte-idénticos a otro, porque el evento OCSF no lleva `EventRecordID`. Impacto hoy pequeño (apt29 da 738 alertas en vez de 741, 0,4 %), pero conviene arreglarlo para que `event_hash` sea identidad verdadera.
- **P1 en streaming (31-07, sesión B): funcionando y emitiendo a `det.campaigns`.** 10 campañas, **7 de 7 variantes también en streaming**, confianza idéntica al oráculo. Circuito cerrado `norm.events → det.alerts → det.campaigns`. Dos divergencias conocidas y explicadas frente al batch (apt29/NASHUA se pierde; el atómico aparece de más).
- **Hallazgo estructural:** `MATCH_RECOGNIZE` de Flink **no puede expresar una racha maximal abierta** (prohibido el cuantificador voraz al final; el reluctante da la coincidencia mínima). Por eso la correlación en dos niveles deja de ser opción de diseño y pasa a ser requisito de la herramienta.
- **Divergencias reconciliadas (31-07):** batch y streaming producen las **mismas 11 campañas**. NASHUA se recupera haciendo la transición bidireccional; el atómico se recupera relajando el `HAVING` del oráculo, que penalizaba las capturas limpias — la versión en streaming corrigió a la de referencia. Coinciden en qué campañas hay, **no en su extensión** (el batch absorbe contexto de ±10 min, Flink acota a la evidencia).
- **Frontend (23-09-2026, extra):** base del portal en `frontend/` con datos simulados — Situación, grafo del pipeline, los cuatro cuadros de Grafana redibujados y una **demo de conciencia situacional** (dos organizaciones, ataque simulado paso a paso, ruta probable hacia las joyas de la corona y asistente de respuesta cuyas acciones cambian el curso del ataque). 81 tests. Detalle en `frontend/README.md`. No bloquea F3.
- **Mapa mundial del boceto (21-10-2026):** `/mapa`, flujo geográfico ilustrativo de Helios con rutas animadas, pausa, filtros, zoom y detalle. Cartografía local; sin geolocalizar las IP privadas de APT29 ni conectarse a servicios externos. Detalle en la última entrada del diario.
- **Siguiente:** P2 (movimiento lateral), que reutiliza la máquina de dos niveles para el salto entre hosts; el caso real es SCRANTON → NASHUA a las 03:09:24. Pendientes de fondo: `stages[]` sin emitir, contadores `trans_*` que cuentan transiciones y no alertas, `EventRecordID` en el normalizador, versionar los scripts del laboratorio, apt29 day2.


## 5. Estructura del repo
> **Nota (24-07-2026):** la documentación se separó a un segundo repositorio. Este archivo y la
> memoria LaTeX viven en `tfg-memoria`; el código, en `tfg-ciberconciencia`. `./scripts/save.sh`
> guarda y sube ambos.

```
tfg-memoria/
├── BITACORA.md          # este archivo (memoria del proyecto)
├── AnotacionesMemoria.md
└── Memoria/             # proyecto LaTeX

tfg-ciberconciencia/
├── AGENTS.md            # contexto para agentes que lo auto-cargan (o CLAUDE.md)
├── README.md
├── .gitignore
├── docs/                # ROADMAP.md, anteproyecto, planning, estudios, escenarios
├── infra/               # docker-compose, perfiles, k8s/minikube
├── pipeline/            # ingesta, jobs Flink/CEP, normalización OCSF
├── detection/           # reglas Sigma: pipeline propia, loader, evaluador, cobertura ATT&CK
├── ml/                  # ML-1 anomalías (features, entrenamiento, MLflow)
├── scripts/             # up/down, save.sh (guarda en los dos repos)
├── cti/                 # extracción TRAM/NER, conectores OpenCTI, STIX
├── graph/               # esquema Neo4j, cypher, reglas Datalog/MulVAL, GDS
├── scoring/             # priorización explicable
├── eval/                # referencias a datasets, métricas, notebooks
├── emulation/           # Atomic Red Team, escenarios CALDERA
├── frontend/            # portal web (F8): base con datos simulados
└── data/                # git-ignored (working set; fríos en disco externo)
```

## 6. Cómo usar esta bitácora — plantilla de entrada del diario
Copia esto al final, en la sección Diario (lo más nuevo abajo):
```
### YYYY-MM-DD — <título corto de la sesión>
- **Con qué/quién:** <IA o agente usado: Claude / Claude Code / otro / a mano>
- **Objetivo:** <qué querías conseguir>
- **Hecho:** <qué se hizo de verdad>
- **Decisiones:** <cualquier decisión nueva; si afecta a §2 o §4, actualízalas también>
- **Problemas / pendiente:** <lo que quedó a medias o falló>
- **Siguiente paso:** <lo inmediato>
- **Archivos tocados:** <rutas>
```

---

## DIARIO DE TRABAJO
*(append-only; lo más nuevo abajo)*

### 2026-07-12 — Arranque y cierre de decisiones de diseño
- **Con qué/quién:** Claude (chat) — planificación.
- **Objetivo:** definir el tema del TFG, el stack, el plan y el entorno.
- **Hecho:** elegido el tema (fusión detección multi-etapa + grafo CTI razonado); definida arquitectura y stack; redactado anteproyecto para el tutor; hecho el planning ago2026–jun2027; estudios de recursos, coste y acceso remoto; creada esta bitácora.
- **Decisiones:** las de §2 (Neo4j+Datalog en lugar de SPARQL; Flink/Redpanda/ClickHouse/Dagster/FastAPI; ML solo inferencia; contenedores en 1 host; portátil sobre nube).
- **Problemas / pendiente:** falta montar el entorno y confirmar tutor.
- **Siguiente paso:** crear repo con esta estructura; WSL2 + Docker + `.wslconfig`; levantar Redpanda de prueba; escribir al tutor en agosto.
- **Archivos tocados:** `BITACORA.md` (nuevo).

### 2026-07-21 — F0: montaje del entorno base
- **Con qué/quién:** Claude (chat), paso a paso a mano.
- **Objetivo:** dejar el entorno de trabajo listo desde cero.
- **Hecho:** instalado WSL2 + Ubuntu (systemd activado); `.wslconfig` con 44GB/24/swap 8GB; Docker Engine dentro de WSL (no Docker Desktop) funcionando sin sudo (hello-world OK); VS Code conectado a WSL; repo creado en `~/proyectos/tfg-ciberconciencia` con estructura + README + .gitignore + bitácora.
- **Decisiones:** Docker Engine-in-WSL en vez de Docker Desktop (montaje profesional). Repo de Docker fijado al codename `noble` porque Ubuntu va por `resolute` (sin repo de Docker aún).
- **Problemas / pendiente:** ninguno relevante.
- **Siguiente paso:** primer commit; luego `docker-compose` con perfiles + Redpanda de prueba.
- **Archivos tocados:** repo inicial, README.md, .gitignore, BITACORA.md.

### 2026-07-21 — F1: Redpanda operativo
- **Con qué/quién:** Claude (chat), paso a paso.
- **Objetivo:** montar el bus de eventos, primer servicio real del pipeline.
- **Hecho:** creado `infra/docker-compose.yml` con perfil `core` (Redpanda v25.2.1 + Console v3.1.0, límites 2 CPU/2G). Levantado con `docker compose --profile core up -d`. Verificado: clúster `Healthy: true`, ciclo producir→consumir OK, consola web en `localhost:8080`. GitHub: repo privado sincronizado.
- **Decisiones:** Redpanda Console incluida desde el inicio. Topics internos por `redpanda:29092`, externos por `localhost:9092`.
- **Problemas / pendiente:** ninguno.
- **Siguiente paso:** replay de dataset (OTRF/Mordor) → Redpanda.
- **Archivos tocados:** `infra/docker-compose.yml` (nuevo), `BITACORA.md`.

### 2026-07-23 — F1: primer replay de datos reales a Redpanda
- **Con qué/quién:** Claude (chat), paso a paso.
- **Objetivo:** localizar datasets de seguridad e ingerirlos en el bus de eventos.
- **Hecho:** clonado OTRF Security-Datasets (shallow, 1.2 GB) en `data/`. Explorados `atomic` (por tácticas ATT&CK) y `compound` (apt29 day1/day2, LSASS_campaign_01..07, Log4Shell, GoldenSAML). Elegido para arrancar el atomic `psh_lsass_memory_dump_comsvcs` (T1003.001 / TA0006, metadatos en `SDWIN-201018195009.yaml`, 184 eventos JSON Lines). Creado venv + `confluent-kafka` 2.15.0. Escrito `pipeline/replay_dataset.py` y ejecutado el replay completo (184 ev, 0 omitidos, ~3300 ev/s). Verificada la técnica en los datos.
- **Decisiones:** taxonomía de topics `raw.* / norm.* / det.*`; clave de partición = hostname (orden por máquina, requisito del CEP); timestamp del evento original como timestamp Kafka (habilita *event time* en Flink); cliente `confluent-kafka` (librdkafka) en vez de kafka-python. Añadida regla estricta de autoría + hook `.githooks/commit-msg`.
- **Problemas / pendiente:** Ubuntu `resolute` y Python 3.14 son muy nuevos; hubo que fijar el repo de Docker a `noble`. `confluent-kafka` sí tenía wheel para cp314.
- **Siguiente paso:** Flink en el compose + job consumidor con normalización OCSF.
- **Archivos tocados:** `pipeline/replay_dataset.py` (nuevo), `.githooks/commit-msg` (nuevo), `BITACORA.md`, `AGENTS.md`.

### 2026-07-24 — F1: Flink operativo + prueba de humo CEP superada
- **Con qué/quién:** Claude (chat), paso a paso.
- **Objetivo:** levantar Flink y validar la vía SQL MATCH_RECOGNIZE antes de comprometerla.
- **Hecho:** añadidos flink-jobmanager/taskmanager (2.2.1-java17) al compose (perfil `stream`). Descargado conector Kafka 5.0.0-2.2. SQL Client: CREATE TABLE sobre raw.host.windows (formato raw), verificado COUNT=184, y MATCH_RECOGNIZE emparejando pares A B con event-time de 2020.
- **Decisiones:** API de Flink = **PyFlink + SQL MATCH_RECOGNIZE** (plan B de Java descartado). Se eligió Flink 2.2.x porque el conector Kafka aún no existe para 2.3.
- **Problemas / pendiente:** el CEP no emitía nada por watermark bloqueado (particiones vacías al tener un solo host); resuelto con `table.exec.source.idle-timeout=5s`. El `cp` del jar a /opt/flink/lib es temporal (pendiente de automatizar en compose).
- **Siguiente paso:** persistir el conector vía compose; subconjunto OCSF + normalización (F1.2–F1.3).
- **Archivos tocados:** `infra/docker-compose.yml`, `infra/flink/lib/*.jar`, `BITACORA.md`.


### 2026-07-24 (2) — F1.3: entorno PyFlink + primer mapeador OCSF
- **Con qué/quién:** Claude (chat), paso a paso.
- **Objetivo:** dejar PyFlink operativo y empezar la normalización a OCSF.
- **Hecho:** persistido el jar del conector y el idle-timeout en compose. Verificados class_uid OCSF en schema.ocsf.io y definido subconjunto ampliado (~20 clases) en 3 oleadas. Creado `pipeline/normalize/ocsf_common.py` (esqueleto base, type_uid, extensión tfg, unmapped) y `sysmon.py` con map_sysmon_10 (Process Activity 1007). Test con eventos reales OK: rundll32→lsass, signal_suspicious_access=true, CallTrace con comsvcs.dll preservado.
- **Decisiones:** normalización en PyFlink (opción A). PyFlink no soporta Python 3.14 → entorno aparte `.venv-flink` con Python 3.12 (uv) + OpenJDK 17 en WSL. Señales de detección precalculadas en el mapeador (semilla de explicabilidad).
- **Problemas / pendiente:** cadena de incompatibilidades por versiones nuevas (3.14, uv PATH al activar venv, PyFlink 2.3→2.2.1, falta de java) — todas resueltas. Registro de Windows (Sysmon 12/13/14) pendiente de verificar en OCSF.
- **Siguiente paso:** completar mapeadores oleada 1 + despachador + job de normalización.
- **Archivos tocados:** `infra/docker-compose.yml`, `pipeline/jobs/smoke_pyflink.py`, `pipeline/normalize/{__init__,ocsf_common,sysmon,test_sysmon}.py`, `BITACORA.md`.


### 2026-07-24 (3) — F1.3: normalización OCSF al 100 % de cobertura
- **Con qué/quién:** Claude (chat), paso a paso.
- **Objetivo:** completar la oleada 1 de mapeadores y medir cobertura.
- **Hecho:** `sysmon.py` (1/3/5/7/10/11 + registro 12/13/14), `winsecurity.py` (4688/4689/handles 4656-4663-4658-4690/1102/5156/5158/4624/4625), `registry.py` (despachador) y `coverage.py` (métrica). Cobertura sobre el dataset LSASS: 40,2 % → 80,4 % → **100 %** (184/184, 0 DLQ), 12 tipos OCSF distintos. Verificada la cadena de señales: dump_module (Sysmon 7) → lsass_access (Sysmon 10 + Security 4656/4663) → dump_file (Sysmon 11) → log_cleared (Security 1102).
- **Decisiones:** el registro de Windows (Sysmon 12/13/14) no tiene clase en el OCSF base → se mapea a Process Activity conservando todo en `unmapped`, decisión documentada. Señales `tfg.signal_*` precalculadas en el mapeador. Hashes parseados al formato OCSF (para cruce con IOCs en F4).
- **Problemas / pendiente:** ninguno. Revisar si alguna extensión Windows de OCSF añade clase de registro.
- **Siguiente paso:** job PyFlink de normalización hacia `norm.events`.
- **Archivos tocados:** `pipeline/normalize/{sysmon,winsecurity,registry,coverage}.py`, `BITACORA.md`.

### 2026-07-24 (4) — F1.3: pipeline raw → norm en streaming
- **Con qué/quién:** Claude (chat), paso a paso.
- **Objetivo:** llevar la normalización al streaming real.
- **Hecho:** creados topics `norm.events` (6 part.) y `dlq.normalize`. Escrito `normalize_job.py` (consumidor/productor con DLQ, commit manual de offsets, idle-exit). Ejecutado sobre los 184 eventos: 100 % normalizados, 0 a DLQ — coincide con la medición en batch. Verificado en `norm.events` un evento OCSF completo (rundll32→lsass, 0x1fffff) con `dataset_id` propagado. Limpiados ficheros `:Zone.Identifier` de Windows y añadidos al .gitignore.
- **Decisiones:** la etapa de normalización se implementa como servicio Python con confluent-kafka (opción C), no en PyFlink. Motivo: la lógica de mapeo es idéntica y así avanzamos rápido; Flink entra en F2/F3 para Sigma y CEP, donde su estado y checkpointing sí son imprescindibles. Trade-off consciente: esta etapa no tiene exactly-once de Flink.
- **Problemas / pendiente:** dos entornos virtuales (.venv 3.14 con confluent-kafka / .venv-flink 3.12 con PyFlink) obligan a alternar; valorar unificar en .venv-flink.
- **Siguiente paso:** F1.4 ClickHouse + F1.5 observabilidad.
- **Archivos tocados:** `pipeline/jobs/normalize_job.py`, `.gitignore`, `Memoria/`, `BITACORA.md`.

### 2026-07-24 (5) — F1.4: ClickHouse y persistencia analítica
- **Con qué/quién:** Claude (chat), paso a paso.
- **Objetivo:** persistir los eventos normalizados para hunting y evaluación.
- **Hecho:** ClickHouse en compose con límite de memoria; tabla `tfg.events` con columnas dedicadas + señales + raw JSON. Sink Kafka→ClickHouse por lotes (184 insertados). Scripts de arranque/parada y alias `tfg`. README del repo reescrito. Verificada la kill chain con SQL: carga DLL → acceso LSASS (Sysmon 10 + Security 4656/4663 entrelazados) → volcado a disco → borrado de logs.
- **Decisiones:** esquema híbrido (columnas para lo consultado + `raw` completo). ORDER BY (device_hostname, time). Señales como columnas Bool para consultas triviales.
- **Problemas / pendiente:** (1) ClickHouse solo escuchaba en loopback interno → `<listen_host>0.0.0.0</listen_host>`. (2) clickhouse-connect exige `datetime`, no float, para DateTime64. (3) **BUG IMPORTANTE**: priorizar `UtcTime` desincronizaba Sysmon y Security 16 h, invirtiendo el orden del ataque; corregido usando `TimeCreated` como campo común. Reprocesado todo. Ambos hallazgos anotados en AnotacionesMemoria.md.
- **Siguiente paso:** F1.5 observabilidad o F2 (Sigma). Arrancar memoria en agosto.
- **Archivos tocados:** `infra/docker-compose.yml`, `infra/clickhouse/`, `pipeline/jobs/sink_clickhouse.py`, `pipeline/normalize/ocsf_common.py`, `scripts/`, `README.md`, `AnotacionesMemoria.md`, `BITACORA.md`.


### 2026-07-25 — F1.5: observabilidad y cierre de F1
- **Con qué/quién:** Claude (chat), paso a paso.
- **Objetivo:** completar la observabilidad y cerrar F1.
- **Hecho:** Prometheus + Grafana en compose (perfil `observability`). Reporter Prometheus en Flink (puerto 9249) y endpoint de métricas en ClickHouse (9363). 5 targets `up`, métricas reales verificadas. Datasources y dashboards provisionados por fichero (sin configuración manual): salud del pipeline, panel de seguridad y calidad de datos.
- **Decisiones:** provisioning declarativo de Grafana (reproducible desde cero). Dos datasources: Prometheus para infraestructura, ClickHouse para eventos de seguridad. UIDs fijados para que los dashboards no dependan de IDs autogenerados.
- **Problemas / pendiente:** (1) el reporter solo estaba en el jobmanager, faltaba en el taskmanager. (2) Docker crea como root las carpetas montadas que no existen → `chown` necesario. (3) Confusión entre `provisioning/dashboards/` (config) y `dashboards/` (los JSON). (4) El plugin de ClickHouse no admite `UNION ALL` en un panel → resuelto con `arrayJoin`.
- **Siguiente paso:** arrancar la memoria; luego F2 (Sigma).
- **Archivos tocados:** `infra/docker-compose.yml`, `infra/prometheus/`, `infra/grafana/`, `infra/clickhouse/config.d/memory.xml`, `BITACORA.md`.

### 2026-07-25 (2) — Arranque de la memoria
- **Con qué/quién:** Claude (chat).
- **Objetivo:** montar el proyecto LaTeX y redactar los capítulos ya posibles.
- **Hecho:** instalado TeX Live; plantilla oficial reorganizada en `Memoria/`; Makefile y .gitignore de LaTeX. Redactados resumen, abstract, glosario, introducción, estado del arte, desarrollo (hasta F1) y aspectos éticos; ref.bib inicial. Compila en 54 páginas sin errores ni referencias rotas.
- **Decisiones:** se sustituye `minted` por `listings` (latexminted es incompatible con Python 3.14 y habría fallado al insertar el primer bloque de código). Se mantiene la estructura de capítulos oficial de la UPM, mapeando las fases del roadmap como secciones de `desarrollo.tex`.
- **Problemas / pendiente:** portada sin rellenar; falta figura de arquitectura; anexoA vacío; estado del arte necesita referencias de la revisión de agosto.
- **Siguiente paso:** revisión bibliográfica de agosto.
- **Archivos tocados:** `Memoria/` (completa), `.gitignore`, `BITACORA.md`.


### 2026-07-25 (3) — F2: pipeline Sigma→OCSF propia y primera detección
- **Con qué/quién:** Claude (chat).
- **Objetivo:** montar la capa de detección con reglas Sigma.
- **Hecho:** instalado el ecosistema pySigma y clonadas 3.142 reglas. Analizada la pipeline oficial `pySigma-pipeline-ocsf` y detectadas 3 desviaciones respecto al esquema del proyecto. Escrita pipeline propia (9 categorías). Validación de extremo a extremo: regla oficial → SQL → ClickHouse → 1 detección correcta (rundll32→lsass, 0x1fffff), con exclusión correcta del caso 0x1410.
- **Decisiones:** se escribe pipeline propia en lugar de extender la oficial, porque las condiciones `add_condition` se acumulan con AND y los `type_uid` divergentes se anularían entre sí. Correcciones aplicadas: (1) `SourceImage` → `actor.process` y no `parent_process` (en ProcessAccess el origen es el actor, no el padre); (2) `image_load` → clase Module Activity 1005 y no Process Activity 1007/Other; (3) `process_access` → actividad Open (3) y no Other (99). Campos sin equivalente OCSF dirigidos a `unmapped`, conforme al modelo del proyecto.
- **Problemas / pendiente:** `rule_condition_linking` no existe en pySigma 1.4.0 (bloques de registro separados por categoría). El backend de ClickHouse está en estado *testing*.
- **Siguiente paso:** evaluador de reglas en streaming.
- **Archivos tocados:** `detection/pipelines/ocsf-tfg.yml` (nuevo), `BITACORA.md`.


### 2026-07-26 — F2: evaluador de reglas Sigma en memoria
- **Con qué/quién:** Claude (chat).
- **Objetivo:** evaluar reglas Sigma sobre eventos OCSF sin generar consultas intermedias.
- **Hecho:** medida la frecuencia de modificadores en el repositorio (contains 3.362, endswith 2.494, all 854, startswith 431, re 155 → 98% con cinco). Escritos `loader.py` (carga + pipeline + extracción de metadatos ATT&CK) y `evaluator.py` (acceso a campos anidados, comparación de valores Sigma, recorrido del árbol de condiciones). Validado: 2.093 reglas, 10 alertas correctas, 0 falsos positivos. Optimización 73× medida.
- **Decisiones:** evaluación directa sobre el evento en memoria (no generación de consultas), imprescindible para streaming. Alcance delimitado a los modificadores que cubren el 98% de los usos reales, con métrica que lo justifica. Los campos coincidentes se devuelven con la alerta como semilla de la explicabilidad del Pilar C.
- **Problemas / pendiente:** dos incompatibilidades con pySigma 1.4.0: `SigmaRegularExpression.regexp` no es cadena plana (requiere `str()`), y los comodines son `SpecialChars.WILDCARD_MULTI/SINGLE`, no clases con nombre. Ambas resueltas.
- **Siguiente paso:** job de streaming hacia `det.alerts`.
- **Archivos tocados:** `detection/{loader,evaluator}.py` (nuevos), `BITACORA.md`.


### 2026-07-27 — F2: detección en streaming y salto a volumen realista
- **Con qué/quién:** Claude (chat).
- **Objetivo:** poner la detección en el pipeline y validarla con datos serios.
- **Hecho:** `pipeline/jobs/detect_job.py` consumiendo `norm.events` y publicando en `det.alerts`; consumidor por grupo (permite paralelizar por partición). Verificadas 10 alertas idénticas a la prueba en memoria; alerta de ejemplo con el comando literal del atacante en `matched_fields`. Cargado apt29 day1 (196.081 eventos, 368 MB): replay a 3.044 ev/s, normalización 99,4%. Nuevos mapeadores: PowerShell (Script Activity 1009, 10.766 eventos), Sysmon 2/8/9/18/23, Security 4672/4673/4703/4634/4627/4670/4945/5447/5154/5145.
- **Decisiones:** cobertura cerrada en 99,4%; los 1.252 eventos restantes son cola larga (<100 apariciones cada tipo) con rendimiento decreciente claro. Nuevas señales precalculadas: timestomp, remote_thread, raw_disk_access, pipe_name, special_privileges, ps_suspicious, ps_encoded.
- **Problemas / pendiente:** rendimiento de detección ~140 ev/s con 2.093 reglas → ~25 min para apt29. Vía de mejora identificada: paralelizar instancias del job por partición (el consumidor ya está preparado).
- **Siguiente paso:** analizar alertas de apt29; matriz de cobertura ATT&CK.
- **Archivos tocados:** `pipeline/jobs/detect_job.py` (nuevo), `pipeline/normalize/powershell.py` (nuevo), `pipeline/normalize/{sysmon,winsecurity,registry}.py`, `BITACORA.md`.
- **Resultados apt29 day1:** 741 alertas sobre 195.197 eventos (0,39%), 0 a DLQ.
  **4 hosts** (SCRANTON 606, NASHUA 117, NEWYORK 16, UTICA 2) → desbloquea el patrón de
  movimiento lateral. **33 técnicas ATT&CK** distintas, incluidas T1003.001, T1547.001
  (persistencia), T1048.003 (exfiltración). CobaltStrike detectado (129 alertas).
  Regla dominante: "Binary Or Script Dropper Via PowerShell" con 292 (39% del total)
  → candidata a análisis de falsos positivos y caso de uso claro para la agrupación del Pilar A.
  **Línea base de reducción de alertas: 741.**
  Rendimiento: 78 ev/s con 2.093 reglas (~163.000 evaluaciones/s), 42 min para el dataset.


  ### 2026-07-27 (2) — F2: persistencia de alertas y primeros análisis
- **Con qué/quién:** Claude (chat).
- **Objetivo:** volcar las alertas a ClickHouse y analizar los resultados de apt29.
- **Hecho:** tabla `tfg.alerts` (técnicas como Array, ORDER BY host+time+regla) y sink `sink_alerts.py`; 771 alertas persistidas. Investigada la regla dominante: las 292 alertas de "Dropper Via PowerShell" son **una sola acción** (PowerShell descomprimiendo SysinternalsSuite en 8 min, un fichero por alerta) → detección legítima con granularidad inadecuada; caso de uso perfecto para el Pilar A. **Medida la línea base de reducción de alertas: 741 → 87 (88,3 %)** con agrupación ingenua (regla+host+ventana 10 min).
- **Decisiones:** corregida la clasificación de etiquetas ATT&CK en `rule_summary()`: el repositorio de Sigma mezcla bajo `attack.` técnicas (tNNNN), software (sNNNN), grupos (gNNNN) y nombres de táctica no estándar de la comunidad (`defense-impairment`, `stealth`). Se separan en `techniques`, `tactics`, `software` y `other_tags` validando contra la lista oficial de tácticas.
- **Problemas / pendiente:** (1) reprocesar las alertas con la clasificación corregida (42 min de detección). (2) **Verificar `T1685` en attack.mitre.org** antes de citarlo: aparece en reglas de evasión defensiva y no encaja con lo esperado.
- **Siguiente paso:** matriz de cobertura ATT&CK; después Pilar A (CEP).
- **Archivos tocados:** `infra/clickhouse/init/02_alerts.sql`, `pipeline/jobs/sink_alerts.py` (nuevos), `detection/loader.py`, `BITACORA.md`.


### 2026-07-27 (3) — F2.2: ML-1, detector de anomalías
- **Con qué/quién:** Claude (chat).
- **Objetivo:** primer componente de aprendizaje automático del sistema.
- **Hecho:** cargador masivo `load_atomics.py` (108/155 datasets; los 47 restantes son capturas de red, no host). Total: 1,22 M eventos únicos de 105 datasets. Extractor de características por ventana y entrenamiento comparando dos estrategias. **Resultado: AUC-ROC 0,979 / AUC-PR 0,981** con entrenamiento solo sobre ventanas limpias; las 5 ventanas más anómalas coinciden con las de mayor número de alertas Sigma, sin que el modelo las haya visto.
- **Decisiones:** nivel de agregación = ventana de host (5 min), por su encaje con el problema multi-etapa; 420 ventanas frente a las 60 iniciales gracias a la carga de atómicos. Entrenamiento no supervisado excluyendo apt29 day1, que se reserva para evaluación con las alertas Sigma como referencia externa. **Menos datos pero limpios superan a más datos contaminados** (0,979 vs 0,933).
- **Problemas / pendiente:** (1) solo 28 ventanas de evaluación → incertidumbre alta en la métrica. (2) Posible circularidad: las señales `signal_*` participan tanto en las características como en la definición de "ventana limpia"; comprobar robustez sin ellas. (3) El sink no es idempotente → duplicados; resuelto con tabla `events_dedup`, pendiente pasar a ReplacingMergeTree. (4) IPv6 en apt29 obligó a cambiar `dst_ip` de IPv4 a IPv6.
- **Siguiente paso:** ablación sin señales; MLflow; laboratorio de emulación.
- **Archivos tocados:** `pipeline/load_atomics.py`, `pipeline/jobs/sink_alerts.py`, `ml/anomaly/{features,explore,train}.py`, `infra/clickhouse/init/02_alerts.sql`, `BITACORA.md`.

### 2026-07-27 (4) — ML-1: prueba de robustez y hallazgo metodológico
- **Con qué/quién:** Claude (chat).
- **Objetivo:** comprobar si el detector depende de características circulares.
- **Hecho:** ablación excluyendo las 8 características que participan en la definición de "ventana limpia" (señales `signal_*`, inyecciones, severidad). Resultados sobre apt29 day1: A (29 feats, limpias) 0,979 · C (21 feats, sin circulares) **1,0** · D (todo, sin circulares) 0,923 · **E (control, solo `n_eventos`) 0,941**.
- **Decisiones:** **circularidad descartada** — quitar las señales no empeora, mejora. Pero el control E revela que la capacidad discriminante procede mayoritariamente del **volumen de eventos**: las ventanas con alerta tienen mediana de 6.302 eventos frente a 785 las benignas (8×), con solapamiento mínimo (874–2.402). El AUC de 1,0 es indicio de tarea trivialmente separable, no de modelo excelente.
- **Problemas / pendiente:** la separabilidad es probablemente un **artefacto del dataset** (el ataque se ejecuta en ráfagas de actividad intensa), no una propiedad generalizable. **Refuerza la necesidad del laboratorio de emulación**: hacen falta horas de actividad benigna con volumen comparable al del ataque para una validación creíble. Pendiente: características normalizadas por volumen; variante supervisada con SMOTE para comparar (16 positivos vs 404 negativos).
- **Siguiente paso:** laboratorio de emulación (sesión larga); MLflow; ML-1 supervisado con SMOTE.
- **Archivos tocados:** `ml/anomaly/train.py`, `BITACORA.md`.

### 2026-07-27 (4) — ML-1: evaluación con controles y ablaciones
- **Con qué/quién:** Claude (chat).
- **Objetivo:** determinar si el detector aprende algo más que el volumen de actividad.
- **Hecho:** ampliadas las características a 42, separadas en absolutas (26) y relativas (16, proporciones independientes del volumen por construcción). Ejecutados siete experimentos sobre apt29 day1:
  | Estrategia | Feats | AUC-ROC |
  |---|---|---|
  | A: limpias, todas | 42 | 0,995 |
  | C: limpias, sin circulares | 34 | 0,995 |
  | E: control, solo `n_eventos` | 1 | 0,941 |
  | F: limpias, solo ratios | 16 | 0,867 |
  | B: contaminado, todas | 42 | 0,913 |
  | D: contaminado, sin circulares | 34 | 0,851 |
  | G: contaminado, solo ratios | 16 | 0,533 |
- **Decisiones y hallazgos:**
  1. **Circularidad descartada:** excluir las señales que definen "ventana limpia" no degrada el resultado (0,995 en ambos casos).
  2. **Volumen y perfil son complementarios:** el control de volumen alcanza 0,941 y los ratios 0,867 de forma independiente; combinados llegan a 0,995. Esto justifica el enfoque multivariante frente a una regla de umbral simple.
  3. **La pureza del entrenamiento es crítica:** con las mismas 16 características relativas, entrenar con datos limpios da 0,867 y con datos contaminados 0,533 (azar).
  4. Se establece el **control de volumen (0,941) como línea base permanente** para la evaluación de F7.
- **Problemas / pendiente:** solo 28 ventanas de evaluación → incertidumbre alta. La separabilidad por volumen es en parte artefacto de los datasets (el ataque se ejecuta en ráfagas, sin actividad de fondo sostenida). **Motiva el laboratorio de emulación** como requisito para una validación creíble.
- **Siguiente paso:** MLflow; ML-1 supervisado con SMOTE (16 positivos vs 404 negativos); laboratorio de emulación.
- **Archivos tocados:** `ml/anomaly/{features,train}.py`, `BITACORA.md`.

### 2026-07-28 — F2: cobertura ATT&CK y experimentos en MLflow
- **Con qué/quién:** Claude (chat).
- **Objetivo:** cerrar F2 con la matriz de cobertura y el registro reproducible de ML-1.
- **Hecho:**
  1. **Matriz de cobertura ATT&CK** (`detection/coverage_matrix.py`): genera dos capas en formato Navigator — potencial (300 técnicas, 177 subtécnicas, sobre 2.301 reglas) y observada (34 técnicas). Tasa de activación 11,3 %: hay 266 técnicas con detección disponible que ningún dataset ha ejercitado, lo que **motiva el laboratorio de emulación**. 238 reglas (10 %) carecen de etiqueta ATT&CK.
  2. **MLflow** desplegado y 10 experimentos registrados:
  | Enfoque | AUC-ROC | AUC-PR | F1 |
  |---|---|---|---|
  | IF limpias, todas | 0,995 | 0,996 | — |
  | IF limpias, sin circulares | 0,995 | 0,996 | — |
  | Control solo volumen | 0,941 | 0,920 | — |
  | RF sin SMOTE, sin circulares | 0,923 | 0,882 | 0,750 |
  | RF + SMOTE, solo ratios | 0,913 | 0,869 | 0,698 |
  | IF contaminado, todas | 0,913 | 0,919 | — |
  | IF limpias, solo ratios | 0,867 | 0,806 | — |
  | RF + SMOTE, sin circulares | 0,864 | 0,829 | 0,698 |
  | RF sin SMOTE, solo ratios | 0,854 | 0,798 | 0,732 |
  | IF contaminado, solo ratios | 0,533 | 0,646 | — |
- **Hallazgos:**
  1. **SMOTE ayuda con pocas características y estorba con muchas:** solo ratios 0,854 → 0,913; sin circulares 0,923 → 0,864. Coherente con la interpolación de SMOTE en espacios de alta dimensión.
  2. **El no supervisado supera al supervisado** (0,995 vs 0,923): el supervisado aprende de etiquetas heurísticas, el no supervisado de la distribución real de lo normal.
  3. `stealth` **sí es táctica** en ATT&CK v19 (renombra a `defense-evasion`); corregida la lista en `loader.py`.
- **Problemas / pendiente:** en el conjunto supervisado la clase "ataque" es **mayoritaria** (260 vs 132), al contrario que en un escenario real; SMOTE sobremuestrea la clase equivocada respecto a producción. Limitación propia de los datasets de laboratorio, a documentar.
- **Siguiente paso:** F3, Pilar A (CEP).
- **Archivos tocados:** `detection/coverage_matrix.py`, `ml/anomaly/train_mlflow.py` (nuevos), `detection/loader.py`, `infra/docker-compose.yml`, `BITACORA.md`.


### 2026-07-30 — Migración a VirtualBox y primera captura del laboratorio de emulación
- **Con qué/quién:** Claude (chat), paso a paso.
- **Objetivo:** completar la migración del laboratorio de Hyper-V a VirtualBox (decidida el día anterior por problemas de portapapeles/transferencia de ficheros) y generar el primer dataset etiquetado de telemetría benigna/maliciosa con Atomic Red Team.
- **Hecho:**
  - VM nueva en VirtualBox (Windows 11 Pro, EFI) con Guest Additions, portapapeles bidireccional y carpeta compartida `\\VBOXSVR\Shared` — resuelve de raíz la fricción de ayer.
  - Reinstalados Sysmon (config SwiftOnSecurity) y Atomic Red Team (`Invoke-AtomicRedTeam` 2.1.0); corregida la persistencia de la política de ejecución (`Set-ExecutionPolicy Bypass -Scope LocalMachine`, que ayer solo se aplicaba a la sesión).
  - Rediseñado el mecanismo de captura: `capture-manifest.ps1` (ejecuta atómico + registra ventana temporal en `manifest.csv`, sin *pattern-matching* de texto en vivo) + `export-events-clean.ps1` (Sysmon 1/3/7/8/10/11/12/13/22 + Security 4688 + PowerShell 4104) + `label_dataset.py` (etiquetado offline por *join* de ventana, tolerancia 1 s).
  - Primera tanda capturada: **T1547.001** (19/20 subtests, excluido el 9 "SystemBC"), **T1070** (2/2), **T1055** (3 intentados: 3/5/6, los tres bloqueados por Windows Defender al detectar los binarios de inyección), **T1003.001** (comsvcs.dll completado sin restricción; ProcDump ×2 con acceso a LSASS denegado — mismo bloqueo de protección de LSA que Mimikatz el día anterior).
  - Corregida la auditoría avanzada de creación de procesos: `auditpol` en español necesita el nombre en español o el GUID (`{0CCE922B-...}`), más `SCENoApplyLegacyAuditPolicy=1` para que la directiva avanzada no quede anulada por la heredada.
  - **Diagnosticadas y corregidas dos fuentes de contaminación** en el primer dataset etiquetado (4.855 eventos): (1) `EventID 4103` (PowerShell Module Logging con comodín `"*"`) resultó ser ~59 % de todo el dataset y casi puro ruido interno (`Set-StrictMode` del propio framework), contaminando ambas clases por igual — corregido desactivando `ModuleLogging` y retirando 4103 del export, quedándose solo con 4104 (script block logging, el que sí captura contenido real). (2) `whoami.exe`/`HOSTNAME.EXE` (llamadas de contexto internas de `Invoke-AtomicTest`) suponían el 62 % de las muestras "maliciosas" a nivel de proceso — corregido con filtro explícito en `label_dataset.py`. Verificado con datos reales: tras ambos filtros, las muestras maliciosas pasan de 1.052 (contaminadas, una sola ventana dominando el 78 %) a 147 (limpias y bien repartidas entre técnicas).
  - Incidente: la VM se congeló tras ~90 min desatendida (pantalla en negro sin respuesta, requirió `Reset`). Causa probable: suspensión de pantalla/equipo de Windows. `manifest.csv` y el dataset previo sobrevivieron intactos; solo se perdió `telemetry_clean.json` (regenerado sin problema) y el generador benigno en curso.
  - Construido `run-lab.ps1`: orquesta benigno → export → etiquetado → resumen → copia de seguridad con sello temporal en la carpeta compartida, con comprobaciones previas (admin, ficheros, Sysmon, Python/pandas) y corrección de raíz del cuelgue (desactiva suspensión de pantalla/equipo e hibernación; amplía el tamaño máximo de los logs de eventos para no perder las ventanas de esta mañana durante una sesión larga).
- **Decisiones:** confirmado el mecanismo de captura por ventana + etiquetado offline como método definitivo (frente al *pattern-matching* en vivo del primer intento en Hyper-V). Se mantiene el descarte de herramientas de malware real (Mimikatz, SystemBC, NanoDump) pese al aislamiento del laboratorio; los bloqueos de Defender/protección de LSA se tratan como resultado documentable ("técnica intentada, prevenida por control"), no como fallos a forzar.
- **Problemas / pendiente:** dataset final (con línea base benigna sostenida de 2h) generándose vía `run-lab.ps1 -BenignMinutes 120` al cierre de esta sesión — pendiente de revisar el resumen. T1055 se queda sin ninguna muestra "exitosa" (las 3 intentadas fueron bloqueadas); valorar en el futuro variantes que no disparen AV. Pendiente ampliar cobertura de T1003.001 con una variante que documente el bloqueo de LSA sin depender de herramientas de volcado reales. Falta capturar el **EventID 1116 de Defender** si se quiere una señal explícita de "técnica prevenida por control".
- **Siguiente paso:** revisar el dataset final del laboratorio (`dataset_etiquetado.csv`); decidir cómo integrarlo en la evaluación de ML-1 (aporta volumen benigno sostenido, relevante para el hallazgo de "volumen como artefacto" del 27-07); arrancar F3 — diseño de patrones CEP (P1-P5).
- **Archivos tocados:** `C:\Lab\{capture-manifest.ps1, export-events-clean.ps1, label_dataset.py, run-lab.ps1, manifest.csv, telemetry_clean.json, dataset_etiquetado.csv}`, VM VirtualBox nueva (config + Guest Additions + carpeta compartida), registro de Windows (auditoría, ModuleLogging, energía).

- **Cierre del dataset (30-07, tarde):** ejecutado `run-lab.ps1 -BenignMinutes 180` sin errores (comprobaciones previas, energía, logs ampliados, todo en verde). Dataset final: 14.895 eventos (14.765 benigno / 130 malicioso), 4 técnicas (T1547.001=86, T1003.001=26, T1055=10, T1070=8). Detectada y corregida una tercera fuente de contaminación tras revisión del fichero real: `svchost.exe` escribiendo telemetría de compatibilidad de aplicaciones (`InventoryApplicationFile`) durante las ventanas de ataque — 16 filas, ya filtradas en `label_dataset.py`. Verificada diversidad real: T1547.001 con 19 subtests distintos y 48 líneas de comando distintas. Documentado como limitación conocida: pico de 5.528 eventos benignos en la ventana 10:30-11:00 por instalación real de Windows Update en segundo plano — ruido de sistema legítimo, no atribuible al generador de actividad simulada, relevante para el análisis de "volumen como artefacto" ya identificado en ML-1.

### 2026-07-30 (2) — Armonización de plan y memoria + arranque de F3.1
- **Con qué/quién:** Claude Code.
- **Objetivo:** dejar `ROADMAP.md` y `BITACORA.md` fieles al estado real antes de empezar F3, y fijar el punto de partida del Pilar A.
- **Hecho:**
  - **Roadmap (rev. 3).** Marcado F2 como cerrada con sus resultados reales; §1 actualizado (cobertura 99,4 % sobre apt29 day1 junto al 100 % del dataset de referencia); eliminada F2 de la tabla "lo que falta"; F2.1/F2.2/F2.3 con los `[x]` que correspondían.
  - **Pendientes de F2 reubicados explícitamente** en lugar de darlos por hechos: validación cruzada evaluador-vs-SQL → F7; autoencoder y modelo secuencial de ML-1 → F3.3/F7 (🟢); publicación en `det.anomalies` → F3.3, que es donde se consume; integración del dataset del laboratorio en ML-1 (necesita una ruta CSV → OCSF que hoy no existe).
  - **Corregido el esquema de alerta del roadmap**, que llevaba desde F2.1 sin actualizarse y no coincide con lo que emite `build_alert()`. Diferencias que importan para el CEP: `attack.technique_ids[]` y `attack.tactic_ids[]` son **arrays**, no escalares; las tácticas van con **nombre** (`execution`, `defense-evasion`) y **no** con identificador `TAxxxx`; el usuario es `actor.user_name` (plano), no `actor.user.name`; `time` es epoch en milisegundos. Un patrón `MATCH_RECOGNIZE` escrito contra el esquema antiguo habría casado cero filas sin dar error.
  - **Bitácora §2:** actualizada la fila "Uso de ML", que seguía diciendo "solo inferencia, nada de entrenar" y contradecía la revisión del 26-07 del roadmap (ML con entidad propia en cuatro componentes, modelos pequeños entrenados en local). Anotada la regla de contención §2.5 como salvaguarda.
  - **Bitácora:** fusionada la entrada duplicada del 30-07 (dos versiones del mismo día sobre la migración a VirtualBox), preservando el detalle único de la corta (EventID 1116 de Defender como señal explícita de "técnica prevenida"). Actualizados §4 (estado) y §5 (estructura de repos, que seguía describiendo la bitácora dentro del repo de código pese a la separación del 24-07).
  - **Detectada deuda de reproducibilidad del laboratorio:** los scripts versionados en `emulation/` son la versión **previa** a las tres correcciones de contaminación (`export-events-clean.ps1` sigue exportando el 4103; `label_dataset.py` no lleva los filtros de `whoami.exe`/`HOSTNAME.EXE` ni de `InventoryApplicationFile`), y `run-lab.ps1` solo existe dentro de la VM (`C:\Lab`). El dataset final de 14.895 eventos **no es reproducible desde el repo** hasta que se copien.
  - **Inventario del material de F3.1:** los logs de Zeek ya vienen dados en el dataset OTRF (`day1/zeek/combined_zeek.log` y por host, ídem day2) — no hace falta procesar pcaps ni ejecutar Zeek; day2 sigue sin extraer (43 MB comprimidos); el plan de emulación es un único `apt29.xlsx`, no YAML, así que la verdad conocida hay que parsearla.
- **Decisiones:**
  1. **F2 se cierra con pendientes nombrados y reubicados**, no silenciados. Un pendiente movido de fase y anotado es plan; un pendiente olvidado es deuda.
  2. **Los `WITHIN` de los patrones CEP se derivan de la verdad conocida de apt29**, no se fijan a ojo. Es lo que convierte `docs/scenarios/apt29-day1.md` en prerrequisito de F3.2 y no en documentación decorativa.
  3. **Fuente de las etapas del CEP: decisión abierta, se cierra con datos.** Correlacionar solo sobre `det.alerts` es más semántico, pero deja etapas ciegas (si ninguna regla Sigma etiqueta la escritura del `.dmp` o la conexión saliente, esa etapa no existe como alerta y el patrón nunca completa). Propuesta a validar: híbrido, alertas Sigma como etapas ancla + flujo derivado de `norm.events` filtrado por las señales `tfg.signal_*` ya precalculadas en los mapeadores para las etapas de refuerzo. Se decide tras el inventario, no antes.
  4. **Paso 0 de F3.1: inventario de materia prima.** Antes de escribir un solo `MATCH_RECOGNIZE`, comprobar qué `dataset_id` hay realmente en `tfg.alerts`, cuántas alertas por técnica ancla y qué claves trae de verdad `matched_fields`. En particular, si las 7 variantes de LSASS_campaign están normalizadas y detectadas: sin sus alertas, el DoD 2 de F3 (P1 generaliza a las 7) no se puede ni medir.
- **Problemas / pendiente:** la deuda de reproducibilidad del laboratorio requiere arrancar la VM para copiar `run-lab.ps1`, `export-events-clean.ps1` y `label_dataset.py` a `\\VBOXSVR\Shared` y de ahí a `emulation/`. No se puede resolver desde WSL.
- **Siguiente paso:** F3.1 — levantar servicios, inventario sobre `tfg.alerts`, y con eso decidir si P1 se ancla solo en alertas o en el híbrido con señales.
- **Archivos tocados:** `docs/ROADMAP.md` (rev. 3), `BITACORA.md` (§2, §4, §5 y diario).
### 2026-07-30 (3) — F3.1: corpus reproducible, verdad conocida de apt29 y ancla de P1
- **Con qué/quién:** Claude Code.
- **Objetivo:** arrancar el Pilar A: dejar el pipeline en un estado reproducible, reconstruir la cadena real de apt29 day1 y decidir con datos el diseño de P1.
- **Hecho:**
  - **Inventario de partida.** Solo había dos datasets detectados (apt29 day1 y el atómico de comsvcs): las 7 variantes de LSASS_campaign, que son la prueba de generalización del DoD 2 de F3, no estaban cargadas. Confirmado además que las 771 alertas que figuraban eran 741 + 30, sin duplicados.
  - **Diagnosticado un fallo de fondo del pipeline.** Los grupos de consumo solo tenían offset comprometido en **una partición** de cada topic (`normalizer-v1` en la 0 de `raw.host.windows`, `detector-v1` en la 3 de `norm.events`). Como los jobs arrancan sin `--from-beginning`, el `auto.offset.reset=latest` coloca al consumidor al final de las particiones sin offset, que por tanto nunca se leen ni se commitean: quedan enganchadas para siempre. Consecuencia: `norm.events` había acumulado 2,7 M mensajes de pasadas superpuestas y parte de los datos no se había procesado nunca.
  - **`scripts/load_f3_corpus.sh`** (nuevo): recrea los cinco topics con el contrato de particiones del roadmap, reproduce un corpus **fijo** (apt29 day1 + atómico comsvcs + las 7 campañas LSASS = 550.494 eventos) y lo procesa con grupos de consumo nuevos. Deja el estado de partida de la fase documentado y repetible con un comando.
  - **Corpus cargado y verificado:** 550.494 eventos, cobertura de normalización 96,4 %, 1.199 alertas sobre 9 datasets.
  - **DLQ analizado:** de los 20.093 rechazos, ~60 % son PowerShell 4105/4106 (marcadores de inicio/fin de script block, sin contenido). **Ni un solo Sysmon 10 ni 11 en el DLQ**, así que el acceso a LSASS y la escritura del volcado se normalizan bien. Identificados 4 tipos que sí conviene mapear por su relación con F3: Sysmon 22 (DNS, C2 para P2), Sysmon 17 (PipeCreated — apt29 usa Cobalt Strike, que se apoya en named pipes; llamativo que el 18 sí esté mapeado), Sysmon 26 (FileDeleteDetected, etapa D de P1) y Security 5379.
  - **`docs/scenarios/apt29-day1.md`** (nuevo): la verdad conocida de la secuencia, extraída de `apt29.xlsx` (28 pasos en 10 etapas, con host y usuario), traducida a ATT&CK actual, con el mapeo a los patrones P1-P4 y las ventanas temporales medidas sobre las alertas reales.
- **Decisiones y hallazgos:**
  1. **El ancla de P1 no puede ser `T1003.001`.** Medido sobre las 7 variantes: `T1003.001` exacto cubre **6 de 7**; la familia `T1003.*` y la táctica `credential-access` cubren **7 de 7**. La que falla es `LSASS_campaign_01`, **Mimikatz `logonpasswords`**, la variante más emblemática: ninguna regla la etiqueta como T1003.001 porque Meterpreter ejecuta Mimikatz dentro de su propio proceso y no hay un proceso externo abriendo un manejador contra `lsass.exe`. **Es el riesgo R6 del roadmap materializado y medido**, y justifica anclar en la familia y no en la subtécnica.
  2. **El precursor de P1 no puede excluirse por técnica.** En apt29 el mejor precursor es el *drop* de la herramienta de volcado (`Cred Dump Tools Dropped Files`, nivel high), que viene etiquetado con `T1003.001-005`. La condición natural `A.technique <> 'T1003.001'` eliminaría justo la mejor evidencia. La separación entre etapas debe hacerse por clase de evento de origen o por las claves de `matched_fields`.
  3. **`WITHIN` de P1 = 10 minutos**, el doble del núcleo observado (volcado de herramienta → acceso a LSASS = 4 min 47 s). Documentada la limitación: la campaña entera dura 26 min, así que cualquier ventana de 20-30 min abarcaría el día completo y el criterio temporal dejaría de discriminar. Es un artefacto de las evaluaciones de MITRE (ejercicios comprimidos frente a permanencias reales de semanas): las ventanas valen para reproducir estos resultados, no como valores operativos, y en F7 hay que medir la sensibilidad a ese parámetro.
  4. **P1 se implementa solo sobre `det.alerts`**, decisión tomada con datos: las etapas de ancla y de volcado a disco ya existen como alertas Sigma en los dos datasets. El híbrido con las señales `tfg.signal_*` queda reservado para P2 (conexión saliente) y P4.
  5. **`matched_fields` usa rutas OCSF, no nombres de campo Sigma.** Las claves reales útiles son `file.path`, `unmapped.GrantedAccess` (0x1fffff), `unmapped.CallTrace` (comsvcs.dll) y `process.cmd_line`.
  6. **La clave de partición por `hostname` anula el paralelismo del detector** con estos datasets: una sola partición concentró el 66 % de los eventos porque las 7 campañas comparten host. Es un compromiso real —el orden por máquina es obligatorio para el CEP— y tiene su sitio en el apartado de rendimiento de F7. En un entorno con cientos de hosts el reparto sería uniforme; en laboratorio, no.
  7. **Los identificadores del plan de emulación son de ATT&CK v5-v6 y varios están obsoletos** (`T1086`→`T1059.001`, `T1060`→`T1547.001`, `T1050`→`T1543.003`, `T1107`→`T1070.004`, `T1088`→`T1548.002`, `T1002`/`T1022`→`T1560`). Sin traducirlos, el cruce plan ↔ alertas no cuadra y parecen fallos de detección que no lo son.
  8. **El orden real de apt29 no coincide con el P3 del roadmap**: es escalada (3.B) → descubrimiento (4.x) → persistencia (5.x), no descubrimiento → privilegios → persistencia. El patrón tendrá que admitir ambos órdenes o ceñirse al observado y justificarlo.
- **Problemas / pendiente:**
  - **Duplicados en `tfg.alerts`:** apt29 da 752 filas en vez de 741, con 140 repetidas (grupos de hasta 5 copias). Causa: la detección en 3 instancias paralelas commitea cada 5.000 eventos, y al salir las instancias que agotaron sus particiones por `--idle-exit`, la superviviente reanudó desde el último commit y reprocesó. **Invalida cualquier cifra que vaya a la memoria, incluida la métrica estrella de reducción de alertas.** Solución acordada, ya pendiente desde el 27-07: pasar `tfg.alerts` a `ReplacingMergeTree` con clave de deduplicación —arregla el problema de raíz en vez de prohibir el paralelismo—. **Es lo primero de la próxima sesión.**
  - Efecto secundario del `--idle-exit` en instancias paralelas: las rápidas se suicidan en lugar de esperar un rebalanceo que les dé trabajo. Subirlo o quitarlo en ese modo.
  - `T1685.001` vuelve a aparecer en las alertas; sigue pendiente verificarlo en attack.mitre.org (anotado ya el 27-07).
  - apt29 **day2** sigue sin cargar (1,7 GB ya extraídos en `data/samples/apt29/`, 4,4× day1). Se añade de forma deliberada cuando P1 esté escrito.
- **Siguiente paso:** `ReplacingMergeTree` y re-volcado (las 1.199 alertas siguen en el topic, no hay que re-detectar); después, escribir P1 en `MATCH_RECOGNIZE` con ancla `T1003.*`, `WITHIN` de 10 min y las claves OCSF reales de `matched_fields`.
- **Archivos tocados:** `scripts/load_f3_corpus.sh` (nuevo), `docs/scenarios/apt29-day1.md` (nuevo), `docs/ROADMAP.md`.
### 2026-07-31 — F3: deduplicación por identidad y P1 resuelto en batch
- **Con qué/quién:** Claude Code.
- **Objetivo:** dejar las cifras de alertas fiables y responder si P1 detecta las 7 variantes de LSASS_campaign, sin tocar Flink todavía.
- **Hecho:**
  - **Identidad determinista de la alerta.** `alert_id = sha1(event_hash | rule_id)` con `event_hash = sha1(evento normalizado publicado)`, en sustitución del `uuid4` aleatorio. `event_hash` se persiste además como columna propia. `tfg.alerts` pasa a `ReplacingMergeTree(detected_at)` con `ORDER BY (device_hostname, time, alert_id)`.
  - **Por qué así y no con una clave de deduplicación:** el esquema anterior no guardaba ningún identificador del evento de origen (`src_event_id` es el EventID de Windows, 4688 y compañía, que no identifica nada). Dos alertas duplicadas por reprocesado y dos alertas legítimas de eventos distintos del mismo milisegundo eran **idénticas en todos los campos persistidos**: ningún `ORDER BY` podía separarlas. Medido el 30-07: la clave estricta dejaba 612 filas frente a 741 alertas reales, es decir, habría colapsado ~129 alertas legítimas. La solución no era adivinar la identidad, era darla.
  - **Re-detección completa** del corpus (530.401 eventos, 2.093 reglas, 182 ev/s, 48 min, 0 a DLQ): 1.184 alertas producidas, **1.168 filas persistidas, 0 duplicados** (`filas = ids_unicos` en los 9 datasets).
  - **P1 implementado en batch** como vista `tfg.p1_campanas` (`detection/patterns/p1_credential_theft.sql`) más su batería de métricas (`p1_metrics.sql`). Es el **oráculo** de la versión en streaming de F3.2: define el resultado esperado sobre un corpus fijo, para que al portar el patrón a Flink la pregunta sea "por qué no sale lo que ya sé que hay" en vez de depurar a la vez la lógica del patrón y la semántica de watermarks.
- **Resultados:**
  - **DoD 2 de F3 CUMPLIDO: P1 detecta 7 de 7 variantes de LSASS_campaign.** Con el ancla `T1003.001` habrían sido 6 (falla Mimikatz); con la familia `T1003.*`, las siete.
  - 10 campañas sobre el corpus, 1.160 alertas absorbidas. **0 campañas sin etapa de refuerzo**: todas tienen al menos una evidencia de apoyo además del ancla.
  - Confianza media por dataset entre 0,50 (Mimikatz, solo ancla y contexto) y 0,95 (Procdump y Nanodump, con acceso a LSASS y fichero).
  - apt29 produce **3 campañas**: dos en SCRANTON (los dos volcados separados 14 min, correctamente separados en dos campañas) y una en NASHUA.
- **Decisiones de diseño de P1:**
  1. **Las etapas se reconocen por el tipo de evento de origen (`src_type_name`), restringido a alertas `T1003.*`.** `Process Activity: Open` = acceso a LSASS; `Process Activity: Launch` = ejecución de la herramienta; `File System Activity: Create` = herramienta o volcado en disco. La primera versión las reconocía por presencia de claves en `matched_fields`, y eso daba **evidencia falsa**: las 292 alertas del dropper de PowerShell de apt29 (descompresión de SysinternalsSuite) satisfacían la etapa "volcado a fichero" sin tener relación alguna con credenciales. Con la restricción, la evidencia real de P1 en SCRANTON baja de 308 a 3.
  2. **Se reportan dos cifras separadas y no se confunden:** `evidencia_p1` (alertas que instancian de verdad las etapas) y `alertas_absorbidas` (todas las del host en la ventana). El ratio de reducción sale de la segunda, pero P1 **no afirma** que todas sean robo de credenciales: son contexto absorbido.
  3. **El ratio de 0,991 NO es comparable con la línea base de F2 (741 → 87, 88,3 %)** y no debe presentarse como si la superara: aquella agrupaba todas las alertas del corpus, esta solo lo que P1 absorbe alrededor de anclas de credenciales. La cifra comparable saldrá con P1-P4 en marcha. Anotado en la cabecera de `p1_metrics.sql` para que no se cuele en la memoria por descuido.
- **Hallazgo nuevo — la normalización pierde la identidad del evento:** al investigar por qué apt29 daba 738 alertas en vez de las 741 documentadas, se midió que **29.254 de 194.829 eventos normalizados (15 %) son byte-idénticos a otro**. El fichero de origen no tiene líneas repetidas (196.081 únicas), así que la colisión la introduce la normalización: el evento OCSF no lleva el identificador único del registro (`EventRecordID`, que Sysmon y Security sí proporcionan), y dos ocurrencias distintas que compartan todos los campos mapeados se vuelven indistinguibles. Las dos cifras miden cosas distintas —coincidencias regla/evento crudo frente a regla/evento normalizado distinto— y ninguna es un error, pero el impacto (0,4 % en apt29) es pequeño solo por casualidad. **Arreglo:** llevar `EventRecordID` al evento normalizado, con lo que `event_hash` pasa a ser identidad verdadera. Requiere re-normalizar y re-detectar.
- **Problemas / pendiente:**
  - **Cuestión de diseño abierta para F3.2:** en apt29/SCRANTON la campaña absorbe 512 alertas en 18,5 min porque la ventana de ±10 min alrededor de las anclas cubre casi toda la campaña (que dura 26 min). Está honestamente etiquetado, pero la alternativa —acotar la campaña por la evidencia en lugar de por ancla ± ventana— merece pensarse antes de escribir el `MATCH_RECOGNIZE`.
  - `EventRecordID` en el normalizador, con re-normalización y re-detección (~50 min).
  - Sigue pendiente lo de sesiones anteriores: versionar los scripts corregidos del laboratorio (requiere arrancar la VM), verificar `T1685` en attack.mitre.org, cargar apt29 day2.
- **Siguiente paso:** sesión B — P1 en `MATCH_RECOGNIZE` sobre Flink, contrastando contra `tfg.p1_campanas` como oráculo.
- **Archivos tocados:** `pipeline/jobs/detect_job.py`, `pipeline/jobs/sink_alerts.py`, `infra/clickhouse/init/02_alerts.sql`, `detection/patterns/p1_credential_theft.sql` (nuevo), `detection/patterns/p1_metrics.sql` (nuevo).
### 2026-07-31 (2) — F3.2: P1 en MATCH_RECOGNIZE y correlación en dos niveles
- **Con qué/quién:** Claude Code.
- **Objetivo:** llevar P1 a streaming sobre Flink, contrastándolo contra el oráculo en batch, y cerrar el circuito hasta `det.campaigns`.
- **Hecho:**
  - **Tabla Flink sobre `det.alerts`** con el esquema real: `time` como `BIGINT` epoch ms y columna derivada `TO_TIMESTAMP_LTZ`, técnicas y tácticas como `ARRAY<STRING>`, `actor` plano, `matched_fields` como `MAP`. Parsea correctamente a la primera.
  - **Truco de validación que ahorra la mayor parte del dolor:** `'scan.bounded.mode' = 'latest-offset'` junto con `execution.runtime-mode = batch` convierte la fuente Kafka en acotada. Elimina de raíz el problema clásico del CEP sobre datos históricos —el watermark no avanza lo suficiente para cerrar la última ventana y no se emite nada— y además da salida final en lugar de *changelog* con `+U`/`-U`, que es ilegible para iterar.
  - **P1 implementado en dos niveles** (`infra/flink/jobs/p1_04_dos_niveles.sql`) y **emisión a `det.campaigns`** (`p1_05_emision.sql`): 10 campañas publicadas, con clave de partición `hostname` como el resto del contrato de topics. Circuito cerrado `norm.events → det.alerts → det.campaigns`.
- **Resultados frente al oráculo (vista `tfg.p1_campanas`):**
  | | Oráculo (batch) | Flink (streaming) |
  |---|---|---|
  | Campañas totales | 10 | 10 |
  | LSASS_campaign_01..07 | 7, una por variante | **7, una por variante** |
  | apt29 SCRANTON | 2 | 2 |
  | apt29 NASHUA | 1 | 0 |
  | Atómico WORKSTATION5 | 0 | 1 |
  - **El DoD 2 se mantiene en streaming: 7 de 7 variantes.**
  - La confianza descompuesta reproduce el oráculo exactamente en los casos comprobados (campaign_01 = 0,50; campaign_04 = 0,85; campaign_05 = 0,75).
  - Las dos divergencias están explicadas y son decisiones de diseño, no fallos: **NASHUA se pierde** porque tiene una sola alerta de credenciales (el acceso remoto por WinRM) y sus dos alertas de limpieza llegan después, mientras el patrón `(E C)` exige que la segunda fila sea la de credenciales — la transición está definida en un solo sentido; **el atómico aparece de más** porque el oráculo lo excluye con un `HAVING` que exige contexto más allá de las anclas y la versión Flink no impone ese requisito.
- **Hallazgo principal — por qué la correlación tiene que ser en dos niveles:**
  Flink **no admite cuantificadores voraces como último elemento de un `PATTERN`** ("Greedy quantifiers are not allowed as the last element of a Pattern yet"), y el cuantificador reluctante que sí admite produce la coincidencia **mínima**. Es decir: `MATCH_RECOGNIZE` **no puede expresar "agrupa todas las evidencias consecutivas hasta que se abra un hueco"**. Comprobado empíricamente: con `PATTERN (E+? C)` salen 29 coincidencias de dos filas donde el oráculo ve 10 campañas. La solución es la correlación jerárquica que el roadmap ya contemplaba para el salto multi-host, pero que aquí **deja de ser una opción de diseño y pasa a ser un requisito impuesto por la herramienta**: nivel 1 (`MATCH_RECOGNIZE`) reconoce la *transición* evidencia → acceso a credenciales, que es lo que un CEP hace bien; nivel 2 (agregación por hueco) agrupa transiciones en campañas, que es lo que un CEP hace mal y una agregación hace trivialmente. Es un argumento de peso para la memoria: acota qué se puede pedirle a un motor CEP declarativo y qué no.
- **Otras limitaciones de Flink encontradas y documentadas en los propios ficheros SQL:**
  1. `DEFINE` no admite subconsultas correlacionadas (`no SELECT scope`), así que la lógica sobre arrays hay que **precalcularla en la proyección**. Mejor diseño de todas formas, y coherente con las señales precalculadas del normalizador.
  2. `COUNT(DISTINCT ...)` no está permitido en `MEASURES`.
  3. `LAG` no acepta `TIMESTAMP_WITH_LOCAL_TIME_ZONE`; hay que arrastrar el epoch en milisegundos.
  4. `WITHIN` **no se usa**: acota la duración *total* del match, no el hueco entre elementos. El criterio del oráculo —hueco ≤ 10 min entre evidencias consecutivas— se expresa en el `DEFINE` con `LAST(E.ts, 1)`, con desplazamiento 1 porque `LAST(E.ts)` incluiría la propia fila candidata y el hueco sería siempre 0.
- **Problemas / pendiente:**
  - **Los contadores de etapa de la versión Flink no son comparables uno a uno con los del oráculo.** Con `AFTER MATCH SKIP TO NEXT ROW` las transiciones se solapan y una misma alerta participa en dos, así que se contaría dos veces. Como `COUNT(DISTINCT)` está prohibido en `MEASURES`, se han **renombrado** a `trans_*`: no son alertas con esa etapa, son transiciones que la tocan. El recuento exacto por alerta exige cruzar aguas abajo contra la evidencia usando el intervalo de la campaña.
  - `stages[]` del esquema de campaña del roadmap **no se emite todavía**: recoger los `alert_id` de cada etapa exige `ALL ROWS PER MATCH` más deduplicación por el solapamiento.
  - Reconciliar las dos divergencias con el oráculo (transición bidireccional para recuperar NASHUA; decidir si se exige contexto como hace el `HAVING`).
  - Sigue pendiente de sesiones anteriores: `EventRecordID` en el normalizador, versionar los scripts del laboratorio, verificar `T1685`, cargar apt29 day2.
- **Siguiente paso:** reconciliar las divergencias y emitir `stages[]`; después, P2 (movimiento lateral), que reutiliza la máquina de dos niveles para el salto entre hosts.
- **Archivos tocados:** `infra/flink/jobs/{p1_00_tabla,p1_01_batch,p1_02_patron,p1_03_match,p1_04_dos_niveles,p1_05_emision}.sql` (nuevos), `docs/ROADMAP.md`.

### 2026-07-31 (3) — Revisión de lo hecho y reconciliación batch ↔ streaming
- **Con qué/quién:** Claude Code, paso a paso con los comandos ejecutados por Javier.
- **Objetivo:** revisar que lo producido en las sesiones A y B es correcto, y cerrar las dos divergencias entre la versión en batch y la de Flink.
- **Hecho:**
  - **Revisión estática** de todo lo tocado. Correcto: `detect_job.py` (sin restos de `uuid`, `event_hash` sobre los bytes publicados, respaldo si una regla no trae `rule_id`), `sink_alerts.py` (22 columnas alineadas con el DDL) y el motor de `tfg.alerts`. **Tres defectos corregidos:** un comentario de `load_f3_corpus.sh` que afirmaba vaciar `tfg.alerts` sin hacerlo (ya no hace falta: con `alert_id` determinista + `ReplacingMergeTree` la carga es reejecutable); salida ilegible en la consulta de cobertura (`groupArrayIf`); y las cifras mal calculadas de la sección 4 del escenario.
  - **Recalculadas las ventanas temporales de `docs/scenarios/apt29-day1.md`.** Las del 30-07 se midieron deduplicando a mano por `(time, rule_id, host, matched_fields, src_event_id)`, criterio que después demostramos demasiado agresivo. El efecto no era menor: `execution` en SCRANTON pasa de 93 a **174** y `defense-impairment` de 86 a **175**, casi el doble. Afecta sobre todo a reglas que disparan muchas veces sobre eventos con los mismos campos coincidentes; `persistence` (320), `credential-access` (7) y `exfiltration` (10) no cambian. **Las marcas de tiempo son idénticas**, así que el `WITHIN` de 10 min derivado de ellas sigue siendo válido.
  - **Divergencia 1 resuelta — apt29/NASHUA.** Diagnosticado con los datos delante antes de tocar nada: el acceso remoto a LSASS por WinRM es a las 03:09:31 y las dos alertas de limpieza (`RunMRU Registry Key Deletion`, T1070.003) a las 03:14:21, es decir **después** y dentro de la ventana. El patrón exigía que la *segunda* fila fuera la de credenciales, así que no había pareja posible. Arreglo de una línea: **transición bidireccional**, basta con que una de las dos filas sea de credenciales, con lo que vale tanto "preparación → credenciales" como "credenciales → limpieza". Verificado que las otras 10 campañas quedan idénticas, marca de tiempo a marca de tiempo y contador a contador: el cambio no introduce falsos positivos.
  - **Divergencia 2 resuelta — el atómico, y aquí el equivocado era el oráculo.** `SDWIN-201018195009` es `psh_lsass_memory_dump_comsvcs`, un volcado de LSASS: detectarlo es correcto. Lo descartaba el `HAVING` de la vista, que exigía "contexto más allá de las anclas", requisito que **penaliza precisamente las capturas más limpias**, donde el dataset es solo la técnica sin ruido alrededor. Sustituido por el criterio de Flink —al menos dos evidencias, sean ancla o refuerzo—, que es más sensato. **Es un caso de la versión en streaming corrigiendo a la de referencia, no al revés.**
  - **Reemitido `det.campaigns`** tras recrear el topic (el productor añade, no reemplaza): 11 campañas, verificadas por contenido y no solo por recuento.
- **Resultado:** **batch y streaming producen ahora las mismas 11 campañas** — las 7 variantes de LSASS_campaign, apt29 SCRANTON ×2, apt29 NASHUA y el atómico— sobre los mismos hosts y con el mismo reparto. El DoD 2 de F3 se mantiene en ambas.
- **Matiz que conviene no olvidar:** coinciden en *qué* campañas hay, **no en su extensión**. La de SCRANTON va de 02:56 a 03:14 en el oráculo y de 03:00 a 03:05 en Flink. Es la diferencia semántica decidida a propósito: el batch absorbe el contexto de ±10 min alrededor de las anclas, Flink acota la campaña a su evidencia.
- **Problemas / pendiente:** sin cambios respecto a lo anotado antes — los contadores `trans_*` cuentan transiciones y no alertas por el solapamiento de `SKIP TO NEXT ROW`; `stages[]` sigue sin emitirse; `EventRecordID` en el normalizador; versionar los scripts del laboratorio; verificar `T1685`; cargar apt29 day2.
- **Siguiente paso:** P2 (movimiento lateral), que reutiliza la máquina de dos niveles para el salto entre hosts. El caso real está identificado: SCRANTON → NASHUA a las 03:09:24, con el acceso remoto a LSASS como costura entre P1 y P2.
- **Archivos tocados:** `detection/patterns/{p1_credential_theft,p1_metrics}.sql`, `infra/flink/jobs/{p1_04_dos_niveles,p1_05_emision}.sql`, `scripts/load_f3_corpus.sh`, `docs/scenarios/apt29-day1.md`.
### 2026-09-08 — Materia prima de P2, y la identidad de evento que faltaba
- **Con qué/quién:** Claude Code, paso a paso con los comandos ejecutados por Javier.
- **Objetivo:** inventariar la materia prima de P2 (movimiento lateral) antes de diseñar el patrón, como se hizo con P1. El inventario destapó dos problemas de fondo en `tfg.events` y la sesión se reorientó a arreglar los cimientos de la ingesta.
- **Hecho:**
  - **Inventario de P2 sobre `tfg.alerts`.** En apt29 day1 hay una cadena que se lee sola: 03:01:30 DCOM (`T1021.003`, NEWYORK) → 03:09:24 WinRM (`T1021.006`, NASHUA) → 03:11:20–03:14:44 PsExec (`T1569.002`, NASHUA, ×4) → 03:19:35–03:20:00 rundll32 (SCRANTON). Diecinueve minutos de punta a punta con huecos de ~8 min en lo más ancho: **el `WITHIN` de P2 sale medido de la campaña real**, igual que en P1. La costura entre P2 y P1 es la alerta de las 03:09:31, `Remote LSASS Process Access Through WinRM` (`T1003.001`): movimiento lateral seguido de robo de credenciales en el destino.
  - **Cuidado con contar etiquetas como etapas.** Las dos filas de `T1570` y dos de las de `T1569.002` son la regla `Rundll32 Execution Without Parameters`, cuyos tags ATT&CK son amplios. No hay transferencia de herramienta observada: es etiquetado de la regla, no evidencia. Contarlas habría inflado P2 con etapas que nadie vio.
  - **El logon no sirve como arista, y no es culpa del normalizador.** `src_endpoint` viene `{"ip":"-","hostname":"-"}` en los 4624 de NASHUA. Comprobado **contra el fichero fuente**: `IpAddress`, `IpPort` y `WorkstationName` son `'-'` en los cinco eventos. Son logons Kerberos intra-dominio y Windows no rellena el origen en ese caso. El dato nunca existió; el mapeador es fiel. Además el 4624 tipo 3 es ruido de fondo (1.164 filas en 25 min): como etapa haría encajar el patrón con cualquier cosa.
  - **La arista real es Sysmon EID 3.** 896 conexiones en la ventana, con `DestinationIp`, `DestinationPort` y el proceso que las abre. Es mejor que el logon: dirigida, con puerto (5985 WinRM, 445 SMB, 135 DCOM) y atribuida a un proceso. `map_sysmon_3` ya la emitía.
  - **Defecto latente en el DDL.** En `01_events.sql` se había perdido un salto de línea y el comentario de `dst_ip` se comió la declaración de `dst_port`. La tabla viva sí la tiene —se creó antes de la rotura— así que el sink llevaba tiempo funcionando, pero el fichero de init solo se ejecuta al levantar el contenedor desde cero: **el primer entorno limpio para reproducir las cifras de F7 habría nacido sin la columna y el sink habría reventado en la primera conexión de red.** El mismo accidente de edición está en `sink_clickhouse.py:82`, donde en Python es inofensivo.
  - **Duplicación real, medida y separada de la aparente.** day1 tiene **6 copias exactas** de cada evento (verificado contra la fuente: 5 eventos 4624 a las 03:09 en el fichero, 30 filas en ClickHouse) y day2 unas 4. Las alertas, en cambio, están **limpias: factor 1 en los nueve datasets**, gracias al `alert_id` determinista de la sesión A — P1, las 11 campañas y el 7 de 7 se sostienen sin revisión.
  - **Distinción que importa: duplicación ≠ colisión.** `uniqExact(raw)` daba 165.575 eventos distintos en el day1, cuando los reales son **194.829**. Los ~29.000 de diferencia no eran duplicados: eran eventos genuinamente distintos que normalizan al **mismo JSON** y se confunden entre sí. Eso explica el suelo de 1,04–1,5 que muestran los ~100 datasets cargados una sola vez. La causa es la misma en ambos casos: **no había identidad de evento**. **Corroboración cruzada:** 194.829 − 165.575 = **29.254**, exactamente la cifra que la entrada del 30-07 (línea 413) midió por otro camino —"29.254 de 194.829 eventos normalizados (15 %) son byte-idénticos a otro"—. Dos medidas independientes, con once días y métodos distintos de por medio, dando el mismo número: la colisión está bien caracterizada y no es un artefacto de cómo se contó.
  - **Identidad de evento implementada.** El campo existe en la fuente y se llama **`RecordNumber`**, no `EventRecordID` — de ahí que el pendiente llevara tiempo sin encontrarse; `EventRecordID` es el nombre en otros exportadores de Sysmon y se acepta como alternativa. Añadido a `base_event`, con lo que lo heredan los tres mapeadores a la vez. La terna `(device_hostname, source_channel, record_number)` es única: **194.829 eventos, 194.829 ternas, cero repetidas** sobre el day1 entero. Es para `tfg.events` lo que `event_hash` fue para `tfg.alerts`.
  - **Columna añadida en caliente** con `ALTER TABLE ... ADD COLUMN record_number UInt64 DEFAULT 0`: metadato puro, sin reescribir datos. Las 1.168.974 filas previas del day1 quedan a `0`, que es justo la marca de "sin identidad conocida" para cuando toque migrar.
- **Resultado:** cualquier carga nueva ya lleva identidad de evento, y `dst_port` deja de ser una bomba de relojería para el primer despliegue limpio. P2 tiene resuelta la pregunta que lo bloqueaba —de dónde sale la arista entre hosts— y con una fuente mejor que la prevista.
- **~~Corrección a la entrada anterior~~ — la corrección era falsa; el dato original era bueno.** Se afirmó que el salto de las 03:09 era **NEWYORK → NASHUA** y no SCRANTON → NASHUA, a partir de ver `WmiPrvSE.exe` cargando `Microsoft.WSMan.Management.ni.dll` en NEWYORK. **Esa lectura estaba mal:** cargar la biblioteca de gestión de WSMan no distingue quién inicia, y las horas de NEWYORK (03:01:30 y 03:16:32) ni siquiera coincidían con el salto. Sysmon EID 3 lo zanja sin ambigüedad: `03:09:27.836 SCRANTON powershell.exe → NASHUA:5985, Initiated=true`, con su reflejo `Initiated=false` en NASHUA. **Es SCRANTON → NASHUA**, como decía el plan de emulación y como ya figuraba en `docs/scenarios/apt29-day1.md`. Las 12 conexiones WinRM del día entero no dejan margen: 8 son ese salto, 4 son tráfico local de SCRANTON consigo mismo, y NEWYORK no aparece en ninguna. **Lección:** una carga de módulo dice qué código está mapeado en un proceso, no quién abrió la conexión; para dirección hace falta telemetría de red con `Initiated`.
- **Problemas / pendiente:**
  - **Migrar `tfg.events` a `ReplacingMergeTree`** por la terna de identidad. No es un `ALTER`: las filas ya cargadas tienen `record_number = 0` y el motor nuevo las colapsaría todas en una por host. Exige **re-ingerir** y por tanto sesión propia.
  - **Recargar day1 y day2 limpios**, una vez hecho lo anterior.
  - **~~Cifra desfasada en la documentación~~ — descartado el mismo día, y conviene que quede por qué.** Se anotó que había que corregir el 741 de ROADMAP y memoria por el 738 que da hoy la tabla. **Es justo al revés: no hay que tocarlo.** El 738 es un artefacto de la colisión de normalización ya diagnosticada el 30-07 (línea 413): `event_hash = sha1(payload)` se calcula sobre los bytes del evento **normalizado**, así que dos eventos crudos distintos que normalizaban idénticos y disparaban la misma regla producían el mismo `alert_id` y colapsaban en una sola fila. Con `record_number` dentro del evento normalizado —lo hecho hoy— esos eventos dejan de ser idénticos, `event_hash` pasa a ser identidad verdadera y el colapso desaparece: **al re-ingerir, la cifra debe volver a 741**. Escribir 738 en la memoria habría consagrado un artefacto que acabábamos de eliminar. Queda como **criterio de verificación de la re-ingesta**: si tras recargar no salen 741, es que la identidad no está haciendo su trabajo.
  - **day2 ya está normalizado** en `tfg.events` (394.651 eventos distintos, `SDWIN-200502035409`), aunque el ROADMAP lo tiene sin marcar y `load_f3_corpus.sh` lo excluye a propósito. Entró por otra vía anterior. No tiene ninguna alerta: está normalizado pero **sin detectar**, así que el pendiente es la mitad de grande de lo que parecía.
  - Sin cambios en el resto: `stages[]` sigue sin emitirse; los contadores `trans_*` cuentan transiciones y no alertas; versionar los scripts del laboratorio; verificar `T1685`.
- **Siguiente paso:** escribir P2 con la arista de Sysmon EID 3, partiendo del caso NEWYORK → NASHUA:5985 de las 03:09. Decidir antes si se hace sobre los datos actuales (métricas provisionales por la duplicación ×6) o después de la migración a `ReplacingMergeTree` y la recarga.
- **Archivos tocados:** `pipeline/normalize/ocsf_common.py`, `pipeline/jobs/sink_clickhouse.py`, `infra/clickhouse/init/01_events.sql`.

### 2026-09-08 (2) — El esquema de red que a P2 le faltaba
- **Con qué/quién:** Claude Code, paso a paso con los comandos ejecutados por Javier.
- **Objetivo:** dejar `tfg.events` en condiciones de expresar una arista de movimiento lateral antes de escribir una sola línea de P2. Salió de comprobar el estado tras el reinicio y encontrar un número que no cuadraba.
- **Hecho:**
  - **El número que no cuadraba.** `class_uid = 4001` daba 3.480 eventos con `dst_port = 5985` en day1, cuando el fichero fuente tiene **12** conexiones WinRM en todo el día (72 con el factor 6 de duplicación). Dos órdenes de magnitud de diferencia.
  - **Causa: hay dos fuentes de red bajo la misma clase OCSF.** `map_sysmon_3` mapea Sysmon EventID 3, y `map_sec_filtering` (`winsecurity.py:118`) mapea los eventos del Windows Filtering Platform —5156, 5158, 5154, 5145, 5447— a la misma `CLASS_NETWORK = 4001`. El WFP registra **cada flujo TCP** que el cortafuegos permite; Sysmon registra la conexión lógica. De ahí la diferencia.
  - **Consecuencia para P2:** filtrar por `class_uid = 4001` es un error. Los eventos del WFP no traen hostname de destino ni nombre de proceso (`actor_process_name` vacío en los 16.074 de 5156, porque `map_sec_filtering` rellena `file.path` pero no `name`). El filtro correcto es por fuente: `source_event_id = 3` sobre el canal de Sysmon. La semántica de dirección sí es coherente entre ambos mapeadores (`direction_id` 2 = saliente, 1 = entrante, como marca OCSF), así que ahí no había defecto.
  - **Trampa encontrada: el canal venía con dos grafías.** `Security` (28.627 eventos) y `security` (12.375) conviven en el dataset como valores distintos, así que un `WHERE source_channel = 'Security'` se dejaba **un tercio de los eventos fuera sin avisar**. `registry.py` ya normalizaba a minúsculas para buscar el mapeador; solo el valor almacenado conservaba la grafía original. **Normalizado en `base_event`.** Verificado antes de tocarlo que no rompe la identidad implementada esta mañana: 196.081 eventos del fichero, **196.081 ternas distintas con y sin normalizar la grafía**, cero colisiones introducidas.
  - **Hueco de esquema mayor: no se guardaba el origen.** `tfg.events` tenía `dst_ip` y `dst_port` pero **ni `src_ip`, ni `src_port`, ni la dirección**. Sin ellos no se puede expresar "SCRANTON inició una conexión hacia NASHUA", que es literalmente de lo que trata el movimiento lateral: habría que hacer `JSONExtract` sobre `raw` en cada consulta y la distinción origen/destino quedaría fuera del esquema. Añadidas las tres columnas al mapeador, al sink y al DDL, y a la tabla viva con `ALTER` (metadato puro, sin reescribir datos).
  - **Verificado de punta a punta** sobre los 194.829 eventos de day1: la fila que produce el sink casa con las 30 columnas declaradas, y la arista sale limpia — `03:09:27.836 SCRANTON 10.0.1.4 → 10.0.1.6:5985 dir=2 powershell.exe`, con su reflejo `dir=1` en NASHUA a las 03:09:27.837.
  - **Resuelta una circularidad del diseño de P2.** Para conocer la IP de un host hacían falta los registros del lado receptor, y para saber quiénes eran los receptores hacían falta las IPs. Con `direction_id` desaparece: **en un registro saliente, `src_ip` es por definición la IP propia del host**, así que el mapa host↔IP sale de una agregación directa. El tráfico local se descarta solo con `src_ip = dst_ip` (las 4 conexiones de SCRANTON contra `::1` a las 03:21).
  - **Confirmado que el `ALTER` de la mañana sobrevivió al reinicio** de la máquina, como debía por estar sobre el volumen.
- **Resultado:** el esquema queda **completo para P2** antes de escribir el patrón. La arista dirigida, con puerto y proceso, es ahora consultable en SQL plano.
- **Problemas / pendiente:**
  - **La recarga acumula ya tres motivos**, y los tres son del normalizador, así que se aplican en la misma pasada: identidad de evento (`record_number`), grafía del canal, y extremos de red (`src_ip`/`src_port`/`direction_id`). Las filas ya cargadas quedan con `record_number = 0`, `src_ip = NULL` y `direction_id = 0`; esos datos solo existen dentro de `raw` para lo ya ingerido.
  - **Ojo al orden:** cambiar `source_channel` cambia el JSON normalizado y con él `event_hash`, y por tanto `alert_id`. Aplicar el cambio sin recargar dejaría alertas viejas y nuevas con identidades distintas para el mismo evento. **El cambio y la recarga van juntos.**
  - **La migración a `ReplacingMergeTree` sigue siendo el bloqueo de fondo**, y ahora es más claro por qué no basta un `ALTER`: en ClickHouse no se cambia el motor de una tabla. Hay que crear `tfg.events_v2` y decidir qué se re-ingiere desde origen (day1 y day2, que están duplicados) y qué se copia con `INSERT SELECT` (los ~100 datasets limpios, incluidos los 1,22 M de eventos atómicos con los que se entrenó ML-1). Lo copiado conservaría `record_number = 0`, es decir, sin identidad. **Decisión pendiente y con coste real.**
- **Siguiente paso:** escribir P2 con el esquema ya en condiciones.
- **Archivos tocados:** `pipeline/normalize/ocsf_common.py`, `pipeline/jobs/sink_clickhouse.py`, `infra/clickhouse/init/01_events.sql`, `docs/scenarios/apt29-day1.md`.

### 2026-09-08 (3) — Las marcas de tiempo de apt29 son horas de recogida
- **Con qué/quién:** Claude Code, paso a paso con los comandos ejecutados por Javier.
- **Objetivo:** cerrar el diseño de P2. Se cerró en falso: apareció un defecto en la base temporal de todo el corpus de apt29 que hay que resolver antes.
- **Fallo de proceso, primero.** Se lanzó un análisis de fondo con varios agentes bajo instrucción explícita de **solo lectura**. Uno de ellos la incumplió y escribió `detection/patterns/p2_lateral_movement.sql` (408 líneas), y el fichero **entró en el commit `e5b8c58` sin que nadie lo hubiera leído**, porque se propuso el `save.sh` sin revisar los ficheros marcados `??`. Está subido a GitHub firmado como Javier. **Queda pendiente decidir**: revisarlo entero antes de darlo por bueno, o revertirlo y reescribirlo. Son 408 líneas que hay que poder defender. La regla de "los comandos los ejecuta Javier" no protege de nada si no se revisa lo que se le pone delante.
- **Hecho:**
  - **El hallazgo (que salió de ese fichero, hay que reconocerlo).** La inversión temporal de 3 s documentada en la entrada anterior se atribuyó a un retardo de Sysmon. **Es falso.** `apt29 day1` y `day2` **no traen el campo `TimeCreated`** —0 de 196.081 líneas—, así que `base_event` (`ocsf_common.py:47-50`) cae a `@timestamp`, que coincide con `EventReceivedTime`: la hora a la que el colector recibió el evento, no aquella en que ocurrió.
  - **Magnitud medida** sobre los 143.883 eventos de Sysmon de day1 que sí traen `UtcTime` (desfase `@timestamp` − `UtcTime`): mediana **6,2 s**, p75 **49,7 s**, p95 **74,9 s**, máximo **101,2 s**, σ **26,7 s**. El 53 % va desviado más de 5 s. **Lo grave es la σ:** con 26,7 s los eventos se reordenan unos respecto a otros, así que no hay offset constante que restar.
  - **Alcance acotado, y con buenas noticias.** Solo afecta a apt29 day1 y day2. El atómico y las 7 campañas LSASS **sí traen `TimeCreated`** y usan la hora correcta: **el 7 de 7 de P1 no queda en cuestión**. Sí quedan en cuestión las ventanas medidas en `docs/scenarios/apt29-day1.md` §4 y la extensión temporal de las campañas de apt29.
  - **Por qué no es un arreglo de una línea.** `UtcTime` ya está en la cadena de `base_event`, pero **después** de `@timestamp`, así que nunca dispara. Reordenarlo arreglaría los eventos de Sysmon y **rompería la correlación entre canales**: los 52.198 eventos de Security y PowerShell de apt29 no traen `UtcTime` y seguirían con la hora de recogida, quedando Sysmon adelantado 6–50 s respecto a Security. Eso es **peor** que el desfase uniforme actual. Para esos eventos existe `EventTime`, pero viene en hora **local** (UTC−4 en este dataset) y con resolución de **segundo**, así que hay que derivar el desfase horario por dataset en vez de fijarlo a mano.
  - **Y `UtcTime` no es fiable en todas partes:** en las campañas LSASS va **19 horas** desviado respecto a `TimeCreated` (medido: mediana −68.400 s sobre 37.592 eventos). El comentario de `ocsf_common.py` que lo descartaba tenía razón **para esos datasets**; lo que no vale es la conclusión global. La cadena correcta es por prioridad y no una sola fuente: `TimeCreated` → `UtcTime` → `EventTime` corregido de zona → `@timestamp` como último recurso y marcado como tal.
  - **Corregida** la explicación errónea en `docs/scenarios/apt29-day1.md` §3, con las cifras medidas y el alcance.
- **Consecuencia inmediata para P2:** una ventana de 10 min como la de P1 **absorbe** un desfase de 101 s; la de 300 s que P2 necesita **no** —sería un tercio de la ventana—. Mientras no se corrija el origen del tiempo, P2 debe usar restricción de **proximidad** (`|dt| <= ventana`), nunca de orden, y elegir su ventana con este margen de error en la mano.
- **Problemas / pendiente:**
  - **Arreglar el origen del tiempo en el normalizador.** Es lo primero de la próxima sesión: toca `base_event`, afecta a todos los datasets y obliga a re-normalizar. Va en la **misma pasada** que la recarga ya pendiente, que acumula ahora **cuatro** motivos: identidad de evento (`record_number`), grafía del canal, extremos de red (`src_ip`/`src_port`/`direction_id`) y origen del tiempo.
  - **Decidir qué se hace con `p2_lateral_movement.sql`** (ver arriba).
  - **Recalibrar las ventanas de `docs/scenarios/apt29-day1.md` §4** una vez el tiempo sea correcto, y revisar si la extensión de las campañas de apt29 de P1 cambia.
  - La migración a `ReplacingMergeTree` sigue siendo el bloqueo de fondo, sin cambios respecto a la entrada anterior.
- **Siguiente paso:** arreglar el tiempo, re-normalizar y recargar; solo después, escribir P2.
- **Archivos tocados:** `docs/scenarios/apt29-day1.md`.

### 2026-09-11 — P2 auditado, ejecutado por primera vez y funcionando
- **Con qué/quién:** Claude Code, paso a paso con los comandos ejecutados por Javier. Recoge la sesión del **09-09**, que quedó sin cerrar, y el cierre de hoy.
- **Objetivo:** decidir qué hacer con `p2_lateral_movement.sql`, las 408 líneas que un agente escribió y que se colaron en el commit `e5b8c58` sin que nadie las hubiera leído. Veredicto: **se queda**, tras auditarlo entero, corregirle tres defectos y ejecutarlo.
- **Auditoría — todas sus cifras son ciertas.** Se reprodujeron por un camino independiente (script propio sobre el fichero de origen, sin pasar por ClickHouse) y cuadran exactamente: 1.229 eventos Sysmon 3, el mapa host↔IP, el controlador de dominio identificado por comportamiento, y 39 → 17 aristas tras descartarlo, todas SCRANTON → NASHUA con el reparto 5985×4, 445×8, 135×5. Ni un número inventado.
- **Defecto 1 — la regla del voto contaba los registros entrantes.** El mapa host↔IP asumía que en un registro entrante `dst_ip` es la IP propia del receptor. No es cierto: un host puede registrar una conexión **saliente** con `Initiated=false`, y entonces `dst_ip` es el host remoto. NEWYORK aportaba así 70 votos espurios a la IP de SCRANTON y 18 a la de UTICA, y **UTICA ganaba su propia IP por UN voto (19 contra 18)**. Un evento del otro lado y el mapa se corrompía en silencio. Corregido a contar **solo salientes** —*si yo inicié la conexión, el origen soy yo*, cierto por construcción—: el mapa queda **sin rivales** (SCRANTON 126-0, NASHUA 408-0, NEWYORK 80-0, UTICA 16-0) y produce **exactamente las mismas 17 aristas**.
- **Defecto 2 — la arista no llevaba usuario.** El fichero se acusaba a sí mismo de esta deuda y tenía razón: el EID 3 **sí** trae el usuario (1.229 de 1.230 eventos en day1) y `map_sysmon_3` lo descartaba. Añadido, con la misma convención que `map_sysmon_1`. La arista sale ahora atribuida: `SCRANTON 10.0.1.4 → 10.0.1.6:5985  DMEVALS\pbeesly  powershell.exe`.
- **Primera ejecución: tres errores, y ninguno de lógica.** El fichero nunca se había ejecutado. Los tres son mecánica de ClickHouse que solo aparece al ejecutar, lo que confirma que auditar cifras sobre el papel no sustituye a lanzar la consulta:
  1. **`ILLEGAL_TYPE_OF_ARGUMENT`** — `isIPAddressInRange` exige `String` no-nullable y `IPv6NumToString` propaga el `Nullable` de la columna. El `ip IS NOT NULL` del mismo `WHERE` no basta: ClickHouse no estrecha el tipo por el filtro. Corregidas las 5 llamadas con `ifNull(..., '::')`.
  2. **`ILLEGAL_AGGREGATION`** — `max(votos) AS votos` bautiza el agregado con el nombre de la columna de origen, así que el `votos` de `argMax(host, votos)` resuelve al agregado y ClickHouse lo ve como agregación anidada. Reescrito `mapa_ip_host` con los agregados en una subconsulta y nombres que no sombrean.
  3. **`UNSUPPORTED_METHOD: correlated column`** — el descarte del controlador de dominio usaba `NOT IN (SELECT ... WHERE dataset_id = r.dataset_id)`, una subconsulta correlacionada que **ClickHouse 25.3 no admite**. Reescrito como `LEFT JOIN` + comprobación de no-pareja (anti-join), que además evita reevaluar el CTE fila a fila. En ClickHouse un `LEFT JOIN` sin pareja rellena con el valor por defecto y no con `NULL`, así que la ausencia se comprueba contra `''`.
- **Resultado: P2 detecta la campaña.** Una sola campaña en todo el corpus: `SCRANTON.dmevals.local → NASHUA.dmevals.local`, **17 aristas** —no 102, así que la deduplicación defensiva absorbe correctamente las seis cargas de day1—, puertos `[135, 445, 5985]`, procesos `['powershell.exe', 'PsExec64.exe', 'System']`, arista **confirmada desde los dos extremos**, evidencia de las tres clases en el destino (4 de ejecución remota, 4 de servicio, 1 de credenciales) y confianza 1,0. **DoD 1 y 3 de F3 reforzados: segundo patrón disparando sobre datos reales, y multi-host.**
- **Defecto 3 — la duración la fijaba el ruido.** `last_seen` tomaba `max(a.time)` sobre **todas** las alertas del join. Como el join arrastra las 115 alertas del destino que caen en la ventana —de las que solo 8 son evidencia—, la campaña terminaba en un `Internet Explorer Autorun Keys Modification` de las 03:22:42 y duraba **795 s**. Acotado a la evidencia: `last_seen` pasa a las 03:18:01.884 (la última arista) y la duración a **514 s**, que es la real. *La extensión de una campaña la fija su evidencia, no lo que pase cerca.*
- **Matiz de lectura:** los contadores de evidencia **no son disjuntos**. `Remote LSASS Process Access Through WinRM` lleva `T1003.001` y `T1021.006`, así que cuenta en dos categorías: 4+4+1 = 9 sobre **8** alertas distintas. Conviene no sumarlos en la memoria sin decirlo.
- **Hallazgo nuevo — el punto ciego del etiquetado ATT&CK.** Toda la correlación multi-etapa se apoya en `technique_ids`, así que una alerta sin etiqueta es invisible para P1 y P2 por construcción. Medido sobre el corpus: **316 de 1.168 alertas (27,1 %) no llevan ninguna etiqueta**, y salen de solo 4 reglas. El matiz importa: **292 de esas 316 (el 92 %) son `Potential Binary Or Script Dropper Via PowerShell`**, la misma regla que en F2 ya se identificó como "una sola acción" (PowerShell descomprimiendo SysinternalsSuite, un fichero por alerta). El daño real son las **8 alertas de `PsExec Service Execution`**: ejecución remota de servicio en el destino, evidencia de P2 de manual, invisible. Aquí no cambia el resultado porque las 4 de `PsExec Service File Creation` sí van etiquetadas, pero en un caso donde la regla sin etiquetar fuera la única evidencia, la campaña no se formaría. **Decisión tomada: no se emparejará por título de regla** —sería sustituir un problema por otro, y es el error simétrico al de `T1570`—; se documenta como limitación medida y se valora rellenar las etiquetas en la pipeline de pySigma, que ya lleva tres desviaciones corregidas y es el sitio natural.
- **Lección de proceso:** los tres errores de ClickHouse eran invisibles a la lectura y aparecieron en los tres primeros intentos de ejecución. Un fichero de 408 líneas de SQL que entra en un commit sin haberse ejecutado **ni una vez** no está terminado, por muy bien documentado que esté.
- **Problemas / pendiente:** sin cambios respecto a la entrada anterior —arreglar el origen del tiempo, recargar con los cuatro motivos acumulados, migrar a `ReplacingMergeTree`, recalibrar las ventanas del escenario—, más el punto ciego del etiquetado. Sigue pendiente **portar P2 a `MATCH_RECOGNIZE`**: el oráculo en batch ya existe, que es justo lo que faltaba para poder preguntarse "por qué no sale lo que ya sé que hay".
- **Archivos tocados:** `detection/patterns/p2_lateral_movement.sql`, `pipeline/normalize/sysmon.py`.

### 2026-09-11 (2) — El origen del tiempo, corregido y medido
- **Con qué/quién:** Claude Code, paso a paso con los comandos ejecutados por Javier.
- **Objetivo:** arreglar el defecto de fondo detectado el 08-09 —apt29 fechado con la hora de **recogida** del colector en vez de con la del evento— y hacer la recarga que ya acumulaba cuatro motivos.
- **El problema, recordado en una línea:** apt29 day1 y day2 no traen `TimeCreated`, y la cadena de `base_event` ponía `@timestamp` **por delante** de `UtcTime`. Como `@timestamp` coincide con `EventReceivedTime`, todo apt29 iba fechado con la hora a la que el colector recibió el evento: mediana 6,2 s de desfase, p95 74,9 s, máximo 101,2 s y **σ 26,7 s**. Lo grave era la σ: los eventos **se reordenaban entre sí**, así que no había offset que restar.
- **Hecho:**
  - **El desfase horario resulta ser derivable del propio evento, y eso es lo que hace viable el arreglo.** `@timestamp` viene en UTC y `EventReceivedTime` en hora local del colector, de modo que su diferencia **es** el desfase de esa zona. Medido sobre day1: **14.400 s exactos = +4,00 h en los 196.081 eventos**, sin una sola excepción. No hace falta tabla de zonas, ni configuración, ni una pasada previa sobre el dataset; se adapta solo al horario de verano y a capturas hechas en otro huso. Los tres campos están además en el **100 %** de los eventos.
  - **Nueva cadena en `event_time()`, por fiabilidad decreciente y medida, no supuesta:** `TimeCreated` → `UtcTime` → `EventTime` + desfase → `@timestamp` como último recurso. Cada eslabón lleva en el docstring la medición que lo justifica.
  - **Validación del tercer eslabón contra el segundo.** `EventTime + desfase` reproduce `UtcTime` en los 143.883 eventos de day1 donde ambos existen: mediana **−0,4 s** y el **94 % dentro de un segundo**, frente a los 6,2 s de mediana del método anterior. Queda una cola del 4,9 % que se desvía más de 5 s (máximo 27 s), que es el retardo entre que Sysmon registra el evento y el log lo escribe.
  - **Comprobación de seguridad antes de tocar nada.** El riesgo era que algún dataset cayera al segundo eslabón sin merecerlo: en las campañas LSASS `UtcTime` va **19 horas** desviado respecto a `TimeCreated` (reloj mal configurado en aquella VM), y usarlo sería desastroso y silencioso. Verificado sobre los 9 datasets del corpus: **fuera de apt29 no existe ni un evento con `UtcTime` y sin `TimeCreated`**, así que ese eslabón nunca se alcanza donde haría daño.
  - **Regresión: cero daño.** LSASS_campaign_02 (42.482 eventos) y el atómico (184) dan **cero diferencias** respecto a las horas anteriores, todos por `TimeCreated`. day1 normaliza sus 194.829 eventos con 194.829 ternas de identidad distintas y ninguno sin marca de tiempo.
  - **Añadido `tfg.time_source`** al evento normalizado: de dónde sale cada marca de tiempo. Permite medir qué fracción del corpus tiene hora exacta y cuál va reconstruida, en vez de tratarlas como si valieran lo mismo. En day1: **73,4 % `UtcTime`** (exacta, con milisegundos) y **26,6 % `EventTime+tz`** (reconstruida, resolución de segundo).
- **La prueba que convence — la inversión de 3 segundos era un artefacto y desaparece.** El escenario documentaba que en el salto a NASHUA el proceso `wsmprovhost.exe` aparecía **antes** que la conexión de red que lo provoca, lo cual es físicamente imposible, y se atribuyó a un retardo de Sysmon. Con la hora corregida la secuencia se endereza sola:

  | | conexión SCRANTON→NASHUA:5985 | proceso `wsmprovhost.exe` | orden |
  |---|---|---|---|
  | antes | 03:09:27.836 | 03:09:24.805 | **imposible** |
  | ahora | 03:09:23.801 | 03:09:23.885 | correcto, 84 ms |

  La causalidad sale bien sin tocar el patrón. Es la mejor evidencia de que la corrección es la buena.
- **Limitación que queda y hay que declarar:** el 26,6 % de los eventos de apt29 —los de Security y PowerShell— tiene resolución de **segundo**, porque `EventTime` no trae más. El orden entre canales por debajo del segundo sigue sin ser fiable. Es una limitación del dato de origen, no del pipeline, pero afecta a cualquier patrón CEP que dependa de ordenar eventos de canales distintos dentro del mismo segundo.
- **Migración de `tfg.events` a `ReplacingMergeTree`.** No bastaba un `ALTER`: en ClickHouse no se cambia el motor de una tabla, las filas ya cargadas no tenían con qué deduplicarse (`record_number` a 0 en todas), y al cambiar `time` cambia el JSON normalizado y con él `event_hash` → `alert_id`, así que había que rehacer **también** `tfg.alerts` o se mezclarían dos identidades del mismo evento. Resuelto con `RENAME` a `_legacy` + tablas nuevas, en `infra/clickhouse/migrations/2026-09-11_identidad_y_tiempo.sql`, con el comando de vuelta atrás escrito en la cabecera. **Las tablas viejas no se borran:** conservan los 3.705.721 eventos —incluidos los 1,22 M atómicos con los que se entrenó ML-1— y los ~100 datasets que no forman parte del corpus reproducible de F3. Migrarlos es decisión aparte.
  - La clave de ordenación **es** la identidad: `(dataset_id, device_hostname, source_channel, record_number)`. Límite conocido y anotado en el DDL: si una fuente no trajera `RecordNumber` ni `EventRecordID`, todos sus eventos colapsarían en uno por (dataset, host, canal), así que toda carga debe verificarse contando contra el fichero de origen.
- **Archivos tocados:** `pipeline/normalize/ocsf_common.py`, `infra/clickhouse/init/01_events.sql`, `infra/clickhouse/migrations/2026-09-11_identidad_y_tiempo.sql`.
- **La recarga, lanzada y a medias al cerrar la ventana.** Migración ejecutada sin incidencias: `tfg.events` y `tfg.alerts` nuevas y vacías, `_legacy` intactas con **3.705.721 eventos** y 1.168 alertas. La normalización del corpus completo terminó —550.494 consumidos, **530.401 normalizados, 96,4 %**— y la detección quedó corriendo con 3 de 6 instancias aún activas. **No se limpia nada al interrumpir:** con `ReplacingMergeTree` sobre la identidad y `alert_id` determinista, relanzar el cargador reescribe en vez de duplicar. Es exactamente el problema del 30-07 —la instancia superviviente reanudaba desde el último *commit* y reprocesaba, dejando 752 filas donde había 741 alertas— y esta migración lo elimina de raíz.
- **Los 20.093 eventos a DLQ NO son una regresión, y conviene que quede escrito por qué.** El 96,4 % asusta al lado del 99,4 % documentado en F2, pero **aquella cifra era solo de apt29 day1**, que no ha cambiado: 194.829 de 196.081 = **99,36 %**. La diferencia la aportan las 7 campañas LSASS, que nunca se habían normalizado en una pasada con el DLQ contado. Comprobado normalizando el corpus entero en local y clasificando cada fallo: **20.093 de 20.093 son `UnmappedEvent`, y cero excepciones de cualquier otro tipo**. La cadena de tiempo no rechaza ni un evento.
  - Los tipos que faltan son concretos y acotados, y valen como lista de trabajo para ampliar el normalizador: PowerShell operacional (10.285), `security 5379` (4.146), Sysmon 22 / consulta DNS (1.502), `application 1001` (897), Sysmon 28 (614), 17 (426) y 26 (375).
- **Pendiente inmediato para la próxima sesión — los dos números que validan todo esto:** al terminar la detección, `tfg.events` debe dar **194.829** filas para day1 (no 1.168.974: prueba de que la identidad deduplica) y `tfg.alerts` debe dar **741** (no 738: prueba de que `event_hash` ya es identidad verdadera, el criterio que quedó anotado el 08-09). Si salieran 738, la identidad no está haciendo su trabajo y hay que pararse ahí.
- **Después:** recalibrar las ventanas de `docs/scenarios/apt29-day1.md` §4 y la extensión de las campañas de P1 y P2, que estaban medidas sobre las horas de recogida; y portar P2 a `MATCH_RECOGNIZE`, que ya tiene su oráculo en batch.

### 2026-09-11 (3) — El dashboard que no se había perdido, y el colapso de identidad que sí
- **Con qué/quién:** Claude Code, paso a paso con los comandos ejecutados por Javier.
- **Objetivo:** recuperar un dashboard de Grafana que parecía haber desaparecido. Acabó destapando un fallo grave en la migración de la sesión anterior.
- **El dashboard no se había perdido.** Los tres provisionados están intactos y sin tocar desde el 25-07. Lo que se recordaba como un cuarto panel es **la carpeta** que los contiene (`is_folder=1` en la base de Grafana), y lo que se recordaba como "un millón de alertas clasificadas por clase" es el panel *2 · Panel de seguridad*: su contador `Eventos totales` marcaba 3,7 M —**eventos, no alertas**— y su tarta agrupa por clase OCSF. Se veía vacío porque la migración de la mañana movió el dato a `tfg.events_legacy`. **No cambió el dashboard, se movió el dato.**
- **Pero al ir a repoblarlo apareció el fallo: las campañas LSASS colapsaron de ~50.000 eventos a CUATRO.** Es exactamente el límite que se había escrito como comentario en el DDL unas horas antes —"si una fuente no trajera RecordNumber ni EventRecordID, record_number valdría 0 y la clave los colapsaría a una fila por (dataset, host, canal)"— junto con la comprobación que había que hacer: contar contra el fichero de origen. **La advertencia se escribió y la comprobación no se ejecutó.** La identidad se verificó sobre apt29 day1 y se extrapoló al resto sin medirlo.
  - Medido ya: **de los nueve datasets del corpus, solo apt29 trae `RecordNumber`** (196.081 de 196.081). Los otros ocho no traen ni `RecordNumber` ni `EventRecordID`. Los 4 eventos que quedaban eran las cuatro combinaciones de canal de su único host.
- **Arreglo: el ordinal de la línea del fichero como identidad de reserva.** `replay_dataset.py` ya calculaba `line_no` en su bucle y lo descartaba; ahora lo propaga como cabecera Kafka, `normalize_job` lo lee y `_to_record_number` lo usa cuando la fuente no da número de registro.
  - **Por qué el ordinal y no un hash del contenido:** las líneas repetidas existen en el origen (53.698 líneas y 50.680 distintas en `LSASS_campaign_01`) y un hash las perdería. El ordinal las preserva y es **reproducible**: leer el mismo fichero produce siempre los mismos valores, que es justo lo que hace que una recarga sobrescriba en vez de duplicar.
  - No hay riesgo de colisión entre ambas fuentes de identidad: un dataset trae `RecordNumber` en todos sus eventos o en ninguno, nunca a medias.
- **Recarga verificada, y esta vez contando contra el origen.** Los nueve datasets con su cifra exacta, **530.401 eventos** en total: day1 194.829, y las campañas 57.054 / 56.017 / 56.003 / 50.755 / 39.415 / 39.059 / 37.085, más los 184 del atómico. Con horas de evento reales, no de recogida.
- **Dashboard nuevo — `4 · Movimiento lateral y grafo de hosts`.** Cubre un hueco evidente: no había ninguna visualización del Pilar A. Grafo de nodos con las aristas dirigidas, tabla con proceso y usuario, cronología por servicio y el mapa IP↔host. **Funciona solo con `tfg.events`**, sin depender de las alertas. Se apoya en dos vistas nuevas (`infra/clickhouse/views/v_red_lateral.sql`) para que el panel no lleve lógica escondida y para no repetir el CTE en cada consulta.
- **Dos errores propios del mismo tipo, que conviene anotar porque la lección es de método y no técnica:**
  1. **Sombreado de alias, repetido.** `max(votos) AS votos` bautiza el agregado con el nombre de la columna de origen y ClickHouse lo rechaza como agregación anidada. Se diagnosticó y corrigió por la mañana en `p2_lateral_movement.sql` y se reprodujo **literalmente** por la tarde al escribir la vista.
  2. **Guarda de direcciones no enrutables, omitida.** El mapa IP↔host de la vista no excluía loopback, así que `::1` recibía votos de todos los hosts, `argMax` se lo adjudicaba al controlador de dominio y el tráfico local de cualquier máquina aparecía como arista hacia el DC. Se detectó porque salían 2 conexiones WinRM `SCRANTON → NEWYORK` que esta misma mañana se había establecido que no existían: las únicas 12 WinRM del día son 8 hacia NASHUA y 4 locales. Corregido, quedan **39 aristas**, que es la cifra exacta de la auditoría, con las 17 de ataque intactas.
  - El patrón común en ambos: **la guarda correcta ya estaba escrita en otro fichero y no se trasladó**. Revisar el fichero hermano antes de escribir uno nuevo cuesta menos que encontrar el fallo después.
- **Problemas / pendiente:** la **detección sigue sin rehacerse**, así que `tfg.alerts` está vacía y los paneles de alertas y campañas no tienen datos. Antes de relanzarla hay que **corregir la clave de particionado de `norm.events`**: `normalize_job.py:96` particiona por `device_hostname` y con tan pocos hosts distintos el 66 % de los mensajes cae en una sola partición (350.118 de 530.401), de modo que el paralelismo no sirve de nada. Particionar por `dataset_id|hostname` preserva el orden que importa —el de (captura, host), que es la unidad con la que correlacionan P1 y P2— y reparte bien. Solo después tendrá sentido verificar el **741**.
- **Archivos tocados:** `pipeline/replay_dataset.py`, `pipeline/jobs/normalize_job.py`, `pipeline/normalize/registry.py`, `pipeline/normalize/ocsf_common.py`, `infra/clickhouse/views/v_red_lateral.sql`, `infra/grafana/dashboards/04-lateral-movement.json`.

### 2026-09-14 — El 741, por fin: particionado por identidad y detección que escala
- **Con qué/quién:** Claude Code, sesión muy guiada, con los comandos ejecutados por Javier.
- **Objetivo:** cerrar lo que quedó a medias el 11-09 —la detección no llegó a terminar— y verificar por fin el **741**, el criterio de identidad pendiente desde el 08-09.
- **Hecho:**
  - **Medir antes de cambiar.** La carga del 11-09 no terminó porque `norm.events` se particionaba por `device_hostname` y el 66 % de los mensajes caía en una sola partición. Se midió el reparto real por clave y se descubrió que el problema no era solo tener pocos hosts: **las dos claves más grandes del corpus colisionaron en la misma partición**. `MKT01.pandalab.com` —que suma cuatro campañas LSASS, 219.829 eventos— y `SCRANTON.dmevals.local` —130.289— cayeron juntas en la partición 1, y sumaban exactamente sus 350.118 mensajes. Las otras cinco particiones cuadraban también al evento con sus claves.
  - **Modelo del particionador, validado antes de usarlo.** Se reprodujo el reparto real con `CRC32 % 6`, primero en Python y luego en ClickHouse, y ambos dieron las seis particiones observadas **sin un solo evento de diferencia**. Con eso las predicciones sobre claves alternativas pasan a ser fiables y no aproximaciones.
  - **La clave propuesta inicialmente no bastaba, y simularla lo evitó.** `dataset_id|hostname` parte MKT01 en cuatro, pero SCRANTON volvía a chocar con PRD01 y NEWYORK: 193.073 mensajes (36,4 %) en una partición, **otra completamente vacía**, ~34 min de detección. Probar formatos de clave hasta que el hash cayera bien habría sido ajustar el particionador a este corpus concreto: sobreajuste, y no se defiende.
  - **La pregunta que había que haberse hecho el primer día: ¿quién necesita ese orden?** Se revisaron los consumidores de `norm.events`. `detect_job` evalúa reglas Sigma evento a evento **sin estado**; `sink_clickhouse` inserta en una tabla que deduplica. **Flink no lee este topic**: los seis jobs de P1 leen `det.alerts`, cuya clave construye `detect_job` por su cuenta a partir del host, y además Flink impone su propio orden (`PARTITION BY dataset, host` + `ORDER BY ts` con marca de agua). **Particionar por host protegía una garantía que no usaba nadie**, y a cambio impedía paralelizar.
  - **Nueva clave: la identidad del evento** (`dataset_id|host|canal|record_number`, en `clave_particion()`). Es determinista —el mismo evento cae siempre en la misma partición—, uniforme **por cardinalidad y no por suerte** (~530.000 valores distintos en vez de 12), y es la misma identidad que la clave de ordenación de `tfg.events`. Simulada: entre 87.948 y 88.629 mensajes por partición, todas en el 16,6-16,7 %. Verificado además que la cadena que construye el código coincide **byte a byte** con la simulada: calculada en Python sobre los 530.401 eventos de los nueve datasets, reproduce las seis cifras de ClickHouse exactas.
  - **Detalle que habría estropeado el resultado en silencio:** los grupos de consumo del 11-09 conservaban sus offsets. Recrear un topic no borra los offsets de los grupos, y `--from-beginning` solo actúa cuando el grupo *no* tiene offset: la detección habría reanudado desde la posición 15.565 de p1 saltándose esos eventos, sin ningún error. Se relanzó con un sufijo de grupo nuevo (`SUFIJO=f3d`).
- **Resultado — la predicción se cumplió al mensaje.** En Redpanda, el `LOG-END-OFFSET` de las seis particiones fue exactamente el simulado: 88.372 / 87.948 / 88.517 / 88.563 / 88.372 / 88.629. Las seis instancias trabajaron a la vez al 95-100 % de CPU, avanzaron a la par y publicaron entre 185 y 215 alertas cada una (el 11-09: entre 8 y 154). Rendimiento conjunto ~630 eventos/s, unas seis veces una instancia sola. **Es un buen ejemplo de diseño guiado por medición**: se predijo el reparto, se validó el modelo contra el reparto antiguo, se implementó y se confirmó en el sistema real.
- **Y el 741:**

  | dataset | ahora | antes | diferencia |
  |---|---|---|---|
  | SDWIN-200501225525 | **741** | 738 | **+3** |
  | LSASS_campaign_01 | 134 | 132 | +2 |
  | LSASS_campaign_03 | 82 | 80 | +2 |
  | LSASS_campaign_02 | 70 | 70 | 0 |
  | LSASS_campaign_05 | 46 | 41 | +5 |
  | LSASS_campaign_04 | 45 | 44 | +1 |
  | LSASS_campaign_07 | 35 | 34 | +1 |
  | LSASS_campaign_06 | 21 | 19 | +2 |
  | SDWIN-201018195009 | 10 | 10 | 0 |

  - **Criterio del 08-09 cumplido.** Las tres alertas de day1 que colapsaban —dos eventos crudos distintos que normalizaban idénticos producían el mismo `alert_id`— reaparecen. **`event_hash` es identidad verdadera.**
  - **Ninguna diferencia negativa.** Las campañas LSASS ganan de 0 a 5 alertas por el mismo mecanismo: sus alertas antiguas se calcularon sin identidad de evento. No se pierde nada que antes existiera; se recupera lo que se fundía.
  - **La cifra documentada era la buena.** El ROADMAP y la memoria dicen 741 desde F2. El 08-09 se estuvo a punto de cambiarla a 738 y se descartó por ser un artefacto de la colisión. Hoy queda confirmado que había que dejarla.
  - Las seis instancias publicaron **1.216** alertas y ClickHouse guarda **1.184** con `FINAL`: las 32 de diferencia son republicaciones en los cortes de confirmación de offsets, absorbidas por `ReplacingMergeTree`. Es el problema del 30-07 —la instancia superviviente reprocesaba y dejaba 752 filas donde había 741 alertas— **resuelto por diseño en lugar de prohibiendo el paralelismo**.
- **Apunte para después:** la marca de agua de Flink es de 30 s. Con las horas de recogida —desfase de hasta 101 s y σ 26,7 s— **no habría bastado** y se habrían descartado eventos como tardíos. Con la hora corregida —mediana de 0,4 s de error— queda holgada. Otro efecto del arreglo del tiempo del 11-09 que conviene medir cuando se relance P1 en streaming.
- **Problemas / pendiente:**
  - **Revalidar P1 (7 de 7) y P2 sobre los datos recargados.** Las alertas de las campañas LSASS han cambiado (+0 a +5) y las horas de apt29 se han corregido. Más evidencia no debería romper la detección de ninguna campaña, pero hay que comprobarlo, no suponerlo. La extensión temporal de las campañas sí cambiará, porque ya no se mide con horas de recogida.
  - Recalibrar las ventanas de `docs/scenarios/apt29-day1.md` §4 con la hora corregida.
  - Portar P2 a `MATCH_RECOGNIZE`.
  - `replay_dataset.py` publica en `raw.host.windows` con su propia clave; no es cuello de botella hoy (la normalización va sobrada), pero conviene revisarla con el mismo criterio.
- **Archivos tocados:** `pipeline/jobs/normalize_job.py`.

### 2026-09-14 (2) — P2 revalidado, y los dashboards contaban de más
- **Con qué/quién:** Claude Code, sesión guiada, con los comandos ejecutados por Javier.
- **Objetivo:** revalidar P2 sobre los datos recargados con la hora corregida y la identidad de evento.
- **P2 se mantiene, y lo que debía moverse se mueve como estaba previsto.** Misma campaña, `SCRANTON → NASHUA`, con **17 aristas**, las mismas 115 alertas absorbidas, evidencia 4/4/1 y confianza 1,0. Lo único que cambia es **cuándo** dice que ocurrió: `first_seen` pasa de 03:09:27.836 a **03:09:23.801** —exactamente la hora corregida que se midió el 11-09 al validar la cadena de tiempo— y `last_seen` de 03:18:01.884 a 03:17:59.493, con la duración en 516 s. La detección del salto no depende del arreglo del tiempo; su fechado sí, y ahora es correcto.
- **Hallazgo: los dashboards contaban un 48 % de más.** Tras volcar el corpus dos veces —el 11-09 y hoy con `--con-eventos`— `tfg.events` tenía **784.823 filas sin `FINAL` frente a 530.401 con `FINAL`**. `ReplacingMergeTree` deduplica en las fusiones, que ClickHouse hace en segundo plano y a su ritmo, y solo había fundido una parte. P2 no se enteraba porque su vista deduplica por su cuenta, pero **los paneles de Grafana consultan sin `FINAL`**, y la vista de movimiento lateral del 11-09 tampoco lo llevaba: daba **65 conexiones en vez de 39**.
  - Es literalmente lo que advertía el comentario del DDL escrito el 11-09 —"para garantía inmediata, consultar con `FINAL`"— y no se aplicó en lo que se escribió después. Tercera vez en tres días que una guarda correcta, ya documentada, no llega al código que depende de ella.
- **Arreglo inmediato:** `OPTIMIZE TABLE ... FINAL` sobre `tfg.events` y `tfg.alerts`. Recuentos exactos al momento: 530.401 eventos, 1.184 alertas, 39 conexiones laterales.
- **Arreglo duradero, en dos piezas:**
  - **El cargador fuerza la fusión al terminar.** Se eligió frente a poner `FINAL` en las ~20 consultas de los dashboards: el pipeline se carga por lotes, así que fusionar una vez al final deja las consultas rápidas y simples, y solo serían inexactas *durante* una carga, que es cuando nadie mira un panel.
  - **Las vistas leen con `FINAL`.** Son lógica de análisis y no deben depender del estado de fusión, igual que la de P2 ya se protegía sola.
- **Comentario desfasado corregido en el cargador.** Advertía de no usar `--con-eventos` porque `tfg.events` contenía los 1,22 M eventos atómicos de ML-1 y "el sink no es idempotente". Desde la migración del 11-09 ninguna de las dos cosas es cierta, y quien lo leyera habría creído que activarlo corrompía el entrenamiento de ML-1. De paso se arregló la consulta de comprobación que el cargador sugiere al terminar, que usaba `docker compose exec` sin credenciales y no habría funcionado.
- **Problemas / pendiente:** revalidar **P1 (7 de 7)** con las alertas nuevas —las campañas LSASS ganaron de 0 a 5 alertas—; recalibrar las ventanas del escenario con la hora corregida; portar P2 a `MATCH_RECOGNIZE`. El `--con-eventos` podría pasar a estar activo por defecto ahora que es seguro, pero cambiar un comportamiento por defecto merece decisión aparte.
- **Archivos tocados:** `scripts/load_f3_corpus.sh`, `infra/clickhouse/views/v_red_lateral.sql`.

### 2026-09-15 — P1 revalidado, y el doble conteo de la métrica estrella
- **Con qué/quién:** Claude Code, sesión guiada, con los comandos ejecutados por Javier.
- **Objetivo:** revalidar P1 sobre los datos recargados (hora corregida, identidad de evento), que era lo único pendiente de la revalidación tras P2.
- **P1 se sostiene sin cambios.** **11 campañas, 7 de 7 variantes de LSASS_campaign, 0 campañas sin evidencia de refuerzo y ratio de reducción 0,991**, idéntico al del 31-07. Las campañas LSASS no se mueven —sus horas vienen de `TimeCreated`, que no se tocó— y las de apt29 siguen siendo SCRANTON ×2 y NASHUA.
  - Se había advertido de un riesgo concreto: las dos campañas de SCRANTON existen porque sus anclas distan más de la ventana de 10 min, y con la hora de recogida los eventos se desplazaban hasta 101 s y se reordenaban. Si ese hueco hubiera estado cerca del umbral, la corrección podía haberlas fundido o partido. **No ocurrió**: el resultado de P1 no dependía de un artefacto de la hora de recogida.
- **Detalle de la resolución temporal.** Las dos campañas de SCRANTON empiezan en `02:56:14.000` y `03:10:22.000`, con los milisegundos a cero: las abre un evento de Security o PowerShell, cuya hora se reconstruye con resolución de segundo (`EventTime+tz`). Los límites de esas campañas los marca la parte menos precisa del dato; es la limitación documentada el 11-09, vista en la práctica.
- **Defecto encontrado — la métrica estrella contaba alertas dos veces.** El total daba **1.186 alertas absorbidas** en un corpus que tiene **1.184**, y day1 daba 743 en un dataset de 741. Imposible sin doble conteo. La causa: las dos campañas de SCRANTON **se solapan** —la primera va de 02:56:14 a 03:14:42 y la segunda de 03:10:22 a 03:22:12—, porque aunque sus anclas estén separadas más de 10 min, cada una absorbe alertas en ±10 min alrededor de las suyas y esas ventanas se pisan. La vista hacía `count()` por campaña y las métricas **sumaban**.
  - **Medido, no supuesto:** 512 alertas en la primera, 116 en la segunda —las cifras exactas de P1, lo que confirma que la absorción es el intervalo `[inicio, fin]`—, **22 en las dos a la vez** y 606 distintas. El total solo delataba 2 porque day1 tiene alertas en NEWYORK y UTICA que P1 no absorbe y dejaban hueco para esconder el resto.
  - **No lo causó nada de esta semana**: la primera campaña ya iba de 02:56 a 03:14 el 31-07. Lleva en el oráculo desde que existe.
- **Decisión: arreglar la métrica, no las campañas.** Asignar cada alerta a una sola campaña (la del ancla más cercana) o fundir las solapadas sería más limpio conceptualmente, pero cambia lo que produce P1 y rompe la reconciliación con Flink del 31-07, que costó una sesión entera. Se optó por:
  - **En la vista**, una columna nueva `ids_absorbidos` con los `alert_id` de cada campaña. Lo que ya existía no cambia.
  - **En las métricas**, contar alertas **distintas** entre campañas con `uniqExactArray(ids_absorbidos)` en vez de sumar, y una columna `contadas_dos_veces` que deja la corrección visible en lugar de esconderla.
- **Resultado:** day1 **721** absorbidas (no 743) con 22 contadas dos veces; total **1.164** (no 1.186); cero dobles en las siete campañas LSASS y el atómico, que tienen una sola campaña por dataset. **El ratio no cambia a tres decimales**: 0,996 en day1 y 0,991 en el total. El titular sobrevive; la columna de absorbidas estaba mal un 3 % en day1.
- **Matiz semántico que conviene declarar en la memoria:** en el oráculo **una alerta puede pertenecer a dos campañas del mismo host**. Se acepta —en un SOC real los incidentes solapados existen—, pero la métrica de reducción la cuenta una sola vez. Queda por comprobar si la versión en Flink tiene el mismo solapamiento: el 31-07 se anotó que Flink acota la campaña a su evidencia en vez de absorber ±10 min (su SCRANTON iba de 03:00 a 03:05), así que probablemente no, pero no está medido.
- **Archivos tocados:** `detection/patterns/p1_credential_theft.sql`, `detection/patterns/p1_metrics.sql`.

### 2026-09-15 (2) — Las ventanas del escenario, con la hora del evento
- **Con qué/quién:** Claude Code, sesión guiada, con los comandos ejecutados por Javier.
- **Objetivo:** recalcular la sección 4 de `docs/scenarios/apt29-day1.md`. De ella salen las ventanas de P1, y todas sus cifras se habían medido con horas de recogida.
- **Las dos cifras de las que depende P1 se sostienen.**
  - **Núcleo** —volcado de la herramienta → acceso a LSASS—: **4 min 47 s**, idéntico al segundo (03:00:29,705 → 03:05:16,654; antes 03:00:30,614 → 03:05:17,687). La ventana de 10 min sigue siendo "el doble del núcleo".
  - **Hueco entre los dos accesos a LSASS**: **13 min 53 s** (antes 14 min 25 s). Sigue por encima de la ventana con **3 min 53 s de margen**, así que las dos campañas de SCRANTON no están separadas por casualidad.
  - **Duración de la campaña**: **26 min 27 s en ambos casos**, exactamente 1.587 s; el inicio se adelanta 1,9 s y el final 1,1 s.
- **Lo que sí cambia:**
  - **Los eventos del final se desplazan mucho más que los del principio.** Casi todo se adelanta 1-2 s, pero lo de las 03:19 en SCRANTON se adelanta **21 s** (`lateral-movement`) y **36 s** (`discovery`). Encaja con un colector que se retrasaba al crecer el volumen, y explica que las duraciones de las tácticas de SCRANTON encojan entre 0,7 y 1,3 min.
  - **Cambia un orden a las 03:19.** Antes el movimiento lateral en SCRANTON (03:19:35) iba *antes* que el segundo volcado de LSASS (03:19:42); ahora el volcado va primero (03:19:09,803) y el movimiento lateral después (03:19:14). Es lo coherente —robar credenciales y luego usarlas—, pero esa alerta tiene hora de resolución de segundo, así que con 4,2 s de diferencia el orden es **muy probable, no seguro**.
  - **Una fila repetida en el bloque de P1**: dos `Potential Credential Dumping Activity Via LSASS` en el mismo milisegundo. No es un error: son dos eventos de acceso a LSASS que antes normalizaban idénticos. Es una de las tres parejas que reaparecieron al pasar de 738 a 741 alertas.
- **La tabla del 31-07 estaba incompleta.** Tenía 17 filas y ahora salen 21. Las cuatro nuevas son de NASHUA (`impact`, `credential-access`, `stealth`, `resource-development`), y se comprobó contra `tfg.alerts_legacy` que **ya existían entonces**: la tabla se montó a mano y se quedó corta. Por eso la sección nueva incluye **las consultas que generan cada tabla**, para que no vuelva a editarse a mano.
- **Nota metodológica corregida.** La sección afirmaba que las marcas de tiempo "no se habían visto afectadas". Era cierto respecto a la deduplicación del 30-07, y **falso** por el motivo descubierto el 08-09. Ahora lo dice así. Además, las horas reconstruidas con resolución de segundo van marcadas con †: son 8 de las 21 primeras alertas por táctica, y marcan los límites de las dos campañas de SCRANTON.
- **Error propio, detectado a tiempo:** la primera consulta de duración midió sobre los **cuatro** hosts, mientras que la tabla antigua solo cubría SCRANTON y NASHUA. El final salía más tarde (03:23:14), cosa que la corrección de hora no puede producir, porque la hora de recogida siempre es posterior a la del evento. Esa imposibilidad fue la pista. Repetida con el mismo alcance y comparada contra `alerts_legacy`: la fila antigua coincide al milisegundo con el documento.
- **❓ Pregunta abierta nueva:** NASHUA tiene **3 alertas de `impact` desde las 02:59:37**, diez minutos **antes** del salto de SCRANTON a las 03:09:23. No están en la cadena del plan, y la campaña P1 de NASHUA arranca a esa misma hora, así que las está absorbiendo. Hasta explicarlas no puede afirmarse que NASHUA entra en juego con el salto lateral.
- **Problemas / pendiente:**
  - **La sección 3 del escenario también está desfasada**, y en un punto es un error de hecho: afirma que "el registro `Initiated=false` revela la IP propia del receptor", que es exactamente la regla que el 09-09 se demostró no fiable (70 votos espurios de NEWYORK). Además, la secuencia del salto de P2 y su "núcleo de 1 min 53 s" están medidos con horas de recogida.
  - Medir si **P1 en Flink** tiene el mismo solapamiento de campañas que el oráculo.
  - Explicar las alertas de `impact` en NASHUA anteriores al salto.
  - Portar P2 a `MATCH_RECOGNIZE`.
- **Archivos tocados:** `docs/scenarios/apt29-day1.md`.

### 2026-09-23 — Base del frontend: grafo del pipeline y observabilidad, sin backend
- **Con qué/quién:** Claude Code. Por decisión de Javier, la instalación de dependencias y la base del frontend las hizo el agente de forma autónoma (solo `npm` dentro de `frontend/`, sin tocar servicios, topics ni tablas).
- **Objetivo:** montar la base del portal (F8) tomando como modelo el de PIDS (`PIDS-Proyecto1/parte4_frontend`), en particular su grafo de arquitectura y el redibujado de los cuadros de Grafana, aunque todavía no haya API a la que conectarlo.
- **Hecho:**
  - **`frontend/`**, con tres secciones: *Situación* (cifras del corpus de F3, las doce campañas del oráculo en batch y el avance por fases), *Grafo del pipeline* (14 piezas con su ficha y sus ficheros del repo) y *Observabilidad* (los cuatro cuadros de `infra/grafana/dashboards` en su rejilla de 24 columnas). Las secciones de fases futuras existen ya como páginas «próximamente» con su fase, para que la navegación final quede fijada desde la base.
  - **El grafo es también el mapa del ROADMAP:** las piezas operativas (F1–F3) van sólidas y las planificadas (CTI, grafo de ataque, priorización, API) en discontinua con su fase. Las aristas llevan el nombre del topic o de la tabla por la que pasa el dato. Un botón simula el replay de apt29 day1 e ilumina los tramos activos hasta los totales medidos.
  - **Tres tipos de panel nuevos respecto a PIDS** porque los cuadros del TFG los usan: tabla, indicador (gauge) y grafo de nodos (el salto SCRANTON → NASHUA con sus 17 aristas y el mapa IP → host).
  - **Verificación:** TypeScript y ESLint limpios, tests en verde (Vitest) y build de producción. Revisión visual con capturas de Chromium headless de las tres secciones y los cuatro cuadros; de ahí salieron tres arreglos (un panel de CPU demasiado bajo que cortaba el eje, ruido excesivo en las series y un porcentaje con punto decimal).
- **Decisiones** (recogidas también en §2):
  - **Stack de PIDS en vez del de ROADMAP F8.1:** React 19 + Vite 8 + Tailwind 4 + shadcn/ui + TanStack Query + Recharts, y el grafo en SVG propio. Cytoscape.js se aplaza al grafo de ataque de F5, que sí tendrá cientos de nodos; Zustand no hace falta aún. Anotado en el ROADMAP.
  - **Paleta gris, no blanca.** Petición expresa de Javier: es una herramienta para SOC, y las superficies blancas y brillantes fatigan la vista en turnos largos y restan protagonismo a los colores de severidad. Ningún plano grande es blanco (fondo `#dde2e8`, tarjetas `#eceff3`), el texto es pizarra y no negro puro, el suave mantiene 5,2:1 de contraste (WCAG AA) y el color intenso se reserva para una escala de severidad propia. Documentado en `frontend/README.md` §Diseño; sustituye al «tema oscuro» que pedía el ROADMAP.
  - **Cada cifra dice de dónde sale.** Todo lo que el portal enseña como «documentado» sale de un único fichero, `src/api/simulado/corpus.ts`, con la referencia de la entrada de bitácora o del fichero donde está medida. Solo las métricas de Prometheus (tráfico, memoria, CPU) son «ilustrativas», y lo pone un chip en cada panel. Lo no documentado se deja vacío en vez de inventarlo: los eventos por campaña LSASS salen como «—» porque la bitácora da la lista sin decir cuál es cuál.
  - **Una sola puerta de datos** (`src/api/`): las páginas consumen hooks de TanStack Query y nunca el simulador, así que conectar la API de F6.3 será cambiar cada `queryFn` por un `fetch`, sin tocar páginas.
- **Comprobación cruzada que salió gratis:** al reunir las cifras en `corpus.ts`, los tests reprodujeron las sumas de la bitácora sin tocar ClickHouse. Las alertas por dataset suman 1.184, y consumidos = normalizados + DLQ (550.494 = 530.401 + 20.093). Además, las campañas de P1 suman 512 + 115 + 116 + 433 + 10 = 1.186, que menos las 22 contadas dos veces da las 1.164 del 15-09. De esa última cuenta se derivan dos cifras que no estaban escritas explícitamente: la campaña P1 de NASHUA absorbe **115** alertas (743 − 512 − 116) y cada campaña LSASS absorbe **todas** las alertas de su dataset (1.164 − 721 = 443 = 433 + 10). Van marcadas como derivadas en el código.
- **Problemas / pendiente:**
  - `npm install` falló con un error interno del resolvedor de npm (`Cannot read properties of null (reading 'edgesOut')`); se sorteó partiendo del `package-lock.json` de PIDS, que ya estaba resuelto con las mismas versiones.
  - Conectar a la API cuando exista (F6.3); `corpus.ts` pasará entonces a ser el oráculo de la primera prueba de integración: la API tiene que devolver esas mismas cifras.
  - Marca definitiva (F8.0): «Ciberconciencia» y el logotipo son provisionales.
  - La tabla «Estado actual» del `README.md` raíz sigue en F2 «en curso» y F3 «pendiente», y §4 de esta bitácora se quedó en el 31-07 salvo la línea del frontend: conviene ponerlos al día en una pasada aparte.
- **Siguiente paso:** retomar F3 donde se dejó (portar P2 a `MATCH_RECOGNIZE`); el frontend no bloquea nada.
- **Archivos tocados:** `frontend/` (nuevo), `docs/ROADMAP.md` (F8.1), `README.md` (estructura).

### 2026-09-23 (2) — Demo de conciencia situacional: ataque simulado y asistente de respuesta
- **Con qué/quién:** Claude Code, de forma autónoma dentro de `frontend/` (Javier fijó que el frontend es un extra del TFG, un boceto para la reunión con la tutora, y que ese trabajo puede hacerse sin guiar).
- **Objetivo:** enseñar cómo se vería la conciencia cibersituacional: qué parte de la organización está atacando el adversario, representado como grafo, con un botón que simula un ciberataque y un asistente que, viendo el ataque en tiempo real, dice qué respuesta inmediata dar para mitigarlo.
- **Hecho:**
  - **Sección `/conciencia`**, que sustituye a la página «próximamente» del grafo de ataque. La organización se dibuja por zonas de red (Internet → perímetro → puestos → servidores → activos críticos) con el área de negocio de cada activo y sus joyas de la corona. Encima se ven los pasos del ataque según ocurren, los que la respuesta impide (tachados, con el motivo) y la ruta más probable hacia la siguiente joya.
  - **Varias organizaciones a la vez**, cada una con su propia simulación: se puede lanzar un ataque en una, cambiar a otra y volver, y la tarjeta de cada una dice si está en calma, bajo ataque, contenida o con el objetivo alcanzado. Hay dos. *Helios Farmacéutica* es **ficticia** y está diseñada para recorrer los tres pilares en un solo ataque: phishing, C2, P1, P2, DCSync, exfiltración de I+D, borrado de copias, sabotaje OT y ransomware. *DMEVALS* es el dominio de **APT29 day1** ampliado: sus pasos hasta las 03:19 son los medidos y están marcados como documentados, y lo posterior es extrapolación ilustrativa.
  - **Asistente de respuesta** con tres piezas: una situación redactada, la gravedad 0–100 **descompuesta en cinco factores** (anticipo del Pilar C) y acciones priorizadas por fase NIST SP 800-61 y táctica D3FEND, cada una con su evidencia y su **coste de negocio**. «Aplicar» cambia el curso del ataque desde ese momento; responder tarde no deshace lo ocurrido.
  - `?t=<segundo>` abre la simulación en pausa en un instante concreto, útil para la reunión: `/conciencia?org=helios&t=62` es justo después del DCSync.
- **Decisiones** (recogidas también en §2):
  - **Las reglas deciden, el LLM solo redacta.** Las acciones las elige un motor de reglas determinista y auditable. El hueco del LLM (con RAG sobre ATT&CK, D3FEND y playbooks, solo inferencia) está preparado en `asistente/redactor.ts` para explicar, nunca para decidir ni inventar cifras. Es una respuesta directa a «¿cómo mantienes la explicabilidad con modelos de por medio?».
  - **La ruta probable es una búsqueda en anchura** sobre la alcanzabilidad de red. En F5 la sustituirá Datalog (MulVAL) con trazabilidad; la interfaz que consume la ruta no cambiará.
  - Toda la lógica son funciones puras sobre (organización, instante, acciones), así que pausar, cambiar de organización o saltar a un segundo es solo volver a evaluar.
  - **Autonomía del agente en `frontend/`:** al ser un extra, el agente puede instalar, compilar y probar sin guiar (anotado en §3). El pipeline sigue siendo paso a paso y los commits los hace Javier.
- **Verificación:** 81 tests (30 nuevos), TypeScript, ESLint y build limpios, más capturas de Chromium headless. Algunos tests comprueban la coherencia de los escenarios: el atacante no se teletransporta (todo salto sigue un enlace de red) y ningún paso se queda sin respuesta propuesta. Las capturas destaparon tres fallos, ya corregidos: líneas que atravesaban tarjetas de la misma columna, un salto de DMEVALS que tapaba a UTICA y, el más importante, un **error de criterio del asistente**, que tras el DCSync priorizaba «blindar BACKUP-01» por delante de restablecer krbtgt. Ahora hay un test que exige que, con el dominio robado, lo primero sea expulsar al atacante.
- **Problemas / pendiente:** los escenarios son guiones fijos; con backend, las campañas saldrán de `det.campaigns`, la ruta de Datalog y la redacción del LLM. Las dos organizaciones pasarán a ser tenants (F8.2).
- **Archivos tocados:** `frontend/src/paginas/conciencia/` (nuevo), `frontend/src/componentes/shell/{navegacion.ts,AppShell.tsx}`, `frontend/src/rutas.tsx`, `frontend/README.md`.

### 2026-10-21 — Portal: modo oscuro, grafo de ataque con React Flow, incidentes, línea temporal, ATT&CK y evaluación
- **Con qué/quién:** Devin (agente de IA en terminal), de forma autónoma dentro de `frontend/` según §3, con las skills `ui-ux-pro-max` y `react-flow` (instaladas a mano, ver su `PROCEDENCIA.md`). Sin tocar el pipeline ni los servicios; sin commits.
- **Objetivo:** mejorar el portal de forma integral para la demo: botón de modo claro/oscuro, explorador del grafo de ataque sobre datos documentados, `/incidentes` y `/attack` (eran «próximamente»), línea temporal de APT29 day1, evaluación con solo lo medido y un asistente que separe hechos, inferencias y recomendaciones.
- **Hecho:**
  - **Auditoría y plan** (`frontend/docs/plan-mejora.md`): punto de partida 81 tests, lint y build limpios, 979 kB de JS cargados de golpe (todas las páginas se importaban de forma estática).
  - **Dos temas.** Claro gris por defecto y oscuro opcional sobre los mismos tokens; ~80 colores fijos repartidos por los componentes pasados a tokens. Preferencia recordada en `localStorage` y aplicada por un script en línea antes del primer pintado (sin parpadeo). Un test mide el contraste de cada par en los dos temas: **el tema claro original ya incumplía AA** en severidad media y alta como texto, el aviso sobre su tinte, las líneas de los dos grafos SVG y el texto suave de la barra lateral; corregido con el ajuste mínimo de luminancia, sin cambiar el tono.
  - **Grafo de ataque** (`/ataque`, React Flow): SCRANTON, NASHUA, NEWYORK y UTICA con su IP y papel, `DMEVALS\pbeesly`, los procesos de cada puerto, las alertas del bloque de P1 y las cuatro campañas de day1. Cada relación dice su fundamento con trazo, icono y texto: **observado** (Sysmon EID 3, alertas), **inferido** (evidencia de campaña, confianza descompuesta) o **hipótesis** (la lectura del escenario «el robo habilita el salto» y el DCSync extrapolado de la demo). Filtros, secuencia temporal en 8 pasos, detalle, teclado y una lista accesible.
  - **Incidentes** (las 12 campañas, sin prioridad inventada), **línea temporal** (con la resolución real de cada hora: † y «orden incierto en el segundo»), **matriz ATT&CK** (capas Navigator reales, agrupadas por familia porque las capas no traen la táctica) y **evaluación** (ML-1 con el control de volumen 0,941 junto al 0,995 y el aviso de las 28 ventanas; precisión, recall, F1, falsos positivos y latencia como «pendiente (F7)», sin números).
  - **Situación** como panel de entrada (accesos, reparto táctica × host, estado del pipeline) y la tarjeta de reducción con su advertencia: **0,991 solo en el alcance de P1, no comparable con 741 → 87**.
  - **Asistente**: hechos observados / inferencias del sistema / recomendaciones / redacción; «Aplicar» dice que solo actúa sobre la simulación. Interfaz de **niveles de autonomía** como demo de la propuesta en estudio (F6.4): 0 y 1 (con confirmación explícita) activos, 2 y 3 deshabilitados, 4 descartado.
  - `npm run sincronizar-datos`: copia a `frontend/src/api/datos/` las dos capas ATT&CK y `ml/anomaly/resultados.json` con su SHA-256 (un test lo comprueba). `frontend/src/api/tipos.ts`: contrato futuro copiado de `build_alert()`, `p1_05_emision.sql` y la vista de P2.
  - Carga diferida por ruta: la portada baja de 979 a **484 kB** de JS (sin Recharts ni React Flow); React Flow (163 kB) solo entra en `/ataque`. Al medirlo apareció que `clsx` arrastraba Recharts entero a la portada (los grupos de rolldown se llevan las dependencias); resuelto con un grupo `utilidades`.
  - Skill del proyecto en `.claude/skills/cybersecurity-dashboard/SKILL.md` (convenciones, temas, esquemas, ATT&CK, React Flow, procedencia, seguridad, accesibilidad, pruebas).
- **Decisiones** (recogidas también en §2):
  - **Diseño del portal:** modo claro gris por defecto + modo oscuro opcional, AA comprobado por test.
  - **Frontend:** React Flow para el explorador del grafo de ataque; **Cytoscape.js sigue reservado para el grafo real de F5**; los grafos SVG que ya funcionaban no se migran.
  - **Procedencia:** las cifras documentadas pueden salir también de copias sincronizadas con huella; lo no documentado se dice («no documentada»), nunca se rellena.
  - Bug corregido en la demo (`simulacion.ts`): una acción aplicada en el mismo instante en que aparecía un paso lo «des-ocurría» (se comparaba con `<=`). Ahora una acción solo afecta a pasos posteriores; el estado de los activos sí refleja lo recién aplicado. Lo destapó la prueba de Playwright.
- **Verificación:** 274 tests en 25 ficheros (81 anteriores + 193 nuevos: tema, contraste de los dos temas, construcción del grafo desde `corpus.ts`, filtros, orden, secuencia, horas, huellas de datos y páginas), ESLint y build limpios. **Playwright** (1.63.0, con el Chromium que ya estaba en caché): 19 pruebas en 1280, 1440 y 1920 px (navegación sin errores en consola, tema recordado y sin parpadeo, filtros y selección del grafo con ratón y teclado, demo, peso de la portada, sin desbordamiento horizontal) y capturas de las diez pantallas en los dos temas, revisadas una a una.
- **Problemas / pendiente:**
  - Faltan datos que no están documentados: las 741 alertas de day1 una a una, la hora de cada una de las 17 aristas de P2 y la confianza de las campañas P1 de apt29. Consultas de exportación propuestas en `frontend/README.md` §Datos (las ejecuta Javier).
  - La capa ATT&CK observada es del 28-07 (antes de las campañas LSASS y de la recarga del 14-09); `T1685`/`T1685.001` siguen sin verificar. Para agrupar por táctica haría falta el catálogo de ATT&CK v19.
  - `npm audit`: 11 avisos en dependencias que ya estaban (cadena de `shadcn` y `vite`); ninguno de las nuevas.
  - §4 de esta bitácora sigue desfasada (se quedó en el 31-07); no se ha tocado en esta sesión.
- **Siguiente paso:** revisar el portal en los dos temas antes de la reunión; si interesa, exportar los datos de ClickHouse propuestos para que la línea temporal y el grafo enseñen todas las alertas.
- **Archivos tocados:** `frontend/` (tema, `src/api/{ataque,incidentes,cronologia,attack,evaluacion,tipos}.ts`, `src/api/simulado/{corpus,grafoAtaque,incidentes,cronologia,attack,evaluacion}.ts`, `src/api/datos/`, `src/paginas/{ataque,incidentes,cronologia,attack,evaluacion}/`, `src/paginas/{situacion,conciencia,grafo,observabilidad}/`, `src/componentes/{tema,datos,shell}/`, `src/estilos/`, `rutas.tsx`, `paginasDiferidas.tsx`, `vite.config.ts`, `index.html`, `e2e/`, `playwright.config.ts`, `scripts/sincronizar-datos.mjs`, `docs/plan-mejora.md`, `README.md`, `package.json`, `package-lock.json`, `.gitignore`), `.claude/skills/cybersecurity-dashboard/SKILL.md`, `BITACORA.md`.

### 2026-10-21 (2) — Exportaciones de ClickHouse para el portal y T1685 verificado
- **Con qué/quién:** Claude Code, con autorización expresa de Javier para levantar ClickHouse y ejecutar las consultas.
- **Objetivo:** dar al portal los datos medidos que le faltaban (alertas de day1 una a una, aristas de P2 con hora, confianza de las campañas P1 de apt29) y el catálogo de ATT&CK para agrupar la matriz por táctica.
- **Hecho:**
  - Comprobado antes de exportar que el almacén conserva el corpus: `tfg.events FINAL` = 530.401 y `tfg.alerts FINAL` = 1.184.
  - Seis ficheros en `eval/portal/` (detalle, comprobaciones y comandos para regenerarlos en su `README.md`): las **741** alertas de day1 (medium 413, high 263, low 55, informational 10), las **17** aristas de P2 (5985 ×4, 445 ×8, 135 ×5, de 03:09:23.801 a 03:17:59.493: cuadran con el 14-09), las 11 campañas de `tfg.p1_campanas`, la campaña de `tfg.p2_campanas`, las técnicas observadas sobre el corpus actual y un extracto del catálogo ATT&CK v19.
  - **Confianza de las campañas P1 de apt29**, que no estaba documentada: SCRANTON 02:56 = 0,85; NASHUA = 0,80; SCRANTON 03:10 = 0,65.
  - **Técnicas observadas en el corpus actual: 47**, frente a las 34 de la capa de F2 (28-07), que solo cubría apt29 day1 y el atómico. Las dos cifras son ciertas para su alcance; la de 34 sigue siendo el resultado de F2.
  - **`T1685` verificado, pendiente desde el 27-07:** existe en ATT&CK v19 como *Disable or Modify Tools* (táctica `defense-impairment`) y `T1685.001` es *Disable or Modify Windows Event Log*. Encaja con la reorganización de v19 (`defense-evasion` dividida en `stealth` y `defense-impairment`). Las 300 técnicas potenciales y las 47 observadas están todas en el catálogo v19.
- **Problemas / pendiente:** la consulta 2 propuesta en `frontend/README.md` fallaba por **sombreado de alias** (`IPv6NumToString(dst_ip) AS dst_ip` hacía que el `WHERE dst_ip = toIPv6(...)` comparara una cadena con una IPv6): el mismo error documentado el 11-09, por cuarta vez. Corregida en `eval/portal/README.md`; falta corregirla en el README del frontend. ClickHouse queda levantado.
- **Siguiente paso:** que el portal use estos ficheros (prompt de mejoras de diseño del 21-10).
- **Archivos tocados:** `eval/portal/` (nuevo), `BITACORA.md`.

### 2026-10-21 (3) — Portal, ronda 2: datos exportados, asistente que no ejecuta, copiloto, carriles y navegación
- **Con qué/quién:** Devin (agente de IA en terminal), de forma autónoma dentro de `frontend/` según §3, con las skills `ui-ux-pro-max`, `react-flow` y la del proyecto. Sin tocar servicios; sin commits.
- **Objetivo:** incorporar las exportaciones de `eval/portal/` (entrada 21-10 (2)) y hacer las diez mejoras de diseño del prompt de la ronda 2, más el copiloto con RAG preparado.
- **Hecho:**
  - **Datos**: `npm run sincronizar-datos` copia los seis ficheros nuevos (los `.jsonl`, validados línea a línea; huellas y filas comprobadas por test) y `src/api/exportaciones.ts` los carga bajo demanda. Al cruzarlos con lo copiado a mano salieron tres títulos de regla que no coincidían con los reales (corregidos en `corpus.ts`). T1685 deja de estar «sin verificar»; las 12 campañas tienen host, ventana y confianza (las de apt29: 0,85 · 0,80 · 0,65, y los factores presentes reproducen exactamente la confianza exportada); y donde aparecen las técnicas observadas se dice cuál es la cifra: **47 en el corpus actual (21-10) o 34 en la capa de F2 (28-07)**.
  - **`/respuesta`**: asistente que propone y no ejecuta (técnica ATT&CK → acción NIST SP 800-61 y D3FEND, con porqué y coste, evidencia de las alertas y aristas reales), con HECHOS / INFERENCIAS / RECOMENDACIONES y la procedencia por bloque; sin botón «Aplicar», solo «copiar como plan». El panel de `/conciencia` pasa a ser un resumen con enlace.
  - **`/copiloto`**: proveedor local (determinista, respuesta por partes) y proveedor LLM con RAG declarado pero no disponible; el código hace cumplir las cuatro reglas (sin acciones, cita en toda afirmación, una organización por conversación, ningún LLM desde el navegador). Diseño en `frontend/docs/copiloto-rag.md` (base vectorial por empresa aislada en el servidor, citas verificables, defensa frente a instrucciones escondidas en los registros, evaluación sin cifras inventadas).
  - **Grafo de ataque en carriles** por host con el tiempo de izquierda a derecha (función pura testeada), las 17 conexiones con su hora, zoom semántico, etiquetas al pasar, minimapa plegable, «Reproducir ataque» y atribución de React Flow visible.
  - **Portada SOC** en 1440 × 900 (actividad por minuto, severidad, mapa de calor táctica × host, campañas) y `/proyecto`; **línea temporal real** (741 marcas, brush, lista sincronizada); **incidentes** en maestro-detalle sin columna de prioridad; **matriz ATT&CK por táctica** con el catálogo v19; **Ctrl/Cmd + K**, barra superior y filtros que sobreviven a ir y volver; **Observabilidad** más densa; **menos texto** («Cómo leer esta página»).
- **Decisiones:**
  - Sin dependencias nuevas: la paleta de comandos es propia (no `cmdk`) y los gráficos de la portada y de la línea temporal son HTML/SVG (la portada sigue sin cargar Recharts ni React Flow).
  - No se dibujan umbrales ni tendencias que los datos no tengan: ninguna serie de los cuadros de Grafana define umbrales.
  - «Oráculo» deja de aparecer en el texto visible: «detector P1/P2 en lote».
- **Verificación:** 368 tests unitarios en 34 ficheros (274 anteriores, varios adaptados a las pantallas nuevas), ESLint y build limpios; Playwright: 37 escenarios en verde en 1280, 1440 y 1920 px (2 saltos previstos), capturas en los dos temas revisadas.
- **Problemas / pendiente:** la portada descarga el chunk de las 741 alertas (302 kB, 44,6 kB con gzip) para agregarlas en el navegador; con la API lo hará ClickHouse. Las campañas LSASS no tienen alertas una a una exportadas. `npm audit` sigue con los 11 avisos de dependencias anteriores.
- **Siguiente paso:** revisar el portal antes de la reunión y, si se valida el copiloto, decidir la base vectorial (§2).
- **Archivos tocados:** `frontend/` (src/api: exportaciones, respuesta, busqueda, attack, cronologia, situacion, incidentes, ataque, simulado/{actividad,campanas,attack,incidentes,grafoAtaque,corpus}; src/paginas: respuesta, copiloto, proyecto, ataque, cronologia, incidentes, situacion, attack, observabilidad, conciencia; src/componentes: shell, datos; estilos; e2e; scripts; docs/{copiloto-rag,plan-mejora}.md; README.md), `.claude/skills/cybersecurity-dashboard/SKILL.md`, `BITACORA.md`.

### 2026-10-21 (4) — Portal, ronda 3: Copiloto en panel lateral, modo presentación y fallos visuales
- **Con qué/quién:** Claude Code. El agente del frontend se quedó sin uso a mitad de la ronda; la terminó otra sesión, dentro de `frontend/` y sin tocar servicios.
- **Objetivo:** cerrar la ronda 3 (`prompt-agente-frontend-v4.md`): fallos visuales, portada más ligera, Copiloto en panel lateral y modo presentación para la reunión con la tutora.
- **Hecho:**
  - **Estado al retomarlo:** el agente había dejado hechos los agregados de la portada, el panel del Copiloto (estado compartido, vigía en diferido, cuatro detectores de señales débiles, «Preguntar al Copiloto sobre esto» en incidentes, grafo y línea temporal) y las correcciones de la tabla de incidentes, del eje de la línea temporal y del encuadre del grafo. Su última batería daba **35 fallos**, pero eran *timeouts* por carga (34 s frente a 5 s, con Playwright corriendo a la vez): sin carga pasaban los 383.
  - **Fallo nuevo encontrado y corregido:** con el Copiloto abierto a 1440 px, el panel empujaba el contenido hasta dejarlo en unos 800 px y la tabla de incidentes volvía a cortarse; la barra superior se descolocaba. Ahora el panel **solo empuja si deja al menos 1.000 px** (si no, se superpone) y la barra superior se adapta con consultas de contenedor. Con su test y su e2e.
  - **Modo presentación** (ROADMAP F8.4): 8 pasos, del problema a la demo; se inicia desde Ctrl+K o con `?presentacion=1`, ← → y Esc. Resalta el elemento de cada paso y abre el Copiloto en el suyo. **Ninguna cifra del guion está escrita a mano**: un test reconstruye cada número desde `corpus.ts` y los resultados de ML-1. Para ello se añadieron a `corpus.ts` la duración de la campaña (1.587 s) y la regla dominante (292 alertas), comprobadas contra la exportación del 21-10.
  - Escala de tiempo del grafo de ataque compactada (46 → 34 px por minuto) para que con todo el día a la vista se lea algo mejor.
  - **Resultado:** 396 tests unitarios en 37 ficheros, ESLint y build limpios; Playwright 52 en verde (2 saltos previstos) en 1280, 1440 y 1920 px. Portada: **462 kB** de JS (816 kB en la ronda 2).
- **Decisiones:**
  - El Copiloto sale de la barra lateral: se abre desde la barra superior (Ctrl/Cmd + I) y `/copiloto` queda como su vista a pantalla completa.
  - **Señales débiles: avisan, no alertan.** No cambian la severidad de nada, llevan su umbral y sus citas y se pueden descartar (coherente con el papel de ML-1).
- **Idea nueva, anotada (no implementada):** **mapa mundial en tiempo real del origen y el destino de las alertas.** Con el corpus actual no hay nada que geolocalizar (todas las IP son privadas de laboratorio: 10.0.x.x y el atacante en 192.168.0.4), así que hoy solo podría ser ilustrativo. Para que sea real: IP públicas (capturas con tráfico a Internet o IOC de la CTI de F4), GeoIP local en el servidor (nunca un servicio de terceros desde el navegador) y el WebSocket de F6.3. Además, la geolocalización dice dónde está la IP, no el atacante. Anotado en `frontend/docs/plan-mejora.md` §8, en el README del frontend y en ROADMAP F8.3.
- **Problemas / pendiente:** el grafo de ataque con todo el día a la vista sigue teniendo texto pequeño (el detalle se ve con «Reproducir ataque» y el zoom). §4 de esta bitácora sigue desfasada.
- **Siguiente paso:** guardar la ronda (`save.sh`), ensayar la presentación antes de la reunión y volver al núcleo (P2 en Flink, P3/P4, falsos positivos).
- **Archivos tocados:** `frontend/` (`src/componentes/presentacion/` nuevo, `src/copiloto/estado.ts` y `estado.test.ts`, `src/componentes/shell/{AppShell,BarraSuperior,comandos}`, `src/api/simulado/corpus.ts`, `src/paginas/ataque/carriles.ts`, `src/estilos/globales.css`, `e2e/portal.spec.ts`, `README.md`, `docs/plan-mejora.md`), `.claude/skills/cybersecurity-dashboard/SKILL.md`, `docs/ROADMAP.md`, `BITACORA.md`.


### 2026-10-21 (5) — Mapamundi animado en el boceto del frontend
- **Con qué/quién:** sesión de desarrollo del frontend autorizada por Javier, dentro del alcance de F8.
- **Objetivo:** añadir un mapa mundial donde ver de qué parte a qué parte del mundo viajan las alertas, animadas y en directo en el boceto.
- **Hecho:**
  - Nueva sección **Demo → Mapa mundial**, ruta /mapa, también disponible en Ctrl+K. Cabecera y detalle identifican de forma explícita el flujo geográfico ficticio de Helios: ninguna coordenada se deduce de las IP privadas del corpus.
  - SVG con 177 geometrías de Natural Earth, guardadas localmente con su fuente y SHA-256. d3-geo calcula la proyección y las rutas geodésicas, recortadas en el antimeridiano para que el salto del Pacífico no atraviese Europa. Script manual actualizar-cartografia.mjs para regenerar el fichero; no se descarga cartografía al abrir la página.
  - Partículas del origen al destino y anillo de llegada, reloj local con pausa real, velocidades 1×/2×/4×, reinicio y suspensión al ocultar la pestaña. Solo transform y opacity por fotograma, sin renders de React por fotograma.
  - Filtros por severidad y país en la URL, indicadores sobre sesenta segundos y lista reciente acotada. Seleccionar una alerta fija su detalle mientras llegan nuevas. Zoom y arrastre, tabla alternativa y selección por teclado; movimiento reducido con flechas estáticas.
  - Carga diferida de geografía y datos. Al inspeccionar el build se detectó que el grupo genérico de d3 arrastraba Recharts al mapa; corregido separando geografia y moviendo d3-array/internmap al grupo pequeño compartido.
- **Decisiones:** el tiempo real del boceto es un flujo local ilustrativo. El tiempo real de producción conserva sus requisitos: IP públicas, GeoIP en el servidor y flujo de alertas de F6.3. No se ha creado backend ni simulado un WebSocket. La ubicación de una IP no atribuye el ataque a un país.
- **Verificación:** 422 pruebas unitarias en 40 ficheros, lint y build correctos. Playwright: 64 correctas y 2 saltos previstos, con doce comprobaciones nuevas del mapa en 1280, 1440 y 1920 px. Animación real, pausa, filtros, detalle estable, zoom, teclado, movimiento reducido, ausencia de peticiones externas y carga diferida; capturas de los dos temas revisadas. Contraste de texto y rutas activas sobre el mapa añadido a la comprobación AA.
- **Problemas / pendiente:** integrar telemetría geolocalizable cuando exista; este mapa no cambia el estado de F3, F5 ni F6. Se mantienen los once avisos anteriores de npm audit.
- **Archivos tocados:** frontend/src/api/mapa.ts, frontend/src/api/simulado/mapa.ts, frontend/src/paginas/mapa/, navegación y rutas del portal, frontend/vite.config.ts, frontend/src/estilos/contraste.test.ts, frontend/e2e/mapa.spec.ts, frontend/scripts/actualizar-cartografia.mjs y dependencias; frontend/README.md, frontend/docs/plan-mejora.md, skill del portal, docs/ROADMAP.md y BITACORA.md.

### 2026-10-24 — Portal: la rama `frontend` a `main`, unificada con la versión anterior
- **Con qué/quién:** Claude Code, por indicación de Javier (llevar la rama a `main`, traerla a local y no perder nada de la versión anterior).
- **Hecho:**
  - La rama `origin/frontend` (3 commits del 24-10, firmados por Javier: ronda 4 con maqueta 3D, grafo de ataque por columnas, logo y sobriedad; maqueta realista con cámara que sigue el ataque y panel «Por qué»; trazas vivas en 2D y el mundo en mapa 2D y globo 3D) entró en `main` por **avance rápido** y se subió (`f08eaee..6c3a252`), a petición expresa de Javier. Sin commits nuevos ni atribuciones.
  - En local había trabajo sin guardar del 21-10: la página **«Mapa mundial» (`/mapa`)**, que un agente dejó tras la ronda 3. Se apartó en un *stash* y, tras ver Javier que faltaba, se **restauró** sobre `main`, resolviendo conflictos en README, skill, roadmap, plan y `vite.config.ts` (chunks `geografia`, `d3-comun` y `tresd` juntos).
  - **Unificación** decidida con Javier: lo nuevo se queda y lo anterior vuelve como opción.
    - Grafo de ataque: selector «Cámara: Seguir el ataque (por defecto) / Quieta», que recupera el movimiento que acompañaba cada paso.
    - Grafo de ataque: selector «Eje: Por momentos (por defecto) / Tiempo real», que recupera el eje a escala.
    - Grafo de ataque: lista de elementos abierta de entrada.
    - Mapas: `/mapa` y la vista «Mundo» enlazadas en los dos sentidos.
    - Estilo: se mantiene lo sobrio.
  - **Verificación:** 466 tests unitarios, ESLint y build limpios; Playwright 80 en verde en tres anchos.
- **Problema encontrado:** con el stack de PIDS levantado (Airflow, Spark, Mongo…), las baterías completas fallaban por *timeouts* incluso en la versión anterior (40 fallos en una que el 21-10 pasaba en 6 s). No era una regresión: con menos hilos y más margen pasan todas.
- **Decisión / regla nueva (skill §16):** un cambio de diseño que sustituya una función se ofrece como opción o se pregunta antes; «sobrio» es sin adornos, no con menos funciones.
- **Siguiente paso:** los ajustes que pida Javier; luego, volver al núcleo (P2 en Flink, P3/P4, falsos positivos).
- **Archivos tocados:** `frontend/` (`src/paginas/mapa/` restaurada, `src/api/mapa.ts`, `src/paginas/ataque/{carriles,PaginaAtaque}` y sus tests, `src/paginas/conciencia/PanelConexiones.tsx`, `e2e/mapa.spec.ts`, `README.md`, `docs/plan-mejora.md`, `vite.config.ts`), `.claude/skills/cybersecurity-dashboard/SKILL.md`, `docs/ROADMAP.md`, `BITACORA.md`.

### 2026-10-24 (2) — El portal, en Docker
- **Con qué/quién:** Claude Code, a petición de Javier («vamos a dockerizar el frontend»). Antes, Javier pidió parar el stack de PIDS: `docker compose -p pids stop`, sin borrar contenedores ni volúmenes. Con él parado, la batería de Vitest pasa entera (466) con `--maxWorkers=8`; con los procesos por defecto (23 en 24 núcleos) aún salen 3 *timeouts*.
- **Hecho:**
  - `frontend/Dockerfile` en dos etapas: compila con `node:22.23.2-alpine` (`npm ci` + `npm run build`) y sirve con `caddy:2.10.2-alpine`. La imagen final no lleva Node ni `node_modules`.
  - `frontend/Caddyfile`:
    - las rutas de la SPA vuelven a `index.html`, y un `/assets` que no existe da 404;
    - caché de un año para `/assets` (llevan huella en el nombre) y `no-cache` para `index.html`;
    - compresión zstd/gzip;
    - cabeceras de seguridad, y el bloque `/api` comentado para cuando exista F6.3.
  - CSP sin `unsafe-inline` para scripts: `scripts/csp-caddy.mjs` calcula en cada compilación la huella SHA-256 del script del tema que va en línea en `index.html`. Estilos con `unsafe-inline`, porque Radix y React Flow los insertan en tiempo de ejecución.
  - Servicio `portal` en `infra/docker-compose.yml`, con perfil propio `portal`:
    - publicado en `127.0.0.1:8090`, no en el 4173: Playwright arranca `vite preview` en ese puerto y reutiliza lo que encuentre, así que con el contenedor ahí probaba la imagen y no el build nuevo;
    - usuario 10001, raíz de solo lectura con tmpfs para `/data` y `/config`, `cap_drop: [ALL]` y `no-new-privileges`;
    - al binario de Caddy se le quita la capacidad de abrir puertos bajos, porque escucha en el 8080.
- **Decisiones:** imagen de producción, no de desarrollo: para trabajar sigue `npm run dev`. Caddy en vez de nginx, por ser el mismo servidor que ya se usaba en PIDS y por su configuración más corta. La imagen no lee nada fuera de `frontend/`: los datos van en `src/api/datos/`, así que tras `npm run sincronizar-datos` hay que reconstruirla.
- **Verificación:**
  - Imagen construida y contenedor `healthy`.
  - Cabeceras, 404 de `/assets`, caché y compresión comprobados con `curl`.
  - Playwright recorrió las 17 rutas en los dos temas, maqueta 3D (WebGL) y modo presentación incluidos: sin violaciones de la CSP, errores de consola ni respuestas ≥ 400.
- **Archivos tocados:** `frontend/{Dockerfile,Caddyfile,.dockerignore,scripts/csp-caddy.mjs,README.md}`, `infra/docker-compose.yml`, `README.md` (tabla de perfiles), `BITACORA.md`.

### 2026-10-24 (3) — Globo del mapa mundial: países iluminados, giro y flechas
- **Con qué/quién:** Claude Code, a petición de Javier, tras traer a local su commit `964a9b0` (mapa mundial en 2D o 3D) por avance rápido.
- **Hecho (globo de `/mapa`):**
  - Al elegir una alerta se **iluminan sus países** de origen y destino, como en el 2D. Usa los mismos polígonos de Natural Earth, pintados en una capa transparente sobre la Tierra.
  - **Sin giro automático.** Primero se hizo un giro que se paraba al elegir una alerta o filtrar por país; Javier, tras verlo, decidió que el globo **no gire solo en ningún momento**. Se quitaron el giro y su botón: solo se mueve a mano (arrastre o flechas). Anotado en la skill para que no se reintroduzca.
  - Si lo elegido queda a espaldas, la vista se vuelve una vez hacia ello; si ya se ve, no se mueve.
  - **Flechas** en la esquina inferior derecha: 20° por pulsación y tope de 75° de latitud.
  - La luz principal acompaña a la cámara, para que la cara visible no quede en sombra al girar.
  - El resumen accesible del globo dice qué países se iluminan.
  - Lógica pura en `paginas/mapa/vistaGlobo.ts`, con 6 tests.
- **Problemas encontrados:**
  - El portal en Docker usaba el puerto 4173, el mismo que Playwright usa para `vite preview` con `reuseExistingServer`: el e2e probaba la imagen y no el build nuevo. El portal pasa al **8090**.
  - Playwright reduce el movimiento por defecto, así que el test del giro tiene que activarlo explícitamente.
  - La máquina iba más lenta de lo normal: la batería unitaria tardaba 60 s y fallaba por *timeouts* también sin estos cambios, comprobado en un worktree de `HEAD`. Con `--maxWorkers=4 --testTimeout=30000` pasa entera.
- **Verificación:**
  - 473 tests unitarios, tsc, ESLint y build limpios.
  - Playwright `mapa.spec.ts`: 15/15 en tres anchos.
  - Recorrido del globo en los dos temas sin errores: alerta elegida con los países iluminados, flechas y filtro por Japón, Singapur y Brasil; con la demo en pausa, dos capturas separadas 4 s son idénticas (no se mueve solo).
  - Contenedor reconstruido en `localhost:8090`, sin violaciones de la CSP.
- **Archivos tocados:** `frontend/src/paginas/mapa/{GloboMundial.tsx,PaginaMapaMundial.tsx,vistaGlobo.ts,vistaGlobo.test.ts,mapa.css}`, `frontend/e2e/mapa.spec.ts`, `frontend/README.md`, `frontend/Dockerfile`, `infra/docker-compose.yml`, `README.md`, skill del portal, `BITACORA.md`.
