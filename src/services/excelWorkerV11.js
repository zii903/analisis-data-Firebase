import * as XLSX from 'xlsx';

const cleanNum = (val) => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    let v = val.trim();
    if (v.startsWith('=')) v = v.substring(1);
    v = v.replace(/[, ]/g, '');
    const num = Number(v);
    if (!isNaN(num)) return num;
  }
  return 0;
};

const findIndex = (headers, searchTerms) => {
  // Pass 1: Exact matches
  for (const term of searchTerms) {
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      if (header) {
        const cleanHeader = String(header).replace(/\s+/g, ' ').trim().toLowerCase();
        if (cleanHeader === term) return i;
      }
    }
  }
  // Pass 2: Partial matches
  for (const term of searchTerms) {
    if (term.length > 4) {
      for (let i = 0; i < headers.length; i++) {
        const header = headers[i];
        if (header) {
          const cleanHeader = String(header).replace(/\s+/g, ' ').trim().toLowerCase();
          if (cleanHeader.includes(term)) return i;
        }
      }
    }
  }
  return -1;
};

self.onmessage = (e) => {
  try {
    const { data } = e.data;
    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
    
    const excludeSheets = ['Dashboard', 'Setting', 'Routing', 'Sheet1', 'Sheet2', 'unplan'];
    let allRows = [];
    
    workbook.SheetNames.forEach(sheetName => {
      if (excludeSheets.includes(sheetName)) return;
      
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      
      if (rows.length === 0) return;
      
      let headerRowIdx = -1;
      for(let i=0; i<Math.min(20, rows.length); i++) {
          const r = rows[i];
          if (
            findIndex(r, ['status']) !== -1 || 
            findIndex(r, ['customer', 'pelanggan']) !== -1 || 
            findIndex(r, ['pro number', 'pro', 'prod. ord', 'so']) !== -1 ||
            findIndex(r, ['description', 'deskripsi', 'desc', 'material description']) !== -1 ||
            findIndex(r, ['qty order', 'order qty', 'order', 'qty', 'target']) !== -1 ||
            findIndex(r, ['senin', 'selasa', 'rabu', 'kamis', 'jumat']) !== -1
          ) {
              headerRowIdx = i;
              break;
          }
      }
      if (headerRowIdx === -1) headerRowIdx = 0;
      
      const headers = rows[headerRowIdx];
      const statusIdx = findIndex(headers, ['status']);
      const targetPlanningIdx = findIndex(headers, ['target planning', 'target', 'planning']);
      const customerIdx = findIndex(headers, ['customer', 'pelanggan']);
      const planSoIdx = findIndex(headers, ['plan/so', 'plan so', 'plan']);
      const designIdx = findIndex(headers, ['design', 'desain', 'door design', 'door style']);
      const proNumberIdx = findIndex(headers, ['pro', 'pro number', 'no pro', 'no. pro', 'prod. ord', 'prod ord', 'production order', 'prod.ord', 'so']);
      const materialCodeIdx = findIndex(headers, ['material code', 'material', 'kode material']);
      let descriptionIdx = findIndex(headers, ['material description', 'description', 'deskripsi', 'desc']);
      if (descriptionIdx === -1) descriptionIdx = findIndex(headers, ['material']);
      
      const qtyOrderIdx = findIndex(headers, ['qty order', 'order qty', 'order', 'qty', 'target']);
      const stockIdx = findIndex(headers, ['stock', 'stok']);
      const qtyProduksiIdx = findIndex(headers, ['qty produksi', 'produksi qty', 'qty out', 'produksi']);
      
      if (sheetName.toLowerCase().includes('hf endcap') || sheetName.toLowerCase().includes('hf-endcap')) {
        console.log("WORKER DEBUG for", sheetName, ":");
        console.log("Header Row Index:", headerRowIdx);
        console.log("Headers found:", headers);
        console.log("statusIdx:", statusIdx);
        console.log("qtyProduksiIdx:", qtyProduksiIdx);
      }

      const waktuProsesIdx = findIndex(headers, ['waktu proses', 'waktu proses(jam)', 'processing time']);
      const mesinIdx = findIndex(headers, ['mesin', 'mesini', 'mesin / area', 'mesin/area']);
      const outputPerjamIdx = findIndex(headers, ['output perjam', 'output/jam', 'output per jam']);
      const cycleTimeIdx = findIndex(headers, ['ct', 'cycle time', 'cycletime', 'c.t', 'ct ', 'cycle time(s)']);
      const variantIdx = findIndex(headers, ['variant', 'varian', 'sisa', 'selisih']);
      const estimasiSisaWaktuIdx = findIndex(headers, ['estimasi sisa waktu', 'estimasi sisa', 'sisa waktu', 'remaining time', 'est sisa waktu']);

      const knownIndices = [statusIdx, targetPlanningIdx, customerIdx, planSoIdx, designIdx, proNumberIdx, materialCodeIdx, descriptionIdx, qtyOrderIdx, stockIdx, qtyProduksiIdx, waktuProsesIdx, mesinIdx, outputPerjamIdx, cycleTimeIdx, variantIdx, estimasiSisaWaktuIdx].filter(i => i !== -1);
      
      const days = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
      const jsDays = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
      const dailyColIndices = {};
      
      headers.forEach((originalHeaderName, c) => {
        if (!knownIndices.includes(c) && originalHeaderName && String(originalHeaderName).trim() !== '') {
          let headerName = String(originalHeaderName).trim();
          if (originalHeaderName instanceof Date) {
              headerName = jsDays[originalHeaderName.getDay()] + ' ' + originalHeaderName.toLocaleDateString('id-ID');
          }
          const hn = headerName.toLowerCase();
          let isDayCol = false;
          for (const day of days) {
            if (hn.startsWith(day)) {
              isDayCol = true;
              break;
            }
          }
          dailyColIndices[c] = { name: headerName, is_day: isDayCol };
        }
      });

      for (let idx = headerRowIdx + 1; idx < rows.length; idx++) {
        const row = rows[idx];
        if (!row || row.every(cell => cell === '')) continue;
        
        const rawStatus = statusIdx !== -1 ? String(row[statusIdx] || '').trim() : '';
        const cleanStatus = rawStatus.toLowerCase();
        let status = 'UNPLAN';
        if (cleanStatus.includes('plan') && !cleanStatus.includes('unplan')) {
          status = 'PLANNING';
        } else if (cleanStatus.includes('backlog')) {
          status = 'BACKLOG';
        } else if (rawStatus) {
          status = rawStatus.toUpperCase(); // Fallback for other valid statuses if any
        }

        let proNumber = proNumberIdx !== -1 ? (row[proNumberIdx] || null) : null;
        if (!proNumber || String(proNumber).trim() === '') proNumber = `DRAFT-ROW-${idx}`;

        const qtyOrder = qtyOrderIdx !== -1 ? cleanNum(row[qtyOrderIdx]) : 0;

        const stock = stockIdx !== -1 ? cleanNum(row[stockIdx]) : 0;
        const qtyProduksi = qtyProduksiIdx !== -1 ? cleanNum(row[qtyProduksiIdx]) : 0;
        const customer = customerIdx !== -1 ? (row[customerIdx] || null) : null;
        const description = descriptionIdx !== -1 ? (row[descriptionIdx] || null) : null;

        let outputPerjam = outputPerjamIdx !== -1 ? cleanNum(row[outputPerjamIdx]) : 0;
        let waktuProses = null;
        if (waktuProsesIdx !== -1 && row[waktuProsesIdx]) {
            const val = cleanNum(row[waktuProsesIdx]);
            if (val > 0) waktuProses = val;
        }
        if (!waktuProses && outputPerjam > 0 && qtyProduksi > 0) {
            waktuProses = Number((qtyProduksi / outputPerjam).toFixed(4));
        }
        const cycleTime = cycleTimeIdx !== -1 ? cleanNum(row[cycleTimeIdx]) : 0;
        if (!waktuProses && cycleTime > 0) {
            const qtyToUse = qtyProduksi > 0 ? qtyProduksi : (qtyOrder > 0 ? qtyOrder : 0);
            if (qtyToUse > 0) {
                waktuProses = Number(((qtyToUse * cycleTime) / 3600).toFixed(4));
            }
        }
        const subMachine = mesinIdx !== -1 ? (row[mesinIdx] || null) : null;

        // --- Estimasi Sisa Waktu ---
        // Variant = Qty Order - Qty Produksi (sisa yang belum selesai)
        // Jika kolom Variant ada di Excel, ambil dari sana; jika tidak, hitung manual
        let variant = variantIdx !== -1 ? cleanNum(row[variantIdx]) : (qtyOrder - qtyProduksi);
        
        // Jika kolom Estimasi Sisa Waktu ada di Excel, ambil langsung; jika tidak, hitung:
        // Rumus: IF(Variant > 0, 0, Variant / OutputPerjam)
        // Variant negatif berarti masih ada sisa → estimasiSisaWaktu = abs(Variant) / OutputPerjam
        let estimasiSisaWaktu = 0;
        if (estimasiSisaWaktuIdx !== -1 && row[estimasiSisaWaktuIdx] !== '') {
            const rawEst = cleanNum(row[estimasiSisaWaktuIdx]);
            // Kolom di Excel bisa bernilai negatif (hasil Variant/OutputPerjam), ambil absolut
            estimasiSisaWaktu = Math.abs(rawEst);
        } else {
            // Hitung manual sesuai rumus Excel: IF(Variant>0, 0, Variant/OutputPerjam)
            if (variant <= 0 && outputPerjam > 0) {
                estimasiSisaWaktu = Number((Math.abs(variant) / outputPerjam).toFixed(4));
            } else {
                estimasiSisaWaktu = 0;
            }
        }

        const dailyDetails = {};
        let dailySum = 0;

        for (const c in dailyColIndices) {
          const info = dailyColIndices[c];
          let val = row[c] || null;
          if (info.is_day) {
            val = cleanNum(val);
            dailySum += val;
          }
          dailyDetails[info.name] = val;
        }
        dailyDetails['SUM_CALCULATED'] = dailySum;
        dailyDetails['excel_row_index'] = idx;

        const hasCustomer = customer && String(customer).trim() !== '';
        const hasDescription = description && String(description).trim() !== '';
        const hasRealPro = proNumber && !String(proNumber).startsWith('DRAFT-');
        const hasQty = qtyOrder > 0 || qtyProduksi > 0 || stock > 0;

        if (!hasCustomer && !hasDescription && !hasRealPro && !hasQty && dailySum === 0) continue;

        let planSoString = null;
        if (planSoIdx !== -1 && row[planSoIdx]) {
          const p = row[planSoIdx];
          if (p instanceof Date) {
            planSoString = p.toISOString().slice(0, 19).replace('T', ' ');
          } else {
            planSoString = String(p);
          }
        }

        allRows.push({
          sheetName,
          rowIdx: idx,
          machine_name: sheetName,
          pro_number: proNumber,
          status,
          raw_status: rawStatus || (statusIdx !== -1 ? String(row[statusIdx] || '').trim() : status),
          target_planning: targetPlanningIdx !== -1 ? (row[targetPlanningIdx] ?? null) : null,
          customer,
          plan_so: planSoString,
          design: designIdx !== -1 ? (row[designIdx] ?? null) : null,
          material_code: materialCodeIdx !== -1 ? (row[materialCodeIdx] ?? null) : null,
          description,
          qty_order: qtyOrder,
          stock,
          qty_produksi: qtyProduksi,
          waktu_proses: waktuProses,
          sub_machine: subMachine,
          cycle_time: cycleTime,
          output_perjam: outputPerjam,
          variant,
          estimasi_sisa_waktu: estimasiSisaWaktu,
          daily_details: dailyDetails,
          debug_status_idx: statusIdx,
          debug_header: headers ? headers[statusIdx] : 'N/A'
        });
      }
    });
    
    self.postMessage({ success: true, rows: allRows });
  } catch (err) {
    self.postMessage({ success: false, error: err.message });
  }
};
