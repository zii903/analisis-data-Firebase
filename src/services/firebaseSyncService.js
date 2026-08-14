import { ref, update } from 'firebase/database';
import { get, set } from 'idb-keyval';
import { db } from './firebaseConfig';

// Sanitasi kunci agar valid untuk Firebase Realtime Database
export function sanitizeFirebaseKey(key) {
  if (key === undefined || key === null || key === '') return 'UNKNOWN';
  return String(key)
    .replace(/[.#$/[\]]/g, '_')
    .trim();
}

/**
 * Sanitasi rekursif seluruh objek / array agar tidak ada key yang mengandung ., #, $, /, [, ]
 * yang dilarang oleh Firebase Realtime Database.
 */
export function sanitizeDataForFirebase(val) {
  if (val === null || val === undefined) {
    return null;
  }
  if (typeof val !== 'object') {
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(item => sanitizeDataForFirebase(item));
  }

  const result = {};
  for (const [k, v] of Object.entries(val)) {
    if (v === undefined) continue;
    const cleanKey = sanitizeFirebaseKey(k);
    result[cleanKey] = sanitizeDataForFirebase(v);
  }
  return result;
}

/**
 * Sinkronisasi data hasil parse Excel ke Firebase Realtime Database
 * dengan algoritma Diffing (hanya kirim data baru/berubah).
 */
export async function syncExcelToFirebase(filePath, rows, options = {}) {
  const startTime = performance.now();
  const safeId = filePath.replace(/[\/\\]/g, '_');
  const cacheStorageKey = `firebase_cache_${safeId}`;

  try {
    // 1. Ambil cache data sebelumnya dari IndexedDB
    const previousCache = (await get(cacheStorageKey)) || {};
    const newCache = {};
    const updates = {};

    let addedCount = 0;
    let updatedCount = 0;

    const rootCollection = options.collection || 'data_produksi';

    // 2. Diffing data baris demi baris
    rows.forEach((row, idx) => {
      // Tentukan primary key: gunakan material_key / pro_number / composite id
      const dailyObj = typeof row.daily_details === 'string' ? JSON.parse(row.daily_details) : row.daily_details;
      const excelRowIdx = dailyObj?.excel_row_index ?? idx;
      
      const rawKey = row.pro_number && !String(row.pro_number).startsWith('DRAFT-')
        ? `${row.machine_name || 'AREA'}_${row.pro_number}_${row.description || ''}_${excelRowIdx}`
        : `${row.machine_name || 'AREA'}_${row.customer || ''}_${row.description || ''}_${excelRowIdx}`;

      const sanitizedKey = sanitizeFirebaseKey(rawKey);

      // Bersihkan objek row dari properti yang mungkin undefined dan sanitasi seluruh key anak
      const rawCleanRow = {
        sheetName: row.sheetName || row.machine_name || '',
        machine_name: row.machine_name || '',
        pro_number: row.pro_number || '',
        status: row.status || 'UNPLAN',
        raw_status: row.raw_status || row.status || '',
        customer: row.customer || '',
        description: row.description || '',
        qty_order: Number(row.qty_order || 0),
        qty_produksi: Number(row.qty_produksi || 0),
        waktu_proses: Number(row.waktu_proses || 0),
        sub_machine: row.sub_machine || null,
        cycle_time: Number(row.cycle_time || 0),
        output_perjam: Number(row.output_perjam || 0),
        variant: Number(row.variant || 0),
        estimasi_sisa_waktu: Number(row.estimasi_sisa_waktu || 0),
        daily_details: row.daily_details || {},
        _updatedAt: Date.now()
      };

      // Pastikan seluruh sub-object (seperti daily_details) terbebas dari tanda '.' dll
      const cleanRow = sanitizeDataForFirebase(rawCleanRow);

      const recordFingerprint = JSON.stringify(cleanRow);
      newCache[sanitizedKey] = recordFingerprint;

      // Cek diffing
      if (!previousCache[sanitizedKey]) {
        // Data Baru
        updates[`${rootCollection}/${sanitizedKey}`] = cleanRow;
        addedCount++;
      } else if (previousCache[sanitizedKey] !== recordFingerprint) {
        // Data Berubah
        updates[`${rootCollection}/${sanitizedKey}`] = cleanRow;
        updatedCount++;
      }
    });

    const totalChanges = addedCount + updatedCount;

    // 3. Kirim ke Firebase Realtime Database jika ada perubahan data
    if (totalChanges > 0 || options.forceUpdateMeta) {
      const nowIso = new Date().toISOString();

      // Tambahkan metadata global
      updates['_metadata/lastSync'] = nowIso;
      updates['_metadata/fileName'] = filePath;
      updates['_metadata/totalRecords'] = rows.length;
      updates['_metadata/lastChangesCount'] = totalChanges;
      updates['_metadata/addedCount'] = addedCount;
      updates['_metadata/updatedCount'] = updatedCount;

      // Multi-path atomic update (1 request jaringan)
      await update(ref(db), updates);

      // Simpan snapshot cache baru ke IndexedDB
      await set(cacheStorageKey, newCache);
    }

    const duration = Math.round(performance.now() - startTime);

    return {
      success: true,
      total: rows.length,
      added: addedCount,
      updated: updatedCount,
      hasChanges: totalChanges > 0,
      duration,
      lastSync: new Date()
    };
  } catch (err) {
    console.error('[FirebaseSync] Gagal menyinkronkan data ke Firebase:', err);
    return {
      success: false,
      error: err.message,
      total: rows.length,
      added: 0,
      updated: 0,
      hasChanges: false,
      duration: Math.round(performance.now() - startTime),
      lastSync: null
    };
  }
}
