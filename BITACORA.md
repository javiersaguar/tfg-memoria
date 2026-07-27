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
| Extracción de TTPs | TRAM / SecureBERT (inferencia; LoRA ligero opcional) | Modelos pequeños/preentrenados |
| Uso de ML | Solo inferencia + fine-tuning ligero. NADA de entrenar modelos grandes | RTX 5070 Laptop (~8 GB): inferencia OK, entrenamiento pesado no |
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
- **Fase:** F2.2 — ML-1 (detección de anomalías) con primer resultado.
- **Hecho:** sink de alertas a ClickHouse (771). Cargados **105 datasets** (apt29 day1+day2 y ~102 atómicos): **1.224.849 eventos únicos, 25 hosts, 26 clases OCSF, 56 técnicas ATT&CK**, cobertura 99,2–99,6%. Extracción de características por ventana (29 features, 420 ventanas de 5 min). **Isolation Forest evaluado sobre apt29 day1 (excluido del entrenamiento): AUC-ROC 0,979** entrenando solo con ventanas limpias, frente a 0,933 asumiendo contaminación.
- **En curso:** cerrar sesión.
- **Siguiente:** prueba de robustez sin las señales precalculadas; registrar en MLflow; nivel por evento como comparación. Pendiente: laboratorio de emulación para generar datos propios con verdad conocida.


## 5. Estructura del repo
```
tfg-ciberconciencia/
├── BITACORA.md          # este archivo (memoria del proyecto)
├── AGENTS.md            # copia/enlace de esta bitácora para agentes que la auto-cargan (o CLAUDE.md)
├── README.md
├── .gitignore
├── docs/                # anteproyecto, planning, estudios, memoria
├── infra/               # docker-compose, perfiles, k8s/minikube
├── pipeline/            # ingesta, jobs Flink/CEP, normalización OCSF
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