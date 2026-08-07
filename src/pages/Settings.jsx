import { useState, useMemo, useEffect } from 'react';
import { set, clear } from 'idb-keyval';
import { Settings as SettingsIcon, FolderOpen, Check, Play, Square, AlertCircle, Loader, Circle, X } from 'lucide-react';
import { useFilter } from '../contexts/FilterContext';
import { useFolderSyncContext } from '../contexts/FolderSyncContext';
import { Link } from 'react-router-dom';

export default function Settings() {
  const { selectedFile, setSelectedFile } = useFilter();
  const { 
    isWatching, isSyncing, statusText, folderName, needsPermission, 
    availableFiles: contextAvailableFiles, syncSpecificFile, startWatching, stopWatching, lastSyncTime
  } = useFolderSyncContext();

  const [selectedYear, setSelectedYear] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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

  const handleClearDatabase = async () => {
    if (window.confirm('Apakah Anda yakin ingin menghapus semua data yang tersimpan di database lokal? Ini akan menghapus semua riwayat sinkronisasi dan data file utama.')) {
      try {
        stopWatching(); // Hentikan proses sinkronisasi yang mungkin sedang berjalan
        
        // Tunggu sedikit untuk memastikan tidak ada penulisan data yang sedang berlangsung
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await clear(); // Hapus data dari idb-keyval
        
        // Hapus juga cache storage jika ada
        localStorage.clear();
        sessionStorage.clear();
        
        // Coba hapus database IndexedDB secara paksa sebagai tambahan
        if (window.indexedDB && window.indexedDB.databases) {
           const dbs = await window.indexedDB.databases();
           dbs.forEach(db => { window.indexedDB.deleteDatabase(db.name) });
        } else {
           window.indexedDB.deleteDatabase('keyval-store');
        }
        
        alert('Database berhasil dikosongkan! Halaman akan dimuat ulang.');
        window.location.replace('/'); // Redirect ke halaman utama saat memuat ulang
      } catch (err) {
        console.error("Gagal mengosongkan database:", err);
        alert('Gagal mengosongkan database.');
      }
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
    <div className="flex flex-col min-h-screen bg-[#F5F6F8]">
      <header className="bg-white h-20 px-8 flex items-center justify-between border-b border-gray-200 shadow-sm relative">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <SettingsIcon className="w-5 h-5 text-blue-600" />
          </div>
          <h1 className="text-xl font-extrabold text-gray-900">Pengaturan</h1>
        </div>

        {/* Centered Live / Sync Indicator */}
        <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center space-x-3">
          <div className="flex items-center space-x-2 px-4 py-1.5 border rounded-full text-sm font-bold shadow-sm transition-colors duration-300 bg-white"
               style={{ borderColor: isSyncing ? '#FDBA74' : '#BBF7D0', color: isSyncing ? '#F97316' : '#22C55E' }}>
            <Circle className={`w-3 h-3 ${isSyncing ? 'animate-pulse' : ''}`} style={{ fill: isSyncing ? '#F97316' : '#22C55E' }} />
            <span>{isSyncing ? 'Sinkronisasi...' : 'Live'}</span>
          </div>
          {lastSyncTime && (
            <div className="px-4 py-1.5 border border-gray-200 rounded-full text-xs font-semibold text-gray-500 bg-white shadow-sm flex items-center space-x-1">
              <span>Terakhir Sinkron: {lastSyncTime.toLocaleString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-8 text-sm font-semibold text-gray-500">
          <Link to="/" className="hover:text-gray-900 transition-colors">Progress Dashboard</Link>
          <Link to="/detail-area" className="hover:text-gray-900 transition-colors">Detail Area</Link>
          <Link to="/processing-time" className="hover:text-gray-900 transition-colors">Processing Time</Link>
        </div>
      </header>

      <div className="p-8 flex-1 flex justify-center overflow-y-auto">
        <div className="w-full max-w-5xl">
          <div className="mb-4">
            <h2 className="text-2xl font-extrabold text-gray-900 mb-1 tracking-tight">Pengaturan Sinkronisasi</h2>
            <p className="text-gray-500 text-sm">
              Konfigurasi direktori sumber data dan pilih file Excel yang ingin ditampilkan di semua dashboard.
            </p>
          </div>

          <div className="space-y-4">
            {/* Step 1 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-5">
                <div className="flex items-start space-x-4 mb-4">
                  <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold flex-shrink-0 mt-0.5 text-sm">
                    1
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Pilih Folder Sumber Data</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Hubungkan browser ke direktori lokal yang berisi file Excel produksi</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 ml-11">
                  <div className="flex-1 px-4 py-3 border border-gray-200 rounded-lg text-sm text-gray-900 bg-gray-50 flex items-center">
                    {folderName ? `Folder: ${folderName}` : 'Pilih folder untuk memulai...'}
                  </div>
                  
                  <div className="flex space-x-3">
                    <button 
                      onClick={() => startWatching(false, true)}
                      className="flex items-center justify-center space-x-2 px-6 py-3 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 bg-white transition-colors"
                    >
                      <FolderOpen className="w-4 h-4" />
                      <span>Browse</span>
                    </button>
                    
                    {isWatching ? (
                      <button 
                        onClick={stopWatching}
                        className="flex items-center justify-center space-x-2 px-6 py-3 bg-red-500 rounded-lg text-sm font-semibold text-white hover:bg-red-600 transition-colors shadow-sm"
                      >
                        <Square className="w-4 h-4" />
                        <span>Stop Pemantauan</span>
                      </button>
                    ) : (
                      <button 
                        onClick={() => startWatching(true)}
                        disabled={!folderName && !needsPermission}
                        className={`flex items-center justify-center space-x-2 px-6 py-3 rounded-lg text-sm font-semibold text-white transition-colors shadow-sm ${folderName || needsPermission ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-300 cursor-not-allowed'}`}
                      >
                        <Play className="w-4 h-4" />
                        <span>{needsPermission ? 'Izinkan Akses & Mulai' : 'Mulai Memantau'}</span>
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="ml-11 mt-4 flex items-center justify-between">
                  <p className="text-[11px] text-gray-400">
                    <span className="font-bold">Catatan:</span> Pastikan folder berisi file .xlsx. Proses berjalan otomatis di latar belakang.
                  </p>
                  <div className="flex items-center space-x-2 text-xs font-medium">
                    <div className={`w-2 h-2 rounded-full ${isWatching ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                    <span className={isWatching ? 'text-green-600' : 'text-gray-500'}>{statusText}</span>
                  </div>
                </div>
                
                {needsPermission && (
                  <div className="ml-11 mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-2.5 flex items-start space-x-2 text-xs text-yellow-800">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-yellow-600" />
                    <div>
                      <strong>Izin diperlukan:</strong> Browser memerlukan izin Anda untuk memantau folder <strong>{folderName}</strong>. Klik tombol "Izinkan Akses & Mulai" di atas.
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-5">
                <div className="flex items-start space-x-4 mb-5">
                  <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold flex-shrink-0 mt-0.5 text-sm">
                    2
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Pilih File yang ingin ditampilkan</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Tentukan data mana yang akan tampil di Progress Dashboard, Detail Area, dan Processing Time</p>
                  </div>
                </div>

                <div className="ml-11">
                  <div className="mb-4">
                    {/* Breadcrumbs for choices */}
                    {(selectedYear || selectedMonth || selectedPeriod) && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {selectedYear && (
                          <div onClick={resetToYear} className="cursor-pointer bg-blue-50 border border-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-xs font-bold hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors flex items-center group">
                            Tahun: {selectedYear} <X className="w-3 h-3 ml-1.5 text-blue-400 group-hover:text-red-500" />
                          </div>
                        )}
                        {selectedMonth && (
                          <div onClick={resetToMonth} className="cursor-pointer bg-blue-50 border border-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-xs font-bold hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors flex items-center group">
                            Bulan: {selectedMonth.replace(/^\d+\.\s*/, '')} <X className="w-3 h-3 ml-1.5 text-blue-400 group-hover:text-red-500" />
                          </div>
                        )}
                        {selectedPeriod && (
                          <div onClick={resetToPeriod} className="cursor-pointer bg-blue-50 border border-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-xs font-bold hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors flex items-center group">
                            Periode: {selectedPeriod} <X className="w-3 h-3 ml-1.5 text-blue-400 group-hover:text-red-500" />
                          </div>
                        )}
                      </div>
                    )}

                    <div className="max-w-sm">
                      {activeStep === 'year' && (
                        <div>
                          <div className="flex items-center space-x-2 mb-2">
                            <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">TAHUN</label>
                          </div>
                          <select 
                            className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 bg-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 hover:border-blue-300 shadow-sm transition-all duration-200 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%239CA3AF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px_12px] bg-no-repeat bg-[right_16px_center]"
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
                          <div className="flex items-center space-x-2 mb-2">
                            <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">BULAN</label>
                          </div>
                          <select 
                            className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 bg-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 hover:border-blue-300 shadow-sm transition-all duration-200 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%239CA3AF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px_12px] bg-no-repeat bg-[right_16px_center]"
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
                          <div className="flex items-center space-x-2 mb-2">
                            <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">PERIODE</label>
                          </div>
                          <select 
                            className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 bg-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 hover:border-blue-300 shadow-sm transition-all duration-200 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%239CA3AF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px_12px] bg-no-repeat bg-[right_16px_center]"
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
                          <div className="flex items-center space-x-2 mb-2">
                            <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">FILE / WEEK</label>
                          </div>
                          <select 
                            className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 bg-white focus:outline-none focus:border-blue-500 shadow-sm appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%239CA3AF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:10px_10px] bg-no-repeat bg-[right_16px_center]"
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
                    className={`flex items-center space-x-2 px-6 py-2.5 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm mb-4 ${isSaving ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#10B981] hover:bg-[#059669]'}`}
                    onClick={handleSaveActiveFile}
                    disabled={isSaving}
                  >
                    {isSaving ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>{isSaving ? 'Membaca Excel...' : 'Simpan sebagai File Utama'}</span>
                  </button>

                  <div className="bg-[#F0FDF4] border border-[#DCFCE7] rounded-lg p-3 flex items-center space-x-2.5 text-xs">
                    <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                    <div className="text-gray-800 flex-1">
                      <span className="font-bold">File Utama saat ini:</span> {selectedFile || 'Belum ada file yang dipilih'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3 - Reset Data */}
            <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden mt-6">
              <div className="p-5">
                <div className="flex items-start space-x-4 mb-2">
                  <div className="w-7 h-7 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold flex-shrink-0 mt-0.5 text-sm">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Reset Database</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Hapus semua data sinkronisasi dan riwayat file yang tersimpan di browser.</p>
                  </div>
                </div>
                <div className="ml-11 mt-4">
                  <button 
                    onClick={handleClearDatabase}
                    className="flex items-center space-x-2 px-6 py-2.5 bg-white border border-red-200 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-50 transition-colors shadow-sm"
                  >
                    <span>Kosongkan Database</span>
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
