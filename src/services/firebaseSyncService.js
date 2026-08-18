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
        daily_details: typeof row.daily_details === 'string' ? JSON.parse(row.daily_details || '{}') : (row.daily_details || {})
      };

      // Pastikan seluruh sub-object (seperti daily_details) terbebas dari tanda '.' dll
      const cleanRow = sanitizeDataForFirebase(rawCleanRow);

      // Fingerprint murni dari data Excel (tanpa timestamp dinamis)
      const recordFingerprint = JSON.stringify(cleanRow);
      newCache[sanitizedKey] = recordFingerprint;

      // Cek diffing terhadap cache sebelumnya
      if (!previousCache[sanitizedKey]) {
        // Data Baru
        updates[`${rootCollection}/${sanitizedKey}`] = { ...cleanRow, _updatedAt: Date.now() };
        addedCount++;
      } else if (previousCache[sanitizedKey] !== recordFingerprint) {
        // Data Berubah
        updates[`${rootCollection}/${sanitizedKey}`] = { ...cleanRow, _updatedAt: Date.now() };
        updatedCount++;
      }
    });

    const totalChanges = addedCount + updatedCount;

    // 3. Kirim ke Firebase Realtime Database jika ada perubahan data
    if (totalChanges > 0 || options.forceUpdateMeta) {
      // Cek koneksi internet sebelum mencoba request jaringan
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        console.warn('[FirebaseSync] Mode Offline terdeteksi: Data berhasil disimpan di memori lokal (IndexedDB). Sinkronisasi cloud akan dilanjutkan saat online.');
        return {
          success: false,
          error: 'Offline: Tidak ada koneksi internet. Data tersimpan di memori lokal (IndexedDB).',
          isOffline: true,
          total: rows.length,
          added: 0,
          updated: 0,
          hasChanges: false,
          duration: Math.round(performance.now() - startTime),
          lastSync: null
        };
      }

      const nowIso = new Date().toISOString();

      // Tambahkan metadata global
      updates['_metadata/lastSync'] = nowIso;
      updates['_metadata/fileName'] = filePath;
      updates['_metadata/totalRecords'] = rows.length;
      updates['_metadata/lastChangesCount'] = totalChanges;
      updates['_metadata/addedCount'] = addedCount;
      updates['_metadata/updatedCount'] = updatedCount;

      // Multi-path atomic update dengan timeout (mencegah hanging saat koneksi mati/lemah)
      const timeoutMs = options.timeoutMs || 6000;
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => {
          reject(new Error(`Koneksi Timeout (${timeoutMs / 1000}s): Server Firebase tidak merespons. Periksa koneksi internet Anda.`));
        }, timeoutMs)
      );

      await Promise.race([
        update(ref(db), updates),
        timeoutPromise
      ]);

      // Simpan snapshot cache baru ke IndexedDB hanya jika berhasil terkirim ke Firebase
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
      error: err.message || 'Terjadi kesalahan saat sinkronisasi Firebase',
      isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
      total: rows.length,
      added: 0,
      updated: 0,
      hasChanges: false,
      duration: Math.round(performance.now() - startTime),
      lastSync: null
    };
  }
}
