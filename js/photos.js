/* Fotos de progreso: se guardan SOLO en este dispositivo (IndexedDB), reducidas a 1280 px y JPEG para no llenar el espacio.
   En los datos (que sí se respaldan y sincronizan) queda solo la ficha: fecha, tipo, nota y la clave del archivo. */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};
  const U = A.util, store = A.store;
  const DB = 'appseg-files', ST = 'blobs', MAX_SIDE = 1280, QUALITY = 0.8, MAX_INPUT = 40 * 1024 * 1024;
  const TAGS = [['frente', 'Frente'], ['lado', 'Lado'], ['espalda', 'Espalda'], ['otra', 'Otra']];
  let dbp = null;

  function open() {
    if (!root.indexedDB) return Promise.reject(new Error('Este navegador no permite guardar fotos aquí.'));
    return dbp || (dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => { r.result.createObjectStore(ST); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => { dbp = null; rej(new Error('No se pudo abrir el almacén de fotos.')); };
    }));
  }
  const tx = (mode, fn) => open().then(db => new Promise((res, rej) => {
    const t = db.transaction(ST, mode), out = fn(t.objectStore(ST));
    t.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
    t.onerror = t.onabort = () => rej(t.error || new Error('Error al guardar la foto.'));
  }));
  const putBlob = (key, blob) => tx('readwrite', s => s.put(blob, key));
  const getBlob = key => tx('readonly', s => s.get(key));
  const delBlob = key => tx('readwrite', s => s.delete(key));
  const clearAll = () => tx('readwrite', s => s.clear()).catch(() => {});

  /* Lee la imagen (respetando la orientación del celular), la reduce y la devuelve como JPEG */
  async function shrink(file) {
    if (!file || !/^image\//.test(file.type || '')) throw new Error('El archivo no es una imagen.');
    if (file.size > MAX_INPUT) throw new Error('La imagen es demasiado grande (máx. 40 MB).');
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (e) { try { bmp = await createImageBitmap(file); } catch (e2) { throw new Error('No se pudo leer la imagen. Prueba con una foto JPG o PNG.'); } }
    const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height)), w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(bmp, 0, 0, w, h);
    if (bmp.close) bmp.close();
    const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', QUALITY));
    if (!blob) throw new Error('No se pudo procesar la imagen.');
    return { blob: blob, w: w, h: h };
  }

  /* Guarda una foto: archivo + ficha. Si algo falla no queda nada a medias. */
  async function add(file, info) {
    const r = await shrink(file), key = 'ph_' + U.uid();
    await putBlob(key, r.blob);
    try { return store.save('photo', { date: info.date, tag: info.tag || 'otra', note: info.note || '', blobKey: key, w: r.w, h: r.h, bytes: r.blob.size }); }
    catch (e) { await delBlob(key).catch(() => {}); throw e; }
  }
  async function remove(id) {
    const p = store.get('photo', id); if (!p) return false;
    store.remove('photo', id); await delBlob(p.blobKey).catch(() => {});
    return true;
  }
  const list = () => store.list('photo').sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : b.updatedAt - a.updatedAt);
  /* Dirección temporal para mostrar la foto (hay que liberarla con URL.revokeObjectURL) */
  async function url(blobKey) { const b = await getBlob(blobKey); return b ? URL.createObjectURL(b) : null; }

  /* «Borrar todos los datos» también borra las fotos */
  store.on(e => { if (e.type === 'wipe') clearAll(); });
  /* Pide al navegador que no borre los datos del sitio cuando falte espacio (iPhone lo puede hacer si no se usa la app) */
  const keepStorage = () => { try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* no es esencial */ } };

  A.photos = { TAGS, add, remove, list, url, clearAll, keepStorage, blob: { put: putBlob, get: getBlob, del: delBlob } };
})(window);
