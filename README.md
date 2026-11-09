# Angrep · seguimiento personal

App web instalable (PWA) para peso, alimentación y entrenamientos. Funciona sin conexión; los datos se guardan primero en el dispositivo.

**Estado: fase 9 en curso (versión 0.9.1).** Fase 1:  menús y secciones, almacenamiento local con modelo de datos sincronizable, respaldo JSON (exportar e importar sin duplicar), perfil, bloqueo con PIN y código de recuperación, tema claro/oscuro/automático, funcionamiento sin conexión y buscador de actualizaciones. 
**Fase 2 · Peso:** registro diario con foto opcional (editar, eliminar con «Deshacer»), pasos con meta, racha y gráfico de columnas, medidas por zona con gráfico, fotos de progreso (solo en el dispositivo) con comparación antes/después, progreso con promedio de 7 días, línea de plan, proyección a tu ritmo y mes contra mes, objetivo de peso con ritmo necesario (kg/semana y kcal/día estimadas) y objetivos cortos. 
**Fase 3 · Alimentación:** registro por comida con kcal y macros (o solo totales del día), base propia de alimentos con favoritos y búsqueda sin conexión, copiar el día anterior, alta de alimentos desde la foto de la etiqueta (la foto acompaña al formulario; la lectura automática aún no está) con chequeo de coherencia kcal vs. macros, importación de alimentos desde JSON, objetivo de kcal calculado (Mifflin-St Jeor y ritmo en kg por semana) o escrito a mano, meta de macros, progreso por día y semana con lo que dice tu consumo frente a tu peso real, y cumplimiento con rachas. 

**Fase 4 · Entrenamientos:** ejercicios propios con máximo y descanso, rutina semanal (kilos fijos, % del máximo o sugerencia automática), sesión en vivo (temporizador de descanso, borrador que sobrevive a cerrar la app) o registro rápido (`3x5@80`), récords, 1RM estimado, tonelaje semanal, proyección, historial con deshacer, y cardio/otras actividades con minutos y km por semana. El Cumplimiento de entrenos y general muestran en qué fase llegan.
**Fase 8 · Sincronización:** PC y iPhone al día con tu propio proyecto de Firebase (correo y contraseña + Firestore, por REST, sin librerías). Se configura en Ajustes y datos → Sincronización pegando el `firebaseConfig`. Gana el cambio más reciente, lo borrado se borra en todos, sincroniza solo (al cambiar datos, al volver la conexión, al abrir la app y cada 5 min) y sin conexión queda pendiente. Fotos y documentos no se sincronizan. Reglas de seguridad en `firestore.rules`. **Probada solo contra un Firebase simulado**, no contra uno real.
**Diseño Angrep (fase 9):** paleta A turquesa + oro en modo claro y oscuro, logo del toro (modelo 5, versiones clara y oscura en `logo/`), ícono oscuro en `icons/`, bordes muy redondeados, botones en píldora, menú inferior con la pestaña activa rellena y menú lateral fijo de 248 px en el computador, gráficos en turquesa y oro. Falta de los bocetos: Inicio como lista, selector de número tipo rueda, tono «de entrenador» en los avisos y Inter incluida como respaldo.
**Acceso y seguridad (fase 9, en curso):** antes de mostrar nada la app pide **Entrar** o **Crear cuenta** (correo y contraseña de 8+ caracteres, Firebase Authentication), con «Olvidé mi contraseña». Una cuenta nueva verifica su correo y queda **en espera hasta que el administrador la apruebe** (Ajustes y datos → **Accesos**: aprobar, rechazar o quitar acceso). Sin aprobación no entra a la app ni guarda nada en la nube. El administrador es quien tiene el correo `adminEmail` de `js/firebase-config.js` (y el mismo correo dentro de `firestore.rules`, que es lo que de verdad lo hace cumplir). Cada cuenta lee y escribe solo lo suyo (reglas por uid, formato validado, sin borrar, hora del servidor). Si alguien entra con otra cuenta en un dispositivo con datos de la anterior, la app pide confirmar y borra lo local. La `apiKey` es pública por diseño: protegerla = restringirla en Google Cloud (abajo). El acceso es una barrera de pantalla: los datos guardados en el dispositivo no se cifran.
**Pendiente de esta base:** Face ID / huella (se agrega después), pulido y publicación (fase 9).

## Probarla
- **Computador:** en esta carpeta, `python -m http.server 8123` y abrir http://localhost:8123. (Con doble clic en `index.html` también abre, pero el modo sin conexión no funciona y el PIN puede no estar disponible: necesitan `https` o `localhost`.)
- **iPhone:** hay que publicarla en `https` (GitHub Pages, Netlify…). Safari → Compartir → Agregar a pantalla de inicio.

## Archivos
| Archivo | Para qué |
|---|---|
| `index.html`, `styles.css` | Página y estilos. Los colores están como variables en `:root` (sección «Tokens»). |
| `js/util.js` | Fechas, números, ids, promedio móvil |
| `js/food.js` | Cálculos de alimentación: gasto, kcal y macros objetivo, totales por día, cumplimiento, importación JSON |
| `js/calc.js` | Cálculos de peso: tendencia, ajuste lineal de 28 días, proyección, ritmo necesario, objetivos cortos, pasos |
| `js/charts.js` | Gráficos SVG propios (línea y columnas) con tooltip, teclado y tabla equivalente |
| `js/photos.js` | Fotos en IndexedDB (reducidas a 1280 px), solo en el dispositivo |
| `js/views-common.js` | Piezas comunes de pantallas (cifras, deshacer, chips, barras de avance) |
| `js/views-peso.js` | Pantallas de Peso: registro, pasos, medidas y fotos, progreso, objetivo |
| `js/views-comida.js`, `js/views-comida-meta.js` | Pantallas de Alimentación: registro, alimentos, objetivos, progreso, cumplimiento |
| `js/schema.js` | Tipos de registro y validación |
| `js/store.js` | Almacén local, mezcla de datos (gana el más reciente) |
| `js/backup.js` | Respaldo JSON; reconoce el respaldo de Halterofilia (importación: fase 5) |
| `js/lock.js`, `js/lock-ui.js` | PIN con huella PBKDF2, espera tras fallos, código de recuperación; pantalla de bloqueo |
| `js/nav.js`, `js/shell.js` | Mapa de menús y rutas (`#/menú/sub/sección`); estructura de pantalla |
| `js/views-datos.js` | Inicio y Ajustes y datos |
| `js/ui.js`, `js/app.js` | Componentes comunes; arranque y actualizaciones |
| `sw.js`, `manifest.webmanifest`, `version.js`, `icons/` | Sin conexión e instalación |
| `MODELO-DE-DATOS.md` | Entidades, ids y reglas de conflicto |
| `tests/unit.js`, `tests/e2e.js`, `tests/e2e-peso.js`, `tests/e2e-comida.js` | Pruebas (las tres últimas necesitan `playwright`) |

## Pruebas
```
node tests/unit.js   # lógica: fechas, almacén, mezcla, respaldo, PIN, rutas
node tests/e2e.js    # navegador real: menús, perfil, respaldo, PIN, tema, sin conexión, celular y computador
node tests/e2e-peso.js   # navegador real: Peso completo (SHOTS=carpeta guarda capturas)
node tests/e2e-comida.js # navegador real: Alimentación completa
```

## Publicar cambios
Sube la versión en `version.js` (`n` visible y `v` con fecha). Sin eso nadie ve «Hay una versión nueva». Si se agrega un servicio externo (Firebase), hay que permitirlo en la política de seguridad (CSP) de `index.html`.

**Fase 5 · Importar Halterofilia:** Ajustes y datos → Importar Halterofilia. Acepta el respaldo personal (JSON) o el historial (CSV), muestra qué trae antes de guardar y no duplica al reimportar (lo borrado a propósito tampoco vuelve). Trae sesiones, ejercicios con máximos y metas (se unen por nombre con los que ya tienes), rutina semanal (con opción de reemplazar la tuya) y peso corporal. No trae la semana del entrenador ni el plan anual (Excel: pendiente).

**Fase 6 · Cumplimiento e Inicio:** Inicio muestra lo de hoy (peso y tendencia, kcal y proteína que te quedan, pasos, sesión planificada con botón para empezar), avisos (sin peso hoy, sin comidas, sin respaldo hace 14 días), resumen de la semana y rachas. Cumplimiento de Peso (racha de pesaje, 30 días, pasos en meta, objetivos cortos) y de Halterofilia y Pesas (sesiones hechas vs planificadas por semana, estado de cada día, racha de semanas, % de las últimas 4 semanas). Se compara con la rutina actual y no se cuentan las semanas anteriores a tu primera sesión.

**Fase 7 · Documentos y exportación:** Ajustes y datos → Documentos. Exporta a Excel (CSV con «;» y coma decimal) peso, pasos, medidas, comidas, entrenamientos por serie y cardio, por periodo. Informe PDF (peso con gráfico, pasos, alimentación, entrenamientos con récords, rutinas) generado en el dispositivo sin librerías. Guarda tus propios documentos (PDF, Excel, Word, imágenes; hasta 25 MB) solo en este dispositivo; no entran al respaldo. Leer un Excel para importar un plan sigue pendiente (necesita una librería).

## Seguridad: pasos en Firebase / Google Cloud (una vez)
1. **Reglas:** pegar `firestore.rules` en Firestore → Reglas → Publicar (el correo permitido está dentro del archivo).
2. **Restringir la apiKey:** console.cloud.google.com → proyecto `angrep` → APIs y servicios → Credenciales → «Browser key» → Restricciones de aplicación: **Sitios web** → agregar `https://balahx.github.io/*` y, para pruebas en el PC, `http://localhost:8123/*`. Restricciones de API: solo **Identity Toolkit API**, **Token Service API** y **Cloud Firestore API**.
3. **Authentication → Configuración → Dominios autorizados:** agregar `balahx.github.io`.
4. **Authentication → Método de acceso:** «Correo/contraseña» activado (permite crear cuentas desde la app). Para dejar de aceptar registros nuevos, desactiva el registro de usuarios (requiere Identity Platform) o publica unas reglas más cerradas.
5. **Cuota:** el plan gratuito de Firestore alcanza de sobra para pocas personas; revisa Uso en la consola de vez en cuando.


## Plan del entrenador (fase 9)
- **Administrador:** Ajustes y datos → *Plan del entrenador*: cargas el Excel (planilla del entrenador o plantilla simple), revisas la vista previa y publicas. La lectura usa `js/xlsx-lite.js` (sin librerías) y `js/plan-import.js` (el mismo lector de la app Halterofilia).
- **Quién lo ve:** Ajustes y datos → *Accesos* → casilla «Plan del entrenador» en cada cuenta. El administrador siempre lo ve. Reglas en `firestore.rules` (`canPlan`): publica de nuevo las reglas tras actualizar.
- **Firebase:** 2 documentos, `config/plan` (versión, chico) y `plans/data` (el plan comprimido, ~20 KB). Cada dispositivo lo baja una vez y lo guarda; solo vuelve a leer si cambia la versión (máx. una comprobación cada 6 horas). Sin conexión se sigue viendo la copia guardada. Si se quita el acceso, la copia se borra cuando la app vuelve a comprobarlo.
- **Cuentas con acceso:** Entrenamientos → Halterofilia → *Entrenador*: eliges etapa y semana, ves los kilos con tus máximos y puedes usar la semana como tu rutina.
- Prueba: `node tests/e2e-plan.js`.
