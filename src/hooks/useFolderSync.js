import { useState, useEffect, useRef } from 'react';
import { get, set } from 'idb-keyval';
import { parseExcelFile } from '../services/excelParser';

export function useFolderSync() {
  // Naikkan versi ini setiap kali logika parsing/worker berubah
  // agar cache IDB lama otomatis invalid dan file di-parse ulang
  const WORKER_VERSION = 'v5';
  const [isWatching, setIsWatching] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);  
  const [statusText, setStatusText] = useState('Standby');
  const [folderName, setFolderName] = useState('');
  const [needsPermission, setNeedsPermission] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  
  // State baru untuk Lazy Sync
  const [availableFiles, setAvailableFiles] = useState([]);
  const [activeWatchedFile, setActiveWatchedFile] = useState(null); // { path, handle }
  
  const dirHandleRef = useRef(null);
  const fileCacheRef = useRef(new Map());
  const isProcessingRef = useRef(false);

  // Restore handle on mount
  useEffect(() => {
    const restoreHandle = async () => {
      try {
        const storedLastSync = await get('global_last_sync_time');
        if (storedLastSync) setLastSyncTime(new Date(storedLastSync));

        const storedHandle = await get('sync_directory_handle');
        if (storedHandle) {
          dirHandleRef.current = storedHandle;
          setFolderName(storedHandle.name);
          
          // Silently check if permission is ALREADY granted without prompting
          const perm = await storedHandle.queryPermission({ mode: 'read' });
          if (perm === 'granted') {
            // Already have permission! Start automatically
            setNeedsPermission(false);
            setIsWatching(true);
            setStatusText('Memindai Struktur Folder...');
            
            const files = await scanDirectory(storedHandle);
            setAvailableFiles(files);
            
            // Automatically resume watching default file if exists
            const storedDefaultFile = await get('default_file');
            if (storedDefaultFile) {
              const fileObj = files.find(f => f.path === storedDefaultFile);
              if (fileObj) {
                setActiveWatchedFile(fileObj);
                setStatusText(`Melanjutkan pemantauan: ${fileObj.name}`);
                processFile(fileObj, false);
              } else {
                setStatusText('Pemindaian Selesai. Menunggu File Utama.');
              }
            } else {
              setStatusText('Pemindaian Selesai. Menunggu File Utama.');
            }
          } else {
            // Permission lost/requires user gesture. Must click button.
            setNeedsPermission(true);
          }
        }
      } catch (err) {
        console.error("Failed to restore directory handle from IDB:", err);
      }
    };
    restoreHandle();
  }, []);

  const verifyPermission = async (fileHandle, readWrite) => {
    const options = {};
    if (readWrite) {
      options.mode = 'readwrite';
    }
    
    if ((await fileHandle.queryPermission(options)) === 'granted') {
      return true;
    }
    
    if ((await fileHandle.requestPermission(options)) === 'granted') {
      return true;
    }
    
    return false;
  };

  const startWatching = async (requirePermission = false, forceNew = false) => {
    try {
      if (!dirHandleRef.current || forceNew) {
        const dirHandle = await window.showDirectoryPicker();
        dirHandleRef.current = dirHandle;
        await set('sync_directory_handle', dirHandle);
        setFolderName(dirHandle.name);
      }
      
      if (requirePermission) {
        const hasPerm = await verifyPermission(dirHandleRef.current, false);
        if (!hasPerm) {
          setStatusText('Izin ditolak oleh user.');
          return;
        }
      }
      
      setNeedsPermission(false);
      setIsWatching(true);
      setStatusText('Memindai Struktur Folder...');
      
      // Lazy Sync: Hanya baca struktur tanpa parsing file
      const files = await scanDirectory(dirHandleRef.current);
      setAvailableFiles(files);
      
      // Automatically resume watching default file if exists
      const storedDefaultFile = await get('default_file');
      if (storedDefaultFile) {
        const fileObj = files.find(f => f.path === storedDefaultFile);
        if (fileObj) {
          setActiveWatchedFile(fileObj);
          setStatusText(`Melanjutkan pemantauan: ${fileObj.name}`);
          processFile(fileObj, false);
        } else {
          setStatusText('Pemindaian Selesai. Menunggu File Utama.');
        }
      } else {
        setStatusText('Pemindaian Selesai. Menunggu File Utama.');
      }
      
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log("Pemilihan folder dibatalkan oleh user.");
        // Do not change statusText if they just cancelled the picker
        return;
      }
      console.error(err);
      setStatusText('Akses dibatalkan atau error.');
    }
  };

  const stopWatching = () => {
    setIsWatching(false);
    setActiveWatchedFile(null);
    setStatusText('Pemantauan dihentikan');
  };

  const scanDirectory = async (dirHandle, currentPath = '') => {
    let files = [];
    const promises = [];
    
    for await (const entry of dirHandle.values()) {
      const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
      
      if (entry.kind === 'directory') {
        promises.push(scanDirectory(entry, entryPath).then(subFiles => {
          files = files.concat(subFiles);
        }));
      } else if (entry.kind === 'file' && (entry.name.endsWith('.xlsx') || entry.name.endsWith('.xls'))) {
        if (!entry.name.startsWith('~$')) {
          files.push({ handle: entry, path: entryPath, name: entry.name });
        }
      }
    }
    
    await Promise.all(promises);
    return files;
  };

  // Fungsi baru untuk sinkronisasi spesifik 1 file
  const syncSpecificFile = async (filepath) => {
    const fileObj = availableFiles.find(f => f.path === filepath);
    if (!fileObj) {
      console.error("File tidak ditemukan dalam daftar hasil scan");
      return;
    }
    
    setActiveWatchedFile(fileObj);
    await processFile(fileObj, true);
  };

  const processFile = async (fileObj, forceSync = false) => {
    if (isProcessingRef.current) return;
    
    try {
      const file = await fileObj.handle.getFile();
      const lastMod = file.lastModified;
      const fileSize = file.size;
      // Use both lastModified AND size as cache key to detect changes reliably
      const cacheKey = `${WORKER_VERSION}_${lastMod}_${fileSize}`;
      const cachedKey = fileCacheRef.current.get(fileObj.path);
      
      if (forceSync || !cachedKey || cachedKey !== cacheKey) {
        isProcessingRef.current = true;
        setIsSyncing(true);
        setStatusText(`Membaca ${file.name}...`);
        await new Promise(r => setTimeout(r, 50)); 
        
        const rows = await parseExcelFile(file, fileObj.path);
        setStatusText(`Mempersiapkan unggahan ${rows.length} baris...`);
        await new Promise(r => setTimeout(r, 20));
        
        await saveToIndexedDB(fileObj.path, rows, file, setStatusText);
        fileCacheRef.current.set(fileObj.path, cacheKey);
        setStatusText(`Memantau File: ${file.name}`);
        
        setIsSyncing(false);
      }
    } catch (err) {
      console.error("Gagal sinkronisasi file:", err);
      setStatusText('Gagal membaca file.');
      setIsSyncing(false);
    } finally {
      // Always reset the lock so next poll can run
      isProcessingRef.current = false;
    }
  };

  const saveToIndexedDB = async (filepath, rows, fileObj, setStatusText) => {
    const safeId = filepath.replace(/[\/\\]/g, '_');
    if (setStatusText) setStatusText(`Menyimpan data ke memori lokal...`);
    
    const rowsWithMeta = rows.map(row => ({
      ...row,
      source_file: filepath,
      updated_at: new Date()
    }));
    
    await set(`file_data_${safeId}`, rowsWithMeta);
    
    await set(`synced_file_${safeId}`, {
      filename: filepath,
      status: 'synced',
      updated_at: new Date(),
      file_mtime: fileObj.lastModified,
      file_size: fileObj.size
    });
    
    const now = new Date();
    setLastSyncTime(now);
    await set('global_last_sync_time', now.toISOString());
  };

  // Interval polling hanya untuk 1 file yang aktif
  useEffect(() => {
    let interval;
    if (isWatching && activeWatchedFile) {
      interval = setInterval(() => {
        processFile(activeWatchedFile, false);
      }, 5000); 
    }
    return () => clearInterval(interval);
  }, [isWatching, activeWatchedFile]);

  return { 
    isWatching, isSyncing, statusText, folderName, needsPermission, 
    availableFiles, syncSpecificFile, startWatching, stopWatching, lastSyncTime
  };
}

