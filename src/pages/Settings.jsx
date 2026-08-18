import { useState, useMemo, useEffect } from 'react';
import { get, set } from 'idb-keyval';
import { Settings2, FolderOpen, Check, Play, Square, AlertCircle, Loader, Circle, X, BarChart2, FileText, Clock, Activity, Database, UploadCloud } from 'lucide-react';
import { useFilter } from '../contexts/FilterContext';
import { useFolderSyncContext } from '../contexts/FolderSyncContext';
import { syncExcelToFirebase } from '../services/firebaseSyncService';
import { firebaseConfig } from '../services/firebaseConfig';
import { Link } from 'react-router-dom';

export default function Settings() {
  const { selectedFile, setSelectedFile } = useFilter();
  const { 
    isWatching, isSyncing, statusText, folderName, needsPermission, 
    availableFiles: contextAvailableFiles, syncSpecificFile, startWatching, stopWatching, lastSyncTime,
    firebaseSyncMetrics
  } = useFolderSyncContext();

  const [selectedYear, setSelectedYear] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isFirebaseSyncing, setIsFirebaseSyncing] = useState(false);

  const fileStructure = useMemo(() => {
    return contextAvailableFiles.map(fileObj => {
      const path = fileObj.path;
      const parts = path.replace(/\\/g, '/').split('/');
      let year = '', month = '', period = '', file = '';
      
      if (parts.length >= 4) {
        year = parts[0]; month = parts[1]; period = parts[2]; file = parts[parts.length-1];
      } else if (parts.length === 3) {
        year = parts[0]; month = parts[1]; file = parts[2];
      } else if (parts.length === 2) {
        year = parts[0]; file = parts[1];
      } else {
        file = parts[0];
      }
      
      return { year, month, period, file, fullPath: path };
    });
  }, [contextAvailableFiles]);

  const years = [...new Set(fileStructure.map(f => f.year).filter(Boolean))].sort();
  const months = [...new Set(fileStructure.filter(f => !selectedYear || f.year === selectedYear).map(f => f.month).filter(Boolean))].sort();
  const periods = [...new Set(fileStructure.filter(f => (!selectedYear || f.year === selectedYear) && (!selectedMonth || f.month === selectedMonth)).map(f => f.period).filter(Boolean))].sort();
  
  const availableFiles = fileStructure.filter(f => 
    (!selectedYear || f.year === selectedYear) &&
    (!selectedMonth || f.month === selectedMonth) &&
    (!selectedPeriod || f.period === selectedPeriod)
  );

  useEffect(() => {
    if (selectedFile && contextAvailableFiles.length > 0 && !selectedYear) {
      const fileObj = contextAvailableFiles.find(f => f.path === selectedFile);
      if (fileObj) {
        const parts = fileObj.path.replace(/\\/g, '/').split('/');
        if (parts.length >= 4) {
          setSelectedYear(parts[0]);
          setSelectedMonth(parts[1]);
          setSelectedPeriod(parts[2]);
        } else if (parts.length === 3) {
          setSelectedYear(parts[0]);
          setSelectedMonth(parts[1]);
        } else if (parts.length === 2) {
          setSelectedYear(parts[0]);
        }
      }
    }
  }, [selectedFile, contextAvailableFiles, selectedYear]);

  const handleSaveActiveFile = async () => {
    if (selectedFile) {
      try {
        setIsSaving(true);
        await set('default_file', selectedFile);
        await syncSpecificFile(selectedFile);
        alert('File Utama berhasil disimpan dan diproses!');
      } catch (err) {
        console.error("Failed to save active file:", err);
        alert('Gagal memproses file.');
      } finally {
        setIsSaving(false);
      }
    } else {
      alert('Pilih file terlebih dahulu!');
    }
  };

  const handleManualFirebaseSync = async () => {
    if (!selectedFile) {
      alert('Pilih file Excel utama terlebih dahulu!');
      return;
    }
    try {
      setIsFirebaseSyncing(true);
      const safeId = selectedFile.replace(/[\/\\]/g, '_');
      const cachedRows = await get(`file_data_${safeId}`);
      
      if (!cachedRows || cachedRows.length === 0) {
        await syncSpecificFile(selectedFile);
        alert('File berhasil diurai dan dikirim ke Firebase!');
      } else {
        const result = await syncExcelToFirebase(selectedFile, cachedRows, { forceUpdateMeta: true });
        if (result.success) {
          alert(`✅ Berhasil Sinkron ke Firebase Realtime Database!\n\n• Total Baris: ${result.total}\n• Data Baru: ${result.added}\n• Data Diperbarui: ${result.updated}\n• Durasi: ${result.duration}ms`);
        } else {
          alert(`⚠️ Gagal Mengirim ke Firebase:\n${result.error}\n\nTips: Periksa tab 'Rules' di Firebase Console Anda dan pastikan .read dan .write bernilai true.`);
        }
      }
    } catch (err) {
      console.error("Manual Firebase sync failed:", err);
      alert(`Error saat sinkronisasi: ${err.message}`);
    } finally {
      setIsFirebaseSyncing(false);
    }
  };

  const resetToYear = () => { setSelectedYear(''); setSelectedMonth(''); setSelectedPeriod(''); setSelectedFile(''); };
  const resetToMonth = () => { setSelectedMonth(''); setSelectedPeriod(''); setSelectedFile(''); };
  const resetToPeriod = () => { setSelectedPeriod(''); setSelectedFile(''); };

  let activeStep = 'year';
  if (selectedYear && selectedMonth && selectedPeriod) activeStep = 'file';
  else if (selectedYear && selectedMonth) activeStep = 'period';
  else if (selectedYear) activeStep = 'month';

  return (
    <div className="flex flex-col h-full bg-[#F5F6F8] overflow-hidden select-none">
      <header className="bg-white h-16 px-6 flex items-center justify-between border-b border-gray-200 shadow-sm relative shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-blue-500/20 flex-shrink-0">
            <Settings2 className="w-5 h-5" />
          </div>
          <div className="flex flex-col justify-center">
            <h1 className="text-lg font-extrabold text-gray-900 leading-none">Pengaturan</h1>
            <p className="text-[10px] text-gray-500 font-bold tracking-[0.15em] mt-1 uppercase">Konfigurasi & Sinkronisasi</p>
          </div>

          {/* Live & Last Sync Status Badge safely placed on the left next to title */}
          <div className="hidden sm:flex items-center space-x-2 pl-3 border-l border-gray-200 ml-1">
            <div className="flex items-center space-x-1.5 px-3 py-1 border rounded-full text-xs font-bold shadow-xs bg-white"
                 style={{ borderColor: isSyncing ? '#FDBA74' : '#BBF7D0', color: isSyncing ? '#F97316' : '#22C55E' }}>
              <Circle className={`w-2 h-2 ${isSyncing ? 'animate-pulse' : ''}`} style={{ fill: isSyncing ? '#F97316' : '#22C55E' }} />
              <span>{isSyncing ? 'Sinkronisasi...' : 'Live'}</span>
            </div>
            {lastSyncTime && (
              <div className="px-3 py-1 border border-gray-200 rounded-full text-[11px] font-semibold text-gray-600 bg-white shadow-xs whitespace-nowrap">
                Terakhir: {lastSyncTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}, {lastSyncTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Link to="/" className="flex items-center space-x-1.5 px-3.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 shadow-xs transition-colors">
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Chart Dashboard</span>
          </Link>
          <Link to="/detail-area" className="flex items-center space-x-1.5 px-3.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 shadow-xs transition-colors">
            <FileText className="w-3.5 h-3.5" />
            <span>Detail Area</span>
          </Link>
          <Link to="/processing-time" className="flex items-center space-x-1.5 px-3.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 shadow-xs transition-colors">
            <Clock className="w-3.5 h-3.5" />
            <span>Processing Time</span>
          </Link>
          <Link to="/production-monitoring" className="flex items-center space-x-1.5 px-3.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 shadow-xs transition-colors">
            <Activity className="w-3.5 h-3.5" />
            <span>Monitoring</span>
          </Link>
        </div>
      </header>
      <div className="p-4 sm:p-6 flex-1 flex justify-center overflow-y-auto min-h-0">
        <div className="w-full max-w-4xl">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-900 leading-tight">Pengaturan Sinkronisasi</h2>
            <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
              Konfigurasi direktori sumber data dan pilih file Excel yang ingin ditampilkan di semua dashboard.
            </p>
          </div>

          <div className="space-y-4">
            {/* Step 1 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 sm:p-5">
                <div className="flex items-start space-x-3.5 mb-3.5">
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0 mt-0.5 text-xs sm:text-sm">
                    1
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-gray-900">Pilih Folder Sumber Data</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Hubungkan browser ke direktori lokal yang berisi file Excel produksi</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 ml-10">
                  <div className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-900 bg-gray-50 flex items-center truncate">
                    {folderName ? `Folder: ${folderName}` : 'Pilih folder untuk memulai...'}
                  </div>
                  
                  <div className="flex space-x-2 shrink-0">
                    <button 
                      onClick={() => startWatching(false, true)}
                      className="flex items-center justify-center space-x-1.5 px-4 py-2.5 border border-gray-200 rounded-xl text-xs sm:text-sm font-semibold text-gray-700 hover:bg-gray-50 bg-white transition-colors shadow-xs"
                    >
                      <FolderOpen className="w-4 h-4 text-gray-500" />
                      <span>Browse</span>
                    </button>
                    
                    {isWatching ? (
                      <button 
                        onClick={stopWatching}
                        className="flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-red-600 rounded-xl text-xs sm:text-sm font-semibold text-white hover:bg-red-700 transition-colors shadow-xs"
                      >
                        <Square className="w-4 h-4" />
                        <span>Stop Pemantauan</span>
                      </button>
                    ) : (
                      <button 
                        onClick={() => startWatching(true)}
                        disabled={!folderName && !needsPermission}
                        className={`flex items-center justify-center space-x-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white transition-colors shadow-xs ${folderName || needsPermission ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300 cursor-not-allowed'}`}
                      >
                        <Play className="w-4 h-4" />
                        <span>{needsPermission ? 'Izinkan Akses & Mulai' : 'Mulai Memantau'}</span>
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="ml-10 mt-3 flex items-center justify-between">
                  <p className="text-[11px] text-gray-400">
                    <span className="font-bold">Catatan:</span> Pastikan folder berisi file .xlsx. Proses berjalan otomatis di latar belakang.
                  </p>
                  <div className="flex items-center space-x-1.5 text-xs font-medium">
                    <div className={`w-2 h-2 rounded-full ${isWatching ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                    <span className={isWatching ? 'text-green-600 font-semibold' : 'text-gray-500'}>{statusText}</span>
                  </div>
                </div>
                
                {needsPermission && (
                  <div className="ml-10 mt-3 bg-yellow-50 border border-yellow-200 rounded-xl p-2.5 flex items-start space-x-2 text-xs text-yellow-800">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-yellow-600" />
                    <div>
                      <strong>Izin diperlukan:</strong> Browser memerlukan izin untuk memantau folder <strong>{folderName}</strong>. Klik tombol "Izinkan Akses & Mulai" di atas.
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 sm:p-5">
                <div className="flex items-start space-x-3.5 mb-4">
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0 mt-0.5 text-xs sm:text-sm">
                    2
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-gray-900">Pilih File yang ingin ditampilkan</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Tentukan data mana yang akan tampil di Dashboard, Detail Area, dan Processing Time</p>
                  </div>
                </div>

                <div className="ml-10">
                  <div className="mb-3.5">
                    {/* Breadcrumbs for choices */}
                    {(selectedYear || selectedMonth || selectedPeriod) && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {selectedYear && (
                          <div onClick={resetToYear} className="cursor-pointer bg-blue-50 border border-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors flex items-center group">
                            Tahun: {selectedYear} <X className="w-3 h-3 ml-1 text-blue-400 group-hover:text-red-500" />
                          </div>
                        )}
                        {selectedMonth && (
                          <div onClick={resetToMonth} className="cursor-pointer bg-blue-50 border border-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors flex items-center group">
                            Bulan: {selectedMonth.replace(/^\d+\.\s*/, '')} <X className="w-3 h-3 ml-1 text-blue-400 group-hover:text-red-500" />
                          </div>
                        )}
                        {selectedPeriod && (
                          <div onClick={resetToPeriod} className="cursor-pointer bg-blue-50 border border-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors flex items-center group">
                            Periode: {selectedPeriod} <X className="w-3 h-3 ml-1 text-blue-400 group-hover:text-red-500" />
                          </div>
                        )}
                      </div>
                    )}

                    <div className="max-w-md">
                      {activeStep === 'year' && (
                        <div>
                          <div className="flex items-center space-x-1.5 mb-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">TAHUN</label>
                          </div>
                          <select 
                            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-gray-700 bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 hover:border-blue-300 shadow-xs appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%239CA3AF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:10px_10px] bg-no-repeat bg-[right_14px_center]"
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                          >
                            <option value="">Pilih Tahun...</option>
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                          </select>
                        </div>
                      )}
                      
                      {activeStep === 'month' && (
                        <div>
                          <div className="flex items-center space-x-1.5 mb-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">BULAN</label>
                          </div>
                          <select 
                            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-gray-700 bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 hover:border-blue-300 shadow-xs appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%239CA3AF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:10px_10px] bg-no-repeat bg-[right_14px_center]"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                          >
                            <option value="">Pilih Bulan...</option>
                            {months.map(m => {
                              const displayName = m.replace(/^\d+\.\s*/, '');
                              return <option key={m} value={m}>{displayName}</option>;
                            })}
                          </select>
                        </div>
                      )}

                      {activeStep === 'period' && (
                        <div>
                          <div className="flex items-center space-x-1.5 mb-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">PERIODE</label>
                          </div>
                          <select 
                            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-gray-700 bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 hover:border-blue-300 shadow-xs appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%239CA3AF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:10px_10px] bg-no-repeat bg-[right_14px_center]"
                            value={selectedPeriod}
                            onChange={(e) => setSelectedPeriod(e.target.value)}
                          >
                            <option value="">Pilih Periode...</option>
                            {periods.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </div>
                      )}

                      {activeStep === 'file' && (
                        <div>
                          <div className="flex items-center space-x-1.5 mb-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">FILE / WEEK</label>
                          </div>
                          <select 
                            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs sm:text-sm font-semibold text-gray-700 bg-white focus:outline-none focus:border-blue-500 shadow-xs appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%239CA3AF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:10px_10px] bg-no-repeat bg-[right_14px_center]"
                            value={selectedFile || ''}
                            onChange={(e) => setSelectedFile(e.target.value)}
                          >
                            <option value="">Pilih File...</option>
                            {availableFiles.map(f => (
                              <option key={f.fullPath} value={f.fullPath}>{f.file}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  <button 
                    className={`flex items-center space-x-2 px-5 py-2.5 text-white rounded-xl text-xs sm:text-sm font-bold transition-colors shadow-xs mb-3.5 ${isSaving ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                    onClick={handleSaveActiveFile}
                    disabled={isSaving}
                  >
                    {isSaving ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>{isSaving ? 'Membaca Excel...' : 'Simpan sebagai File Utama'}</span>
                  </button>

                  <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3 flex items-center space-x-2.5 text-xs sm:text-sm">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full flex-shrink-0"></div>
                    <div className="text-gray-800 text-xs sm:text-sm truncate flex-1 font-medium">
                      <span className="font-bold">File Utama saat ini:</span> {selectedFile || 'Belum ada file yang dipilih'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Cloud Sync Status - Firebase Realtime Database */}
            <div className="bg-white rounded-2xl shadow-sm border border-blue-100 overflow-hidden">
              <div className="p-4 sm:p-5">
                <div className="flex items-start space-x-3.5 mb-3">
                  <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold flex-shrink-0 mt-0.5 text-xs sm:text-sm">
                    <Database className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm sm:text-base font-bold text-gray-900">Firebase Realtime Database</h3>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                        Cloud Active
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Sinkronisasi otomatis multi-path atomik dengan algoritma diffing hemat kuota.
                    </p>
                  </div>
                </div>

                <div className="ml-10 space-y-3">
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 text-xs font-mono text-slate-600 truncate">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans mb-0.5">Target RTDB:</span>
                    {firebaseConfig?.databaseURL || 'Belum terkonfigurasi di .env'}
                  </div>

                  {firebaseSyncMetrics && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                      <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-2.5 text-center">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Total Baris</p>
                        <p className="text-sm font-black text-blue-900 mt-0.5">{firebaseSyncMetrics.total?.toLocaleString('id-ID') || 0}</p>
                      </div>
                      <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-2.5 text-center">
                        <p className="text-[10px] font-bold text-emerald-600 uppercase">Baru</p>
                        <p className="text-sm font-black text-emerald-700 mt-0.5">{firebaseSyncMetrics.added || 0}</p>
                      </div>
                      <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-2.5 text-center">
                        <p className="text-[10px] font-bold text-amber-600 uppercase">Diperbarui</p>
                        <p className="text-sm font-black text-amber-700 mt-0.5">{firebaseSyncMetrics.updated || 0}</p>
                      </div>
                      <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-2.5 text-center">
                        <p className="text-[10px] font-bold text-purple-600 uppercase">Durasi Diffing</p>
                        <p className="text-sm font-black text-purple-700 mt-0.5">{firebaseSyncMetrics.duration || 0} ms</p>
                      </div>
                    </div>
                  )}

                  <div>
                    <button
                      onClick={handleManualFirebaseSync}
                      disabled={isFirebaseSyncing || !selectedFile}
                      className="flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isFirebaseSyncing ? (
                        <Loader className="w-4 h-4 animate-spin" />
                      ) : (
                        <UploadCloud className="w-4 h-4" />
                      )}
                      <span>{isFirebaseSyncing ? 'Mengunggah...' : 'Unggah & Sinkronkan ke Firebase Sekarang'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
