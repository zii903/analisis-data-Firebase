import { useState, useEffect, useRef } from 'react';
import { get } from 'idb-keyval';
import { useFilter } from '../contexts/FilterContext';
import { useFolderSyncContext } from '../contexts/FolderSyncContext';
import { daysKeys } from '../utils/constants';

export function useMachineData() {
  const [machineStats, setMachineStats] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { selectedFile } = useFilter();
  const { isSyncing } = useFolderSyncContext();
  const prevIsSyncing = useRef(false);

  const processData = async (fileName, isBackgroundSync = false) => {
    if (!fileName) {
      setMachineStats([]);
      setRawRows([]);
      return;
    }

    try {
      if (!isBackgroundSync) {
        setLoading(true);
      }
      setError(null);
      const safeId = fileName.replace(/[\/\\]/g, '_');
      const rows = await get(`file_data_${safeId}`) || [];
      setRawRows(rows);

      const grouped = {};

      rows.forEach((row, index) => {
        const machineName = row.machine_name || 'Unknown';
        const ct = Number(row.cycle_time || 0);
        const time = Number(row.waktu_proses || 0);
        const estWaktu = Number(row.estimasi_sisa_waktu || 0);
        const subMachine = row.sub_machine || null;
        
        if (!grouped[machineName]) {
          grouped[machineName] = {
            name: machineName,
            items: 0,
            ctItems: 0,
            target: 0,
            procTimeTotal: 0,
            estimasiSisaWaktuTotal: 0,
            seenMaterials: new Set(),
            materials: [],
            materialsDict: {},
            subMachines: {},
            daily: {
              Senin: { planned: 0, unplan: 0, total: 0 },
              Selasa: { planned: 0, unplan: 0, total: 0 },
              Rabu: { planned: 0, unplan: 0, total: 0 },
              Kamis: { planned: 0, unplan: 0, total: 0 },
              Jumat: { planned: 0, unplan: 0, total: 0 },
              Sabtu: { planned: 0, unplan: 0, total: 0 },
              Minggu: { planned: 0, unplan: 0, total: 0 }
            },
            hasPlanned: false,
            unplannedTarget: 0
          };
        }

        const g = grouped[machineName];
        g.items += 1;
        if (ct > 0) g.ctItems += 1;
        
        if (subMachine && time > 0) {
          g.subMachines[subMachine] = (g.subMachines[subMachine] || 0) + time;
        }

        const dailyObj = typeof row.daily_details === 'string' ? JSON.parse(row.daily_details) : row.daily_details;
        const excelRowIdx = dailyObj?.excel_row_index || 0;
        const materialKey = `${row.customer}_${row.pro_number}_${row.description}_${row.qty_produksi}_${excelRowIdx}`;
        
        const statusRaw = (row.status || '').toString().trim().toLowerCase();
        const isPlanned = (statusRaw.includes('plan') && !statusRaw.includes('unplan')) || statusRaw.includes('backlog');

        if (!g.seenMaterials.has(materialKey)) {
          if (isPlanned) {
            g.target += Number(row.qty_produksi || 0);
            g.hasPlanned = true;
          } else {
            g.unplannedTarget += Number(row.qty_produksi || 0);
          }
          g.seenMaterials.add(materialKey);

          const matObj = {
            id: `row_${index}`,
            key: materialKey,
            area: machineName,
            subMachine,
            status: row.status || 'UNPLAN',
            rawStatus: row.raw_status || row.status || 'UNPLAN',
            isPlanned,
            customer: row.customer || '',
            proNumber: row.pro_number || '',
            description: row.description || '',
            qtyOrder: Number(row.qty_order || 0),
            qtyProduksi: Number(row.qty_produksi || 0),
            ct: ct > 0 ? ct : null,
            time: time > 0 ? time : null,
            estimasiSisaWaktu: estWaktu,
            variant: Number(row.variant || 0),
            dailyActuals: {
              Senin: 0, Selasa: 0, Rabu: 0, Kamis: 0, Jumat: 0, Sabtu: 0, Minggu: 0
            }
          };

          g.materialsDict[materialKey] = matObj;
          g.materials.push(matObj);
          g.estimasiSisaWaktuTotal += estWaktu;
        }

        const mat = g.materialsDict[materialKey];
        g.procTimeTotal += time;

        if (dailyObj) {
          for (const [k, v] of Object.entries(dailyObj)) {
            if (typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v)))) {
              for (const dk of daysKeys) {
                if (k.trim().toLowerCase().startsWith(dk.toLowerCase())) {
                  const val = Number(v);
                  g.daily[dk].total += val;
                  mat.dailyActuals[dk] += val;
                  if (isPlanned) {
                    g.daily[dk].planned += val;
                  } else {
                    g.daily[dk].unplan += val;
                  }
                  break;
                }
              }
            }
          }
        }
      });

      setMachineStats(Object.values(grouped));
    } catch (err) {
      console.error("Error fetching data:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch when file changes
  useEffect(() => {
    processData(selectedFile, false);
  }, [selectedFile]);

  // Refetch only when syncing just finished
  useEffect(() => {
    if (prevIsSyncing.current === true && isSyncing === false) {
      processData(selectedFile, true);
    }
    prevIsSyncing.current = isSyncing;
  }, [isSyncing, selectedFile]);

  return { machineStats, rawRows, loading, error };
}
