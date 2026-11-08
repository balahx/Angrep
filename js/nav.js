/* Mapa de menús y secciones. Cada sección dice en qué fase se construye y qué incluirá.
   Las secciones sin pantalla propia muestran esa descripción (estado «pendiente»). */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};
  const sec = (id, label, phase, items) => ({ id: id, label: label, phase: phase, items: items || [] });

  const MENUS = [
    { id: 'inicio', label: 'Inicio', short: 'Inicio', icon: 'home', phase: 6,
      items: ['Peso de hoy y tendencia', 'Kcal y macros restantes', 'Pasos y entrenamiento del día', 'Resumen de la semana y rachas'] },
    { id: 'peso', label: 'Peso', short: 'Peso', icon: 'scale', sections: [
      sec('registro', 'Registro', 2, ['Peso del día (diario) con foto opcional, también después', 'Promedio móvil de 7 días']),
      sec('pasos', 'Pasos', 2, ['Pasos por día, a mano', 'Meta diaria, cumplimiento y racha']),
      sec('medidas', 'Medidas y fotos', 2, ['Cintura, cadera, pecho, brazo, muslo', 'Fotos antes/después guardadas solo en este dispositivo']),
      sec('progreso', 'Progreso', 2, ['Tendencia, mes contra mes', 'Proyección a la fecha meta (con kcal)']),
      sec('objetivo', 'Objetivo', 2, ['Peso meta y fecha', 'Objetivos cortos que acerquen a la meta']),
      sec('cumplimiento', 'Cumplimiento', 6, ['Objetivos cortos logrados', 'Rachas y % del mes'])
    ] },
    { id: 'comida', label: 'Alimentación', short: 'Comida', icon: 'food', sections: [
      sec('registro', 'Registro', 3, ['Comidas del día con kcal (o macros del día)', 'Favoritas y copiar el día anterior']),
      sec('alimentos', 'Alimentos', 3, ['Base propia sin conexión', 'Agregar desde la foto de la etiqueta']),
      sec('objetivos', 'Objetivos', 3, ['Kcal calculadas según tus datos y ajustables', 'Meta de macros en gramos']),
      sec('progreso', 'Progreso', 3, ['Kcal y macros por día y semana', 'Proyección de kcal']),
      sec('cumplimiento', 'Cumplimiento', 3, ['Días dentro de la meta de kcal y macros', 'Rachas'])
    ] },
    { id: 'entrenos', label: 'Entrenamientos', short: 'Entrenos', icon: 'dumbbell', subs: [
      { id: 'halterofilia', label: 'Halterofilia', sections: [
        sec('hoy', 'Sesión', 4, ['Sesión en vivo con temporizador de descanso', 'Registro rápido después de entrenar']),
        sec('plan', 'Plan', 4, ['Seguir la planificación semanal', 'Kilos desde tus máximos']),
        sec('progreso', 'Progreso', 4, ['Máximos, 1RM estimado y récords', 'Tonelaje, volumen, RPE y carga']),
        sec('cumplimiento', 'Cumplimiento', 6, ['Sesiones hechas vs planificadas']),
        sec('historial', 'Historial', 4, ['Sesiones anteriores', 'Importar desde la app Halterofilia (fase 5)'])
      ] },
      { id: 'pesas', label: 'Pesas', sections: [
        sec('hoy', 'Sesión', 4, ['Sesión en vivo o registro rápido']),
        sec('plan', 'Plan', 4, ['Rutina semanal', 'Proyección de pesos según tu avance']),
        sec('progreso', 'Progreso', 4, ['Tonelaje, volumen, 1RM estimado y récords']),
        sec('cumplimiento', 'Cumplimiento', 6, ['Sesiones hechas vs planificadas']),
        sec('historial', 'Historial', 4, ['Sesiones anteriores'])
      ] },
      { id: 'cardio', label: 'Cardio y otros', sections: [
        sec('hoy', 'Registro', 4, ['Tiempo y distancia', 'Otros deportes o actividades']),
        sec('progreso', 'Progreso', 4, ['Tiempo y distancia por semana']),
        sec('historial', 'Historial', 4, ['Actividades anteriores'])
      ] }
    ] },
    { id: 'datos', label: 'Ajustes y datos', short: 'Datos', icon: 'data', sections: [
      sec('perfil', 'Perfil', 1),
      sec('seguridad', 'Seguridad', 1),
      sec('respaldo', 'Respaldo', 1),
      sec('halterofilia', 'Importar Halterofilia', 5),
      sec('apariencia', 'Apariencia', 1),
      sec('documentos', 'Documentos', 7, ['Cargar y descargar rutinas y planes (PDF o Excel)', 'Exportar a CSV y PDF']),
      sec('sync', 'Sincronización', 8, ['Mantener PC e iPhone al día con Firebase', 'Funciona sin conexión y se pone al día al volver internet']),
      sec('acerca', 'Acerca de', 1)
    ] }
  ];

  const byId = (arr, id) => arr.filter(x => x.id === id)[0];
  /* '#/entrenos/pesas/plan' → { menu, sub, section, path } con los valores por defecto cuando faltan */
  function resolve(hash) {
    const parts = String(hash || '').replace(/^#?\/?/, '').split('/').filter(Boolean);
    const menu = byId(MENUS, parts[0]) || MENUS[0];
    let sub = null, sections = menu.sections || null, i = 1;
    if (menu.subs) { sub = byId(menu.subs, parts[1]) || menu.subs[0]; sections = sub.sections; i = 2; }
    const section = sections ? (byId(sections, parts[i]) || sections[0]) : null;
    const path = '#/' + menu.id + (sub ? '/' + sub.id : '') + (section ? '/' + section.id : '');
    return { menu: menu, sub: sub, section: section, path: path, key: menu.id + (sub ? '/' + sub.id : '') + (section ? '/' + section.id : '') };
  }
  const href = (menu, sub, section) => '#/' + menu + (sub ? '/' + sub : '') + (section ? '/' + section : '');

  A.nav = { MENUS, resolve, href };
  if (typeof module !== 'undefined' && module.exports) module.exports = A.nav;
})(typeof window !== 'undefined' ? window : globalThis);
