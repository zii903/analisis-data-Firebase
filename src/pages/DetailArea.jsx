import { useEffect, useState, useRef } from 'react';

let isFirstAppLoad_DetailArea = true;
import { get } from 'idb-keyval';
import { Search, Clock, BarChart2, Settings2, Circle, X, Factory } from 'lucide-react';
import { useFilter } from '../contexts/FilterContext';
import { useFolderSyncContext } from '../contexts/FolderSyncContext';
import { Link } from 'react-router-dom';

const daysKeys = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const dayColors = {
  Senin: '#3B82F6',
  Selasa: '#10B981',
  Rabu: '#EAB308',
  Kamis: '#F97316',
  Jumat: '#8B5CF6',
  Sabtu: '#EC4899',
  Minggu: '#EF4444',
};

const formatDurasi = (totalJam) => {
  if (!totalJam || totalJam <= 0) return '0 Jam';
  const jam = Math.floor(totalJam);
  const menit = Math.round((totalJam - jam) * 60);
  if (jam === 0) return `${menit} Menit`;
  if (menit === 0) return `${jam.toLocaleString('id-ID')} Jam`;
  return `${jam.toLocaleString('id-ID')} Jam ${menit} Menit`;
};

export default function DetailArea() {
  const [loading, setLoading] = useState(false);
  const [groupedData, setGroupedData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [animateBars, setAnimateBars] = useState(false);
  const [selectedDay, setSelectedDay] = useState('Semua Hari');
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [modalTab, setModalTab] = useState('Planned');
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const { selectedFile } = useFilter();
  const { isSyncing } = useFolderSyncContext();

  const isFirstComponentMount = useRef(true);
  const prevDataStr = useRef('');
  const prevValuesRef = useRef({});
  const hasDataChangedRef = useRef(false);

  useEffect(() => {
    if (isSyncing) return;

    const fetchData = async () => {
      if (!selectedFile) {
        setGroupedData([]);
        return;
      }
      try {
        setLoading(true);
        const safeId = selectedFile.replace(/[\/\\]/g, '_');
        const rows = await get(`file_data_${safeId}`) || [];
        const grouped = {};
        rows.forEach((row) => {
          const machineName = row.machine_name || 'Unknown';
          if (!grouped[machineName]) {
            grouped[machineName] = {
              area: machineName,
              target: 0,
              procTimeTotal: 0,
              estimasiSisaWaktuTotal: 0,
              seenMaterials: new Set(),
              materialsDict: {},
              daily: {
                Senin: { planned: 0, unplan: 0, total: 0 },
                Selasa: { planned: 0, unplan: 0, total: 0 },
                Rabu: { planned: 0, unplan: 0, total: 0 },
                Kamis: { planned: 0, unplan: 0, total: 0 },
                Jumat: { planned: 0, unplan: 0, total: 0 },
                Sabtu: { planned: 0, unplan: 0, total: 0 },
                Minggu: { planned: 0, unplan: 0, total: 0 }
              }
            };
          }

          const g = grouped[machineName];
          const daily = typeof row.daily_details === 'string' ? JSON.parse(row.daily_details) : row.daily_details;
          const excelRowIdx = daily?.excel_row_index || 0;
          const materialKey = `${row.customer}_${row.pro_number}_${row.description}_${row.qty_produksi}_${excelRowIdx}`;
          const statusRaw = (row.status || '').toString().trim().toLowerCase();
          const isPlanned = statusRaw === 'planning' || statusRaw === 'planing' || statusRaw === 'backlog';
          const estWaktu = Number(row.estimasi_sisa_waktu || 0);

          if (!g.seenMaterials.has(materialKey)) {
            if (isPlanned) {
              g.target += Number(row.qty_produksi || 0);
            }
            g.seenMaterials.add(materialKey);

            g.materialsDict[materialKey] = {
              key: materialKey,
              status: row.status || '',
              isPlanned,
              customer: row.customer || '',
              proNumber: row.pro_number || '',
              description: row.description || '',
              qtyProduksi: Number(row.qty_produksi || 0),
              estimasiSisaWaktu: estWaktu,
              dailyActuals: {
                Senin: 0, Selasa: 0, Rabu: 0, Kamis: 0, Jumat: 0, Sabtu: 0, Minggu: 0
              }
            };
            g.estimasiSisaWaktuTotal += estWaktu;
          }

          const mat = g.materialsDict[materialKey];
          g.procTimeTotal += Number(row.waktu_proses || 0);

          if (daily) {
            for (const [k, v] of Object.entries(daily)) {
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

        setGroupedData(Object.values(grouped));
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedFile, isSyncing]);

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
      area: g.area,
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">

          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <h2 className="text-3xl font-bold text-gray-900">{selectedMachine.area}</h2>
            <button onClick={() => setSelectedMachine(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 bg-gray-50 flex flex-wrap items-stretch gap-4 border-b border-gray-100">
            <div className="bg-white rounded-xl p-4 border border-gray-200 flex-1 min-w-[160px] flex flex-col items-center justify-center text-center shadow-sm">
              <p className="text-[11px] font-bold text-gray-400 mb-2 tracking-widest uppercase">Target</p>
              <p className="text-2xl font-bold text-gray-900">{selectedMachine.target.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200 flex-1 min-w-[160px] flex flex-col items-center justify-center text-center shadow-sm">
              <p className="text-[11px] font-bold text-gray-400 mb-2 tracking-widest uppercase">Actual Output</p>
              <p className="text-2xl font-bold text-blue-500">{selectedMachine.actual.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200 flex-1 min-w-[160px] flex flex-col items-center justify-center text-center shadow-sm">
              <p className="text-[11px] font-bold text-gray-400 mb-2 tracking-widest uppercase">Remaining</p>
              <p className="text-2xl font-bold text-gray-900">{selectedMachine.remaining.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200 flex-1 min-w-[160px] flex flex-col items-center justify-center text-center shadow-sm">
              <p className="text-[11px] font-bold text-gray-400 mb-2 tracking-widest uppercase">Total Processing Time</p>
              <p className="text-2xl font-bold text-gray-900">{selectedMachine.procTime} <span className="text-sm text-gray-500 font-medium">Jam</span></p>
            </div>
          </div>

          <div className="p-6 border-b border-gray-100 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-gray-500 tracking-wider text-sm">DAFTAR MATERIAL</h3>
              <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">Menampilkan: <span className="font-bold text-blue-600">{filteredMaterials.length}</span> Material</span>
            </div>

            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Cari status, material, PRO, atau customer..."
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
                value={modalSearchTerm}
                onChange={(e) => setModalSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setModalTab('Planned')}
                className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-bold transition-all border ${modalTab === 'Planned' ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm' : 'bg-transparent text-gray-500 border-transparent hover:bg-gray-100'
                  }`}
              >
                Planned
                <span className={`px-2 py-0.5 rounded-full text-xs ${modalTab === 'Planned' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>{countPlanned}</span>
              </button>
              <button
                onClick={() => setModalTab('Unplanned')}
                className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-bold transition-all border ${modalTab === 'Unplanned' ? 'bg-red-50 text-red-700 border-red-200 shadow-sm' : 'bg-transparent text-gray-500 border-transparent hover:bg-gray-100'
                  }`}
              >
                Unplanned
                <span className={`px-2 py-0.5 rounded-full text-xs ${modalTab === 'Unplanned' ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-600'}`}>{countUnplanned}</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-400 font-bold uppercase tracking-wider bg-white sticky top-0 border-b border-gray-100 z-10 shadow-sm">
                <tr>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Customer / PRO</th>
                  <th className="px-6 py-4">Material Description</th>
                  <th className="px-6 py-4 text-right">Qty Prod</th>
                  <th className="px-6 py-4 text-right">Actual</th>
                  <th className="px-6 py-4 text-right">Remain</th>
                  <th className="px-6 py-4 text-right">Est. Sisa Waktu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredMaterials.length > 0 ? filteredMaterials.map((mat, i) => {
                  let actual = 0;
                  let cumulativeActual = 0;

                  if (selectedDay === 'Semua Hari') {
                    actual = Object.values(mat.dailyActuals).reduce((a, b) => a + b, 0);
                    cumulativeActual = actual;
                  } else {
                    actual = mat.dailyActuals[selectedDay] || 0;
                    const selectedIdx = daysKeys.indexOf(selectedDay);
                    for (let i = 0; i <= selectedIdx; i++) {
                      cumulativeActual += (mat.dailyActuals[daysKeys[i]] || 0);
                    }
                  }

                  const remaining = mat.qtyProduksi - cumulativeActual;

                  return (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${isShowingPlanned ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'
                          }`}>
                          {mat.status || 'UNPLANNED'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900 mb-1">{mat.customer || '-'}</div>
                        {(!mat.proNumber || String(mat.proNumber).startsWith('DRAFT-ROW')) ? (
                          <div className="flex items-center gap-1 text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded w-fit">
                            <span className="font-bold">PRO</span> -
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded w-fit">
                            <span className="font-bold">PRO</span> {mat.proNumber}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-700">{mat.description || '-'}</td>
                      <td className="px-6 py-4 text-right font-bold text-gray-900">{mat.qtyProduksi.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</td>
                      <td className="px-6 py-4 text-right font-bold text-blue-600">{actual.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</td>
                      <td className="px-6 py-4 text-right font-bold text-gray-900">{remaining > 0 ? remaining.toLocaleString('id-ID', { maximumFractionDigits: 0 }) : '0'}</td>
                      <td className="px-6 py-4 text-right font-bold text-gray-900">{mat.estimasiSisaWaktu > 0 ? formatDurasi(mat.estimasiSisaWaktu) : '0 Jam'}</td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-gray-400 font-medium">
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
    <div className="flex flex-col h-full bg-[#F5F6F8]">
      {/* Top Navigation */}
      <header className="bg-white h-20 px-8 flex items-center justify-between border-b border-gray-200 shadow-sm relative">
        <div className="flex items-center space-x-4">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-blue-500/20 flex-shrink-0">
            <Factory className="w-6 h-6" />
          </div>
          <div className="flex flex-col justify-center">
            <h1 className="text-xl font-extrabold text-gray-900 leading-none">Detail Area</h1>
            <p className="text-[11px] text-gray-500 font-bold tracking-[0.15em] mt-1 uppercase">Production Progress Dashboard</p>
          </div>
        </div>

        {/* Live indicator removed based on user request */}

        <div className="flex items-center space-x-3">
          <select
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 shadow-sm outline-none appearance-none pr-8 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%236B7280%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:10px_10px] bg-no-repeat bg-[right_12px_center]"
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
          >
            <option value="Semua Hari">Semua Hari</option>
            {daysKeys.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <Link to="/processing-time" className="flex items-center space-x-2 px-5 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 shadow-sm transition-colors">
            <Clock className="w-4 h-4" />
            <span>Processing Time</span>
          </Link>
          <Link to="/" className="flex items-center space-x-2 px-5 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 shadow-sm transition-colors">
            <BarChart2 className="w-4 h-4" />
            <span>Chart Dashboard</span>
          </Link>
          <Link to="/settings" className="flex items-center space-x-2 px-5 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 shadow-sm transition-colors">
            <Settings2 className="w-4 h-4" />
            <span>Pengaturan</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="p-8 flex-1 flex flex-col items-center overflow-y-auto">

        <div className="w-full max-w-2xl">
          <div className="flex justify-center mb-6">
            <div className="px-6 py-2 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-600 shadow-sm">
              Menampilkan: <span className="text-blue-600">{displayFileName}</span>
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
                        style={{ width: `${widthPercent}%`, backgroundColor: dayColors[day] }}
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
