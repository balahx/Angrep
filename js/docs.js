/* Documentos del usuario (fase 7): rutinas, planes y otros archivos guardados solo en este dispositivo (IndexedDB).
   La ficha (`doc`) no viaja en respaldos ni sincronización; el archivo tampoco. */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};
  const U = A.util, store = A.store;
  const KINDS = [['rutina', 'Rutina'], ['plan', 'Plan'], ['otro', 'Otro']], MAX = 25 * 1024 * 1024;
  const OK_EXT = ['pdf', 'xlsx', 'xls', 'csv', 'docx', 'doc', 'txt', 'json', 'png', 'jpg', 'jpeg', 'heic', 'webp', 'md'];
  const extOf = n => (/\.([a-z0-9]+)$/i.exec(String(n || '')) || [, ''])[1].toLowerCase();
  const sizeText = b => b < 1024 ? b + ' B' : b < 1048576 ? U.fmtNum(b / 1024, 0) + ' KB' : U.fmtNum(b / 1048576, 1) + ' MB';
  async function add(file, kind) {
    if (!file) throw new Error('Elige un archivo.');
    if (OK_EXT.indexOf(extOf(file.name)) < 0) throw new Error('Ese tipo de archivo no se admite. Sirven: PDF, Excel, CSV, Word, texto e imágenes.');
    if (!file.size) throw new Error('El archivo está vacío.');
    if (file.size > MAX) throw new Error('El archivo es demasiado grande (máx. 25 MB).');
    const key = 'doc_' + U.uid(); await A.photos.blob.put(key, file);
    try { return store.save('doc', { name: String(file.name).slice(0, 200), kind: KINDS.some(k => k[0] === kind) ? kind : 'otro', size: file.size, mime: file.type || '', date: U.today(), blobKey: key }); }
    catch (e) { await A.photos.blob.del(key).catch(() => {}); throw e; }
  }
  const list = () => store.list('doc').sort((a, b) => b.updatedAt - a.updatedAt);
  async function remove(id) { const d = store.get('doc', id); if (!d) return false; store.remove('doc', id); await A.photos.blob.del(d.blobKey).catch(() => {}); return true; }
  const blob = async id => { const d = store.get('doc', id); return d ? A.photos.blob.get(d.blobKey) : null; };
  A.docs = { KINDS, MAX, add, list, remove, blob, sizeText, extOf };
})(window);
