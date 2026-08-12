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
  for (const term of searchTerms) {
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      if (header) {
        const cleanHeader = String(header).replace(/\s+/g, ' ').trim().toLowerCase();
        if (cleanHeader === term) return i;
        
        // Dynamic matching: if the term is specific enough (> 4 chars), allow partial matches
        // This easily catches variations like "cycle time(s)", "waktu proses (jam)" without misidentifying "ct" in "production"
        if (term.length > 4 && cleanHeader.includes(term)) return i;
      }
    }
  }
  return -1;
};

export const parseExcelFile = (file) => {
  return new Promise((resolve, reject) => {
    let worker;
    try {
      worker = new Worker(new URL('./excelWorkerV11.js', import.meta.url), { type: 'module' });
    } catch (err) {
      return reject(err);
    }
    
    // Add a safety timeout: if parsing takes more than 3 minutes, abort
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error("Parsing timeout: Excel file took too long to process."));
    }, 180000);

    worker.onmessage = (event) => {
      clearTimeout(timeout);
      if (event.data.success) {
        resolve(event.data.rows);
      } else {
        reject(new Error(event.data.error || "Unknown worker error"));
      }
      worker.terminate();
    };
    
    worker.onerror = (error) => {
      clearTimeout(timeout);
      // Try to extract a useful message if possible
      const msg = error.message ? error.message : "Web Worker crashed (possibly due to an import error).";
      reject(new Error(msg));
      worker.terminate();
    };
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        // Do NOT transfer ownership (remove the [data] parameter) 
        // to avoid detached ArrayBuffer issues on some browsers.
        worker.postMessage({ data });
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
        worker.terminate();
      }
    };
    
    reader.onerror = (err) => {
      clearTimeout(timeout);
      reject(err);
      worker.terminate();
    };
    
    reader.readAsArrayBuffer(file);
  });
};
