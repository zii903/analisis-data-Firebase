import { useEffect, useState, useRef } from 'react';

let isFirstAppLoad_DetailArea = true;
import { Search, Clock, BarChart2, Settings2, X, Factory, Activity } from 'lucide-react';
import { useFilter } from '../contexts/FilterContext';
import { useFolderSyncContext } from '../contexts/FolderSyncContext';
import { useMachineData } from '../hooks/useMachineData';
import { daysKeys, dayColors, formatDurasi } from '../utils/constants';
import { Link } from 'react-router-dom';

export default function DetailArea() {
  const [searchTerm, setSearchTerm] = useState('');
  const [animateBars, setAnimateBars] = useState(false);
  const [selectedDay, setSelectedDay] = useState('Semua Hari');
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [modalTab, setModalTab] = useState('Planned');
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  
  const { selectedFile } = useFilter();
  const { needsPermission, startWatching } = useFolderSyncContext();
  const { machineStats: groupedData } = useMachineData();

  const isFirstComponentMount = useRef(true);
  const prevDataStr = useRef('');
  const prevValuesRef = useRef({});
  const hasDataChangedRef = useRef(false);

  useEffect(() => {
    if (groupedData && groupedData.length > 0) {
      const timer = setTimeout(() => setAnimateBars(true), 50);
      return () => clearTimeout(timer);
    } else {
      setAnimateBars(false);
    }
  }, [groupedData]);

  // Efek memutar angka (odometer)
  useEffect(() => {
    if (groupedData.length === 0) return;

    const currentDataStr = JSON.stringify(groupedData) + '_' + selectedDay;
    if (prevDataStr.current !== currentDataStr) {
      hasDataChangedRef.current = true;
      prevDataStr.current = currentDataStr;
    }

    let isFirstMountAnim = false;

    if (isFirstComponentMount.current) {
      isFirstComponentMount.current = false;
      if (isFirstAppLoad_DetailArea) {
        isFirstAppLoad_DetailArea = false;
        isFirstMountAnim = true;
      } else {
        hasDataChangedRef.current = false;
      }
    }

    let animationFrames = [];
    const animateValue = (obj, start, end, duration) => {
      let startTimestamp = null;
      const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        const current = easeProgress * (end - start) + start;
        obj.textContent = current.toLocaleString('id-ID', { maximumFractionDigits: 0 });
        if (progress < 1) {
          animationFrames.push(window.requestAnimationFrame(step));
        } else {
          obj.textContent = end.toLocaleString('id-ID', { maximumFractionDigits: 0 });
        }
      };
      animationFrames.push(window.requestAnimationFrame(step));
    };

    const timeout = setTimeout(() => {
      const shouldAnimate = isFirstMountAnim || hasDataChangedRef.current;

      const odometerElements = document.querySelectorAll('.odometer-value');
      odometerElements.forEach(el => {
        const id = el.getAttribute('data-id');
        const valStr = el.getAttribute('data-value');
        const finalNum = valStr ? parseFloat(valStr) : parseInt(el.textContent.replace(/\./g, ''));

        const prevNum = prevValuesRef.current[id] !== undefined ? prevValuesRef.current[id] : 0;

        if (shouldAnimate && !isNaN(finalNum) && finalNum !== prevNum) {
          animateValue(el, prevNum, finalNum, 1500);
        } else if (!isNaN(finalNum)) {
          el.textContent = finalNum.toLocaleString('id-ID', { maximumFractionDigits: 0 });
        }

        if (!isNaN(finalNum)) {
          prevValuesRef.current[id] = finalNum;
        }
      });

      hasDataChangedRef.current = false;
    }, 100);

    return () => {
      clearTimeout(timeout);
      animationFrames.forEach(id => window.cancelAnimationFrame(id));
    };
  }, [groupedData, searchTerm, selectedDay]);

  const displayFileName = selectedFile ? selectedFile.split(/[\\/]/).pop() : 'Belum ada file';

  const displayData = groupedData.map(g => {
    let totalActual = 0;
    let totalUnplanned = 0;
    let cumulativeActual = 0;

    if (selectedDay === 'Semua Hari') {
      Object.values(g.daily).forEach(d => {
        totalActual += d.total;
        totalUnplanned += d.unplan;
      });
      cumulativeActual = totalActual;
    } else if (g.daily[selectedDay]) {
      totalActual = g.daily[selectedDay].total;
      totalUnplanned = g.daily[selectedDay].unplan;

      const selectedIdx = daysKeys.indexOf(selectedDay);
      for (let i = 0; i <= selectedIdx; i++) {
        cumulativeActual += g.daily[daysKeys[i]].total;
      }
    }

    const remaining = g.target - cumulativeActual;
    const progress = g.target > 0 ? Math.round((totalActual / g.target) * 100) : 0;

    return {
      area: g.name,
      target: g.target,
      actual: totalActual,
      remaining: remaining > 0 ? remaining : 0,
      unplanned: totalUnplanned,
      procTime: g.procTimeTotal > 0 ? `${g.procTimeTotal.toLocaleString('id-ID', { maximumFractionDigits: 3 })}` : '0',
      estimasiSisaWaktu: g.estimasiSisaWaktuTotal || 0,
      estimasiSisaWaktuFormatted: formatDurasi(g.estimasiSisaWaktuTotal || 0),
      estimasiSisaWaktuSingkat: `${Math.floor(g.estimasiSisaWaktuTotal || 0).toLocaleString('id-ID')} Jam`,
      progress,
      daily: g.daily,
      materials: Object.values(g.materialsDict)
    };
  });

  const filteredData = displayData.filter(item => item.area.toLowerCase().includes(searchTerm.toLowerCase()));

  const renderModal = () => {
    if (!selectedMachine) return null;

    const materials = selectedMachine.materials || [];
    const countPlanned = materials.filter(m => m.isPlanned).length;
    const countUnplanned = materials.filter(m => !m.isPlanned).length;

    const isShowingPlanned = modalTab === 'Planned';
    let filteredMaterials = materials.filter(m => m.isPlanned === isShowingPlanned);

    if (modalSearchTerm) {
      const lowerSearch = modalSearchTerm.toLowerCase();
      filteredMaterials = filteredMaterials.filter(m =>
        String(m.status || '').toLowerCase().includes(lowerSearch) ||
        String(m.description || '').toLowerCase().includes(lowerSearch) ||
        String(m.proNumber || '').toLowerCase().includes(lowerSearch) ||
        String(m.customer || '').toLowerCase().includes(lowerSearch)
      );
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[88vh] max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">

          {/* Compact Modal Header */}
          <div className="flex items-center justify-between px-6 py-3.5 border-b border-gray-100 shrink-0 bg-white">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-xs">
                <Factory className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-900 leading-tight">{selectedMachine.area}</h2>
                <p className="text-[10px] text-gray-500 font-medium">Detail pengerjaan & daftar material lini produksi</p>
              </div>
            </div>
            <button 
              onClick={() => setSelectedMachine(null)} 
              className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Slim 4-Card Summary Bar */}
          <div className="px-6 py-2.5 bg-gray-50/80 border-b border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
            <div className="bg-white rounded-xl p-2 px-3 border border-gray-200/90 flex flex-col items-center justify-center text-center shadow-xs">
              <p className="text-[9px] font-extrabold text-gray-400 tracking-wider uppercase">TARGET</p>
              <p className="text-lg font-black text-gray-900 leading-tight">{selectedMachine.target.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="bg-white rounded-xl p-2 px-3 border border-gray-200/90 flex flex-col items-center justify-center text-center shadow-xs">
              <p className="text-[9px] font-extrabold text-blue-500 tracking-wider uppercase">ACTUAL OUTPUT</p>
              <p className="text-lg font-black text-blue-600 leading-tight">{selectedMachine.actual.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="bg-white rounded-xl p-2 px-3 border border-gray-200/90 flex flex-col items-center justify-center text-center shadow-xs">
              <p className="text-[9px] font-extrabold text-gray-400 tracking-wider uppercase">REMAINING</p>
              <p className="text-lg font-black text-gray-900 leading-tight">{selectedMachine.remaining.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="bg-white rounded-xl p-2 px-3 border border-gray-200/90 flex flex-col items-center justify-center text-center shadow-xs">
              <p className="text-[9px] font-extrabold text-gray-400 tracking-wider uppercase">TOTAL PROC. TIME</p>
              <p className="text-lg font-black text-gray-900 leading-tight">{selectedMachine.procTime} <span className="text-xs text-gray-500 font-medium">Jam</span></p>
            </div>
          </div>

          {/* Combined Tabs & Search Toolbar (Single compact row) */}
          <div className="px-6 py-2.5 border-b border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 bg-white">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setModalTab('Planned')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                  modalTab === 'Planned' 
                    ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-xs' 
                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                }`}
              >
                <span>Planned</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  modalTab === 'Planned' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                }`}>{countPlanned}</span>
              </button>

              <button
                onClick={() => setModalTab('Unplanned')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                  modalTab === 'Unplanned' 
                    ? 'bg-red-50 text-red-700 border-red-200 shadow-xs' 
                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                }`}
              >
                <span>Unplanned</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  modalTab === 'Unplanned' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600'
                }`}>{countUnplanned}</span>
              </button>
            </div>

            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <span className="hidden md:inline-block text-xs font-semibold text-gray-500">
                Menampilkan: <strong className="text-blue-600">{filteredMaterials.length}</strong> Material
              </span>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                <input
                  type="text"
                  placeholder="Cari status, material, PRO, customer..."
                  className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-xs"
                  value={modalSearchTerm}
                  onChange={(e) => setModalSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Spacious Material Table (Takes ~75% of modal height) */}
          <div className="flex-1 overflow-y-auto min-h-0 bg-white">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="text-[11px] text-gray-400 font-bold uppercase tracking-wider bg-gray-50 sticky top-0 border-b border-gray-200 z-10">
                <tr>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Customer / PRO</th>
                  <th className="px-5 py-3">Material Description</th>
                  <th className="px-5 py-3 text-right">Qty Prod</th>
                  <th className="px-5 py-3 text-right">Actual</th>
                  <th className="px-5 py-3 text-right">Remain</th>
                  <th className="px-5 py-3 text-right">Est. Sisa Waktu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {filteredMaterials.length > 0 ? filteredMaterials.map((mat, i) => {
                  let actual = 0;
                  let cumulativeActual = 0;

                  if (selectedDay === 'Semua Hari') {
                    actual = Object.values(mat.dailyActuals).reduce((a, b) => a + b, 0);
                    cumulativeActual = actual;
                  } else {
                    actual = mat.dailyActuals[selectedDay] || 0;
                    const selectedIdx = daysKeys.indexOf(selectedDay);
                    for (let d = 0; d <= selectedIdx; d++) {
                      cumulativeActual += (mat.dailyActuals[daysKeys[d]] || 0);
                    }
                  }

                  const remaining = mat.qtyProduksi - cumulativeActual;
                  const rawStatusText = mat.rawStatus || mat.status || 'UNPLAN';

                  return (
                    <tr key={i} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-5 py-2.5">
                        <span 
                          className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider inline-flex items-center ${
                            isShowingPlanned 
                              ? 'bg-blue-50 text-blue-700 border border-blue-200/80' 
                              : 'bg-red-50 text-red-700 border border-red-200/80'
                          }`}
                        >
                          {rawStatusText}
                        </span>
                      </td>
                      <td className="px-5 py-2.5">
                        <div className="font-bold text-gray-900 mb-0.5">{mat.customer || '-'}</div>
                        {(!mat.proNumber || String(mat.proNumber).startsWith('DRAFT-ROW')) ? (
                          <div className="flex items-center gap-1 text-[10px] text-gray-400 bg-gray-100/70 px-1.5 py-0.5 rounded w-fit">
                            <span className="font-bold">PRO</span> -
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-[10px] text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded w-fit font-mono font-medium">
                            <span className="font-bold text-gray-400">PRO</span> {mat.proNumber}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-2.5 font-semibold text-gray-800">{mat.description || '-'}</td>
                      <td className="px-5 py-2.5 text-right font-bold text-gray-900">{mat.qtyProduksi.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</td>
                      <td className="px-5 py-2.5 text-right font-black text-blue-600">{actual.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</td>
                      <td className="px-5 py-2.5 text-right font-bold text-gray-900">{remaining > 0 ? remaining.toLocaleString('id-ID', { maximumFractionDigits: 0 }) : '0'}</td>
                      <td className="px-5 py-2.5 text-right font-bold text-gray-900">{mat.estimasiSisaWaktu > 0 ? formatDurasi(mat.estimasiSisaWaktu) : '0 Jam'}</td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400 font-medium">
                      Tidak ada material yang ditemukan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#F5F6F8] overflow-hidden select-none">
      {/* Top Navigation */}
      <header className="bg-white h-16 px-6 flex items-center justify-between border-b border-gray-200 shadow-sm relative shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-blue-500/20 flex-shrink-0">
            <Factory className="w-5 h-5" />
          </div>
          <div className="flex flex-col justify-center">
            <h1 className="text-lg font-extrabold text-gray-900 leading-none">Detail Area</h1>
            <p className="text-[10px] text-gray-500 font-bold tracking-[0.15em] mt-1 uppercase">Production Progress Dashboard</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <select
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 shadow-xs outline-none appearance-none pr-7 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%236B7280%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:9px_9px] bg-no-repeat bg-[right_10px_center]"
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
          >
            <option value="Semua Hari">Semua Hari</option>
            {daysKeys.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <Link to="/" className="flex items-center space-x-1.5 px-3.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 shadow-xs transition-colors">
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Chart Dashboard</span>
          </Link>
          <Link to="/processing-time" className="flex items-center space-x-1.5 px-3.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 shadow-xs transition-colors">
            <Clock className="w-3.5 h-3.5" />
            <span>Processing Time</span>
          </Link>
          <Link to="/production-monitoring" className="flex items-center space-x-1.5 px-3.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 shadow-xs transition-colors">
            <Activity className="w-3.5 h-3.5" />
            <span>Monitoring</span>
          </Link>
          <Link to="/settings" className="flex items-center space-x-1.5 px-3.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 shadow-xs transition-colors">
            <Settings2 className="w-3.5 h-3.5" />
            <span>Pengaturan</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="p-8 flex-1 flex flex-col items-center overflow-y-auto min-h-0">
        <div className="w-full max-w-2xl">
          {needsPermission && (
            <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center justify-between shadow-sm">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600">
                  <span className="font-bold text-sm">!</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-yellow-800">Sinkronisasi Otomatis Terhenti</p>
                  <p className="text-xs text-yellow-600">Browser direstart. Klik tombol di samping untuk melanjutkan sinkronisasi.</p>
                </div>
              </div>
              <button 
                onClick={() => startWatching(true)}
                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold rounded shadow transition-colors"
              >
                Lanjutkan Sinkronisasi
              </button>
            </div>
          )}

          <div className="flex justify-center mb-6">
            <div className="px-6 py-2 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-600 shadow-sm">
              Menampilkan: <span className="text-blue-600 font-bold">{displayFileName}</span>
            </div>
          </div>

          <div className="relative mb-8">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-11 pr-4 py-3.5 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm shadow-sm transition-colors"
              placeholder="Cari mesin / area produksi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap justify-center items-center gap-6 mb-10 text-sm font-medium text-gray-600">
            <div className="flex items-center space-x-2"><div className="w-3 h-3 rounded bg-blue-500"></div><span>Senin</span></div>
            <div className="flex items-center space-x-2"><div className="w-3 h-3 rounded bg-green-500"></div><span>Selasa</span></div>
            <div className="flex items-center space-x-2"><div className="w-3 h-3 rounded bg-yellow-400"></div><span>Rabu</span></div>
            <div className="flex items-center space-x-2"><div className="w-3 h-3 rounded bg-orange-500"></div><span>Kamis</span></div>
            <div className="flex items-center space-x-2"><div className="w-3 h-3 rounded bg-purple-500"></div><span>Jumat</span></div>
            <div className="flex items-center space-x-2"><div className="w-3 h-3 rounded bg-pink-500"></div><span>Sabtu</span></div>
            <div className="flex items-center space-x-2"><div className="w-3 h-3 rounded bg-red-500"></div><span>Minggu</span></div>
          </div>

          <div className="space-y-6">
            {filteredData.map((item, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => {
                  setSelectedMachine(item);
                  setModalTab('Planned');
                  setModalSearchTerm('');
                }}
              >
                <h2 className="text-xl font-bold text-gray-900 mb-5">{item.area}</h2>

                <div className="bg-gray-50 rounded-xl py-4 border border-gray-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-y-4 mb-5">
                  <div className="text-center px-2">
                    <p className="text-[10px] font-extrabold text-gray-400 mb-1 tracking-widest uppercase">TARGET</p>
                    <p className="text-base font-bold text-gray-900 odometer-value" data-id={`${item.area}_target`} data-value={item.target}>{item.target.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</p>
                  </div>
                  <div className="text-center px-2 border-l border-gray-200">
                    <p className="text-[10px] font-extrabold text-gray-400 mb-1 tracking-widest uppercase">ACTUAL</p>
                    <p className="text-base font-bold text-blue-500 odometer-value" data-id={`${item.area}_actual`} data-value={item.actual}>{item.actual.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</p>
                  </div>
                  <div className="text-center px-2 border-l-0 sm:border-l border-gray-200">
                    <p className="text-[10px] font-extrabold text-gray-400 mb-1 tracking-widest uppercase">REMAINING</p>
                    <p className="text-base font-bold text-gray-900 odometer-value" data-id={`${item.area}_remaining`} data-value={item.remaining}>{item.remaining.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</p>
                  </div>
                  <div className="text-center px-2 border-l sm:border-l-0 lg:border-l border-gray-200">
                    <p className="text-[10px] font-extrabold text-gray-400 mb-1 tracking-widest uppercase">UNPLANNED</p>
                    <p className="text-base font-bold text-red-500 odometer-value" data-id={`${item.area}_unplanned`} data-value={item.unplanned}>{item.unplanned.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</p>
                  </div>
                  <div className="text-center px-2 border-l-0 sm:border-l border-gray-200">
                    <p className="text-[10px] font-extrabold text-gray-400 mb-1 tracking-widest uppercase whitespace-nowrap">PROC. TIME</p>
                    <p className="text-base font-bold text-gray-900 flex items-baseline justify-center gap-1 whitespace-nowrap">{item.procTime} <span className="text-xs text-gray-500 font-medium">Jam</span></p>
                  </div>
                </div>

                <div className="flex justify-between text-sm font-bold text-gray-900 mb-2 mt-4">
                  <span>Progress</span>
                  <span>{item.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 flex overflow-hidden">
                  {daysKeys.map(day => {
                    const isActive = selectedDay === 'Semua Hari' || selectedDay === day;
                    const dayTotal = isActive ? item.daily[day].total : 0;
                    
                    const safeTarget = item.target > 0 ? item.target : Math.max(item.actual, 1);
                    const widthPercent = animateBars ? Math.min((dayTotal / safeTarget) * 100, 100) : 0;

                    return (
                      <div
                        key={day}
                        style={{ width: `${widthPercent}%`, backgroundColor: dayColors[day].base }}
                        className="h-full transition-all duration-[1500ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                      ></div>
                    );
                  })}
                </div>
              </div>
            ))}

            {filteredData.length === 0 && (
              <div className="text-center text-gray-500 py-10 bg-white border-2 border-dashed border-gray-300 rounded-2xl">
                {selectedFile ? 'Tidak ada data mesin yang cocok dengan pencarian.' : 'Pilih file terlebih dahulu di Pengaturan.'}
              </div>
            )}
          </div>
        </div>
      </div>
      {renderModal()}
    </div>
  );
}
