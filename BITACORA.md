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

## 3. Convenciones
- **Entorno:** WSL2 (Ubuntu) como host Docker; `.wslconfig` con `memory=44GB`, `processors=24`, `swap=8GB`; systemd activado (`/etc/wsl.conf`).
- **Ejecución:** `docker compose` con perfiles por fase (levantar solo el subconjunto necesario).
- **Datos:** el working set en el disco interno; datasets grandes/"fríos" en disco externo (git-ignored). `docker system prune` periódico para no hinchar el disco.
- **Git:** rama `main` estable; ramas `feat/<fase>` por trabajo; commits pequeños y descriptivos.
- **Editor:** VS Code + WSL/Remote-SSH; en remoto, sobre Tailscale.
- **Rutas:** el repo vive en `~/proyectos/tfg-ciberconciencia` (disco Linux, no `/mnt/c`).
- **Autoría (REGLA ESTRICTA):** todos los commits son exclusivamente de Javier Saguar <javisaguarantona@gmail.com>. **Ningún agente de IA debe figurar como autor ni co-autor**: prohibido añadir `Co-Authored-By`, "Generated with", "Assisted by" o cualquier atribución similar en mensajes de commit, PRs o código. Ninguna IA debe ejecutar `git commit`/`git push` de forma autónoma; los comandos se proponen y los ejecuta Javier. Guardián técnico: hook `.githooks/commit-msg` (activar tras clonar con `git config core.hooksPath .githooks`).

## 4. Estado actual
- **Fase:** **F2 CERRADA** (30-07-2026, con pendientes reubicados y anotados en el roadmap). **F3 (Pilar A, CEP) arrancando por F3.1.**
- **Hecho:** matriz de cobertura ATT&CK (300 técnicas / 2.301 reglas, 34 observadas, 11,3 % activación). MLflow con 10 experimentos de ML-1 (Isolation Forest, Random Forest, variantes SMOTE); control de volumen (AUC 0,941) fijado como línea base permanente para F7. Laboratorio de emulación operativo en VirtualBox y **dataset final generado**: 14.895 eventos (14.765 benignos / 130 maliciosos), 4 técnicas, tres fuentes de contaminación identificadas y filtradas.
- **Pendientes reubicados al cerrar F2:** validación cruzada evaluador-vs-SQL → F7 · autoencoder y modelo secuencial → F3.3/F7 (🟢) · publicación en `det.anomalies` → F3.3 · integración del dataset del laboratorio en ML-1 (requiere ruta CSV → OCSF, hoy inexistente).
- **Deuda de reproducibilidad:** los scripts de `emulation/` en el repo son la versión **previa** a las tres correcciones de contaminación, y `run-lab.ps1` solo existe dentro de la VM (`C:\Lab`). Pendiente copiarlos a `\\VBOXSVR\Shared` → `emulation/`.
- **Siguiente:** F3.1 — inventario de materia prima en `tfg.alerts` (¿están detectadas las 7 variantes de LSASS_campaign?), verdad conocida de apt29 a partir de `apt29.xlsx`, y diseño de P1 sobre el esquema de alerta **real**.


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

- **Cierre del dataset (30-07, tarde):** ejecutado `run-lab.ps1 -BenignMinutes 180` sin errores (comprobaciones previas, energía, logs ampliados, todo en verde). Dataset final: 14.895 eventos (14.765 benigno / 130 malicioso), 4 técnicas (T1547.001=86, T1003.001=26, T1055=10, T1070=8). Detectada y corregida una tercera fuente de contaminación tras revisión del fichero real: `svchost.exe` escribiendo telemetría de compatibilidad de aplicaciones (`InventoryApplicationFile`) durante las ventanas de ataque — 16 filas, ya filtradas en `label_dataset.py`. Verificada diversidad real: T1547.001 con 19 subtests distintos y 48 líneas de comando distintas. Documentado como limitación conocida: pico de 5.528 eventos benignos en la ventana 10:30-11:00 por instalación real de Windows Update en segundo plano — ruido de sistema legítimo, no atribuible al generador de actividad simulada, relevante para el análisis de "volumen como artefacto" ya identificado en ML-1.### 2026-07-30 (2) — Armonización de plan y memoria + arranque de F3.1
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
