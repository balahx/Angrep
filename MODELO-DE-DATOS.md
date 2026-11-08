# Modelo de datos · Seguimiento personal (v1)

Código: `js/schema.js` (reglas) y `js/store.js` (almacén). Todo se guarda primero en el dispositivo.

## Reglas generales
- Todo registro lleva `id`, `updatedAt` (ms) y `deviceId`. El borrado es lógico (`deleted: true`) para poder sincronizar.
- **Conflictos:** gana el registro con `updatedAt` más reciente (en respaldo y, después, en la sincronización con Firebase).
- **Tipos diarios** (`weight`, `steps`, `nutriday`): el id es fijo por fecha (`weight_2026-11-07`). Dos dispositivos no pueden crear el mismo día dos veces; guardar de nuevo el día lo actualiza.
- Fechas `AAAA-MM-DD` en hora local. Números con punto decimal dentro de los datos; la pantalla acepta coma.
- **Dos áreas de almacenamiento:** `data` (se respalda y se sincroniza: perfil + registros) y `local` (solo este dispositivo: id del dispositivo, tema, PIN, fecha de última copia).
- Tipos con `synced: false` no viajan en respaldos ni sincronización: `photo`, `doc`, `importlog`. Los archivos (fotos, documentos) irán en IndexedDB del dispositivo; aquí solo queda su ficha.

## Perfil (un solo registro)
`name`, `birth`, `sex` (M/F), `heightCm`, `activity` (sedentario, ligero, moderado, alto, muyalto). Base del cálculo de kcal (fase 3).

## Registros
| Tipo | Campos principales | Notas |
|---|---|---|
| `weight` (diario) | `date`, `kg` 20–400, `note` | Un peso por día. Promedio de 7 días se calcula, no se guarda. |
| `steps` (diario) | `date`, `count` entero 0–200000 | Ingreso manual. |
| `measure` | `date`, `site` (cintura, cadera, pecho, brazo, muslo, cuello, pantorrilla), `cm` | Sin % de grasa. |
| `goal` | `kind` (weight, steps, kcal, macros, sessions), `target`, `targetDate?`, `startDate?`, `startValue?`, `parentId?` | `parentId` enlaza objetivos cortos con la meta mayor. |
| `food` | `name`, `unit`, `amount`, `kcal`, `p?`, `c?`, `f?`, `fav?` | Base propia de alimentos. |
| `meal` | `date`, `slot` (desayuno, almuerzo, once, cena, colacion), `name`, `kcal`, `p?`, `c?`, `f?`, `foodId?` | Registro por comida. |
| `nutriday` (diario) | `date`, `kcal`, `p?`, `c?`, `f?` | Modo rápido: totales del día (macros en gramos). |
| `exercise` | `name`, `discipline`, `meas` (kg, reps, time, distance), `max?`, `maxDate?`, `goal?`, `goalDate?`, `rest?` | `discipline`: halterofilia, pesas, cardio, otro. |
| `plan` | `name`, `discipline`, `kind` (weekly, cycle), `days[]`/`weeks[]` | Plan semanal o por ciclos. |
| `session` | `discipline`, `date`, `mode` (live, quick), `items[]`, `rpe?`, `notes?`, `startedAt?`, `endedAt?`, `source?`, `srcKey?` | `items`: `{ exId, rest, sets:[{ kg, reps, pct, rpe, done, miss, secs, dist }] }`. `srcKey` evita duplicados al importar (p. ej. `hal:<id de la sesión>`). |
| `photo` (local) | `date`, `tag`, `note`, `blobKey` | Solo en el dispositivo donde se subió. |
| `doc` (local) | `name`, `kind`, `size`, `mime`, `blobKey` | Rutinas y planes cargados. |
| `importlog` (local) | `source`, `at`, `summary` | Bitácora de importaciones. |

## Cómo usa la fase 2 estos registros
- `goal` principal de peso: id fijo `goal_main_weight` (`kind: weight`, `target`, `targetDate`, `startDate`, `startValue`). Meta de pasos: id `goal_steps` (`kind: steps`, `target`). Objetivos cortos: `kind: weight` con `parentId: goal_main_weight`; se generan en línea recta desde hoy hasta la meta (cada 7, 14 o 28 días, máx. 26) y se evalúan con la tendencia de 7 días.
- `measure`: un registro por día y zona (guardar de nuevo el mismo día y zona actualiza).
- `photo`: la imagen vive en IndexedDB (`appseg-files`/`blobs`, JPEG máx. 1280 px) y el registro guarda solo `blobKey`; no entra al respaldo ni se sincroniza.
- Cálculos que no se guardan: promedio de 7 días, ajuste lineal de 28 días (mínimo 5 pesos en 14 días), proyección, ritmo necesario (7.700 kcal ≈ 1 kg), rachas.

## Cómo usa la fase 3 estos registros (hecho, versión 0.3.0)
- **`food` (base propia):** `name`, `unit` (g, ml, porción, unidad), `amount` (cantidad a la que se refieren los valores, p. ej. 100 g), `kcal`, `p`, `c`, `f` (opcionales), `fav`, `source` (`manual`, `foto` o `json`). Nombre único sin importar tildes ni mayúsculas.
- **`meal`:** `date`, `slot`, `name`, `kcal`, `p?`, `c?`, `f?`, y para mostrar y recalcular `qty`, `unit` y `foodId` (los valores guardados ya están calculados para la cantidad; si luego se edita o borra el alimento, la comida no cambia).
- **`nutriday` (totales rápidos):** solo cuenta si ese día no tiene comidas. Si hay comidas, valen las comidas.
- **Metas:** `goal_kcal` (`kind: kcal`, `target`, `mode`: `auto` o `manual`, `rate` en kg/semana) y `goal_macros` (`kind: macros`, `p`, `c`, `f` en gramos y `target` = kcal que suman).
- **Cálculos que no se guardan** (`js/food.js`): basal Mifflin-St Jeor (10·kg + 6,25·cm − 5·edad ± 5/161), gasto = basal × factor de actividad, objetivo = gasto + ritmo × 7.700 / 7 (avisa bajo el basal o sobre 1 kg/semana o 1 % del peso); macros sugeridos = proteína 1,8 g/kg, grasa 25 % de las kcal, resto carbohidratos; coherencia de etiqueta (4·P + 4·C + 9·G, margen de 15 kcal o 20 %); día en meta = kcal a ±10 % del objetivo y proteína al 90 % de su meta (si hay macros).
- **Importar alimentos desde JSON:** lista `[{nombre, unidad, cantidad, kcal, p, c, f}]` o `{alimentos: [...]}`; omite repetidos por nombre y explica las filas con error.

## Cómo usa la fase 4 estos registros (hecho, versión 0.4.0)
- `exercise`: `{name, discipline, meas:'kg', max, maxDate, rest}`.
- `plan`: uno por disciplina `{name, discipline, kind:'weekly', days:[{id, name, dow(0=dom), items:[{exId, sets, reps, pct|kg}]}]}`.
- `session`: `{discipline, date, mode:'live'|'quick', items:[{exId, name, rest, sets:[{kg, reps, done}]}], rpe, notes, startedAt, endedAt, dayName}`. Cardio: `discipline:'cardio'`, `items:[{activity, minutes, km, kcal}]`.
- Borrador de sesión en curso: área local `draft_<disciplina>` (no se sincroniza).
- Cálculos: 1RM Epley (≤12 reps), tonelaje = Σ kg×reps de series hechas, sugerencia +2,5 kg si logró las reps con RPE ≤ 9.

## Cómo usa la fase 5 estos registros (hecho, versión 0.5.0)
Su respaldo personal es `{ v, profile, exercises[], plan:{days[]}, sessions[] }`; el CSV trae fecha, sesión, ejercicio, serie, kg, repeticiones, %, RPE, duración. **No viene:** la semana del entrenador ni el plan anual (nube del equipo; el plan anual se cargaría desde Excel, pendiente).
- Sesiones importadas: `id 'hal_<id>'`, `source:'halterofilia'`, `srcKey:'hal:<id>'` (CSV: `halcsv:<fecha>|<sesión>`). Solo las terminadas. Series hechas `done:true`; fallidas `done:false, miss:true` (no suman tonelaje). Reps como «1+1» se suman. `rpe` de sesión = promedio de las series.
- Ejercicios: `hal_<id>` con `cat`, `goal`, `goalDate`; si ya tienes uno con el mismo nombre se usa ese y solo se completa el máximo si no tenía. El catálogo base sin uso ni máximo no se trae.
- Rutina: índice 0 de Halterofilia = lunes → `dow = (i+1) % 7`. Un solo plan por disciplina; si existe, se omite salvo «Reemplazar».
- Peso: `bwLog` → `weight` (fecha ya existente se omite). Perfil: solo nombre y sexo si faltaban.
- Bitácora local `importlog` con el resumen.

## Cómo usa la fase 6 estos registros (hecho, versión 0.6.0)
No agrega tipos nuevos; solo calcula (`js/compliance.js`):
- **Semana de entrenos:** planificados = días de la rutina con ejercicios; hechos = sesiones de esa semana (lunes a domingo), también en días no planificados. Semana cumplida = hechos ≥ planificados. En la semana en curso el % se mide contra los días planificados que ya pasaron. Racha = semanas cumplidas seguidas (la semana en curso suma si ya cumplió, pero no corta si aún no).
- **Pesaje:** racha de días seguidos con peso (hoy sin registrar no la corta) y % de los últimos 30 días.
- **Inicio:** kcal restantes = objetivo − comidas de hoy (el gasto de cardio se muestra aparte, no se descuenta).

## Cómo usa la fase 7 estos registros (hecho, versión 0.7.0)
- `doc` (solo local): `name`, `kind` (rutina, plan, otro), `size`, `mime`, `date`, `blobKey`. El archivo vive en IndexedDB (`appseg-files`/`blobs`, igual que las fotos), máx. 25 MB; «Borrar todos los datos» lo borra también. No entra al respaldo JSON ni a la sincronización.
- CSV: separador `;`, coma decimal, UTF-8 con BOM, CRLF; los textos que empiezan con `= + - @` llevan un apóstrofe delante para que Excel no los tome como fórmula.
- PDF: se arma en el dispositivo (`js/pdf.js`, Helvetica estándar). Las kcal de cardio no se mezclan con el balance de comida.


## Cómo usa la fase 8 estos registros (hecho, versión 0.8.0)
- Nube: `users/{uid}/records/{tipo}__{id}` (perfil: clave `profile`) con `{t: tipo, d: JSON del registro, u: updatedAt (entero), del: borrado, at: hora del servidor}`. `at` lo pone Firestore (`REQUEST_TIME`) y sirve para pedir solo lo cambiado (`at >=` cursor, páginas de 500; subida en lotes de 400).
- Gana el `updatedAt` más reciente (igual que el respaldo). Los borrados viajan como `deleted:true` (no se elimina el documento; las reglas lo prohíben).
- Estado local (área local, **no entra al respaldo**): `sync` `{known{clave:u}, pullAt, uid, lastRun, lastOk, error, pulled, pushed}` para no re-subir lo que la nube ya tiene; `syncCfg` (apiKey, projectId), `syncAuth` (uid, correo, refresh token; sin cifrar en el dispositivo), `syncAuto`, `syncLastEmail`. Si cambia la cuenta, `known` y `pullAt` se reinician.
- No se sincronizan: `photo`, `doc`, `importlog` (solo locales) ni los borradores.
- Se ignoran registros con `updatedAt` más de 10 min en el futuro o que no sean JSON válido.
- Reglas: `firestore.rules` (solo el dueño lee/crea/actualiza; claves permitidas `t,d,u,del,at`; sin delete).
