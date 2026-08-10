import { useEffect, useState, useMemo, useRef } from 'react';
import { get } from 'idb-keyval';
import { useFilter } from '../contexts/FilterContext';
import { useFolderSyncContext } from '../contexts/FolderSyncContext';
import { Search, FileText, Settings2, BarChart2, Circle, X } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ProcessingTime() {
  const [loading, setLoading] = useState(false);
  const [machines, setMachines] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const { selectedFile } = useFilter();
  const { isSyncing } = useFolderSyncContext();

  // Hanya trigger fetch saat isSyncing selesai (true→false), bukan setiap perubahan
  const prevIsSyncing = useRef(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedFile) {
        setMachines([]);
        return;
      }
      try {
        setLoading(true);
        const safeId = selectedFile.replace(/[\/\\]/g, '_');
        const rows = await get(`file_data_${safeId}`) || [];

        const grouped = {};
        rows.forEach((row, index) => {
          const area = row.machine_name || 'Unknown';
          const ct = Number(row.cycle_time || 0);
          const time = Number(row.waktu_proses || 0);
          const estimasi = Number(row.estimasi_sisa_waktu || 0);
          const subMachine = row.sub_machine || null;

          if (!grouped[area]) {
            grouped[area] = {
              name: area,
              items: 0,
              ctItems: 0,
              time: 0,
              estimasiSisaWaktu: 0,
              subMachines: {},
              materials: [],
            };
          }

          const g = grouped[area];
          g.items += 1;
          if (ct > 0) g.ctItems += 1;
          if (time > 0) g.time += time;
          g.estimasiSisaWaktu += estimasi;

          if (subMachine && time > 0) {
            g.subMachines[subMachine] = (g.subMachines[subMachine] || 0) + time;
          }

          g.materials.push({
            id: `row_${index}`,
            area,
            subMachine,
            ct: ct > 0 ? ct : null,
            time: time > 0 ? time : null,
            status: row.status || 'UNPLAN',
            customer: row.customer || '',
            proNumber: row.pro_number || '',
            description: row.description || '',
            qtyOrder: row.qty_order || 0,
            qtyProduksi: row.qty_produksi || 0,
            estimasiSisaWaktu: estimasi,
            variant: Number(row.variant || 0),
          });
        });

        setMachines(Object.values(grouped));
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedFile]); // hanya re-fetch saat file berubah

  // Re-fetch hanya saat sync SELESAI (isSyncing: true → false)
  useEffect(() => {
    if (prevIsSyncing.current === true && isSyncing === false) {
      const fetchData = async () => {
        if (!selectedFile) return;
        try {
          const safeId = selectedFile.replace(/[\/\\]/g, '_');
          const rows = await get(`file_data_${safeId}`) || [];
          const grouped = {};
          rows.forEach((row, index) => {
            const area = row.machine_name || 'Unknown';
            const ct = Number(row.cycle_time || 0);
            const time = Number(row.waktu_proses || 0);
            const estimasi = Number(row.estimasi_sisa_waktu || 0);
            const subMachine = row.sub_machine || null;
            if (!grouped[area]) {
              grouped[area] = { name: area, items: 0, ctItems: 0, time: 0, estimasiSisaWaktu: 0, subMachines: {}, materials: [] };
            }
            const g = grouped[area];
            g.items += 1;
            if (ct > 0) g.ctItems += 1;
            if (time > 0) g.time += time;
            g.estimasiSisaWaktu += estimasi;
            if (subMachine && time > 0) g.subMachines[subMachine] = (g.subMachines[subMachine] || 0) + time;
            g.materials.push({
              id: `row_${index}`, area, subMachine,
              ct: ct > 0 ? ct : null, time: time > 0 ? time : null,
              status: row.status || 'UNPLAN', customer: row.customer || '',
              proNumber: row.pro_number || '', description: row.description || '',
              qtyOrder: row.qty_order || 0, qtyProduksi: row.qty_produksi || 0,
              estimasiSisaWaktu: estimasi, variant: Number(row.variant || 0),
            });
          });
          setMachines(Object.values(grouped));
        } catch (err) { console.error("Error re-fetching:", err); }
      };
      fetchData();
    }
    prevIsSyncing.current = isSyncing;
  }, [isSyncing, selectedFile]);

  const displayFileName = selectedFile ? selectedFile.split(/[\/\\]/).pop() : 'Belum ada file';

  // useMemo agar tidak re-komputasi setiap render
  const filteredMachines = useMemo(
    () => machines.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase())),
    [machines, searchTerm]
  );

  const { grandTotalEstimasi, grandTotalJam, grandTotalMenit } = useMemo(() => {
    const total = machines.reduce((sum, m) => sum + (m.estimasiSisaWaktu || 0), 0);
    return {
      grandTotalEstimasi: total,
      grandTotalJam: Math.floor(total),
      grandTotalMenit: Math.round((total - Math.floor(total)) * 60),
    };
  }, [machines]);

  // Format jam:menit — stabil, tidak perlu useMemo
  const formatDurasi = (totalJam) => {
    if (totalJam <= 0) return '0 Jam';
    const jam = Math.floor(totalJam);
    const menit = Math.round((totalJam - jam) * 60);
    if (menit === 0) return `${jam.toLocaleString('id-ID')} Jam`;
    return `${jam.toLocaleString('id-ID')} Jam ${menit} Menit`;
  };

  const renderModal = () => {
    if (!selectedMachine) return null;

    let filteredMaterials = selectedMachine.materials || [];
    if (modalSearchTerm) {
      const lowerSearch = modalSearchTerm.toLowerCase();
      filteredMaterials = filteredMaterials.filter(m =>
        String(m.status || '').toLowerCase().includes(lowerSearch) ||
        String(m.customer || '').toLowerCase().includes(lowerSearch) ||
        String(m.proNumber || '').toLowerCase().includes(lowerSearch) ||
        String(m.description || '').toLowerCase().includes(lowerSearch) ||
        String(m.subMachine || '').toLowerCase().includes(lowerSearch)
      );
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 lg:p-8">
        <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity" onClick={() => { setSelectedMachine(null); setModalSearchTerm(''); }}></div>

        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between p-6 md:p-8 border-b border-gray-100">
            <div>
              <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">{selectedMachine.name}</h2>
            </div>
            <button
              onClick={() => { setSelectedMachine(null); setModalSearchTerm(''); }}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 md:p-8 overflow-y-auto flex-1 bg-gray-50/50">
            <div className="mb-6 flex justify-between items-center">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                {Object.keys(selectedMachine.subMachines).length > 0 ? "Machine Summary" : "Detail Material"}
              </h3>
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                Menampilkan: {filteredMaterials.length} Material
              </span>
            </div>

            {Object.keys(selectedMachine.subMachines).length > 0 && (
              <div className="mb-8">
                <div className="flex flex-wrap gap-4">
                  {Object.entries(selectedMachine.subMachines).map(([subName, subTime], sIdx) => {
                    const subMatCount = (selectedMachine.materials || []).filter(m => m.subMachine === subName).length;
                    return (
                      <div key={sIdx} className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex flex-col gap-2 min-w-[150px] shadow-sm">
                        <span className="font-bold text-gray-900 text-sm">{subName}</span>
                        <div className="flex items-center space-x-3">
                          <span className="text-blue-600 text-sm font-extrabold">{subMatCount} <span className="text-xs text-gray-400 font-medium">Material</span></span>
                          <span className="text-purple-600 text-sm font-extrabold">{subTime.toLocaleString('id-ID', { maximumFractionDigits: 2 })} <span className="text-xs text-gray-400 font-medium">Jam</span></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="relative mb-6">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm shadow-sm transition-colors"
                placeholder="Cari status, material, PRO, mesin..."
                value={modalSearchTerm}
                onChange={(e) => setModalSearchTerm(e.target.value)}
              />
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-left text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Customer / PRO</th>
                      <th className="px-6 py-4 text-left text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Material Description</th>
                      <th className="px-6 py-4 text-right text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Qty Order</th>
                      <th className="px-6 py-4 text-right text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Qty Prod.</th>
                      <th className="px-6 py-4 text-right text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">W. Proses</th>
                      <th className="px-6 py-4 text-right text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Cycle Time</th>
                      <th className="px-6 py-4 text-left text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">Mesin</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {filteredMaterials.map((mat, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 inline-flex text-[10px] leading-5 font-bold rounded-full ${mat.status === 'PLANNING' ? 'bg-blue-100 text-blue-800' : (mat.status === 'BACKLOG' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-50 text-blue-600')}`}>
                            {mat.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-bold text-gray-900">{mat.customer || '-'}</div>
                          {(!mat.proNumber || String(mat.proNumber).startsWith('DRAFT-ROW')) ? (
                            <div className="text-[10px] text-gray-400 font-medium mt-0.5 uppercase">PRO -</div>
                          ) : (
                            <div className="text-[10px] text-gray-500 font-medium mt-0.5 uppercase">PRO {mat.proNumber}</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-semibold text-gray-800">{mat.description || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-900">
                          {mat.qtyOrder > 0 ? mat.qtyOrder.toLocaleString('id-ID') : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-900">
                          {mat.qtyProduksi > 0 ? mat.qtyProduksi.toLocaleString('id-ID') : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          {mat.time > 0 ? (
                            <div className="text-sm font-bold text-blue-600">{mat.time.toLocaleString('id-ID', { maximumFractionDigits: 2 })}<span className="text-[10px] text-gray-500 ml-1 font-medium">Jam</span></div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          {mat.ct > 0 ? (
                            <div className="text-sm font-bold text-purple-600">{mat.ct.toLocaleString('id-ID', { maximumFractionDigits: 2 })}<span className="text-[10px] text-gray-500 ml-1 font-medium">Detik</span></div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded inline-block">
                            {mat.subMachine || '-'}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredMaterials.length === 0 && (
                      <tr>
                        <td colSpan="8" className="px-6 py-8 text-center text-sm text-gray-500 bg-gray-50">
                          Tidak ada material yang ditemukan
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
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
          <div className="flex flex-col justify-center">
            <h1 className="text-xl font-extrabold text-gray-900 leading-none">Processing Time</h1>
            <p className="text-[11px] text-gray-500 font-bold tracking-[0.15em] mt-1 uppercase">Processing Time Based on Machine Category</p>
          </div>
        </div>

        {/* Centered Live / Sync Indicator */}
        <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center space-x-2 px-4 py-1.5 border rounded-full text-sm font-bold shadow-sm transition-colors duration-300 bg-white"
          style={{ borderColor: isSyncing ? '#FDBA74' : '#BBF7D0', color: isSyncing ? '#F97316' : '#22C55E' }}>
          <Circle className={`w-3 h-3 ${isSyncing ? 'animate-pulse' : ''}`} style={{ fill: isSyncing ? '#F97316' : '#22C55E' }} />
          <span>{isSyncing ? 'Sinkronisasi...' : 'Live'}</span>
        </div>

        <div className="flex items-center space-x-3">
          <Link to="/detail-area" className="flex items-center space-x-2 px-5 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 shadow-sm transition-colors">
            <FileText className="w-4 h-4" />
            <span>Detail Area</span>
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

          <div className="space-y-6">
            {/* Grand Total Estimasi Sisa Waktu Banner */}
            {grandTotalEstimasi > 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500 mb-1">⏱ Total Estimasi Sisa Waktu Produksi</p>
                    <p className="text-3xl font-black text-gray-900 leading-tight">
                      {grandTotalJam.toLocaleString('id-ID')}
                      <span className="text-base font-bold ml-2 text-gray-500">Jam</span>
                      {grandTotalMenit > 0 && (
                        <span className="text-xl font-bold text-gray-900 ml-2">{grandTotalMenit}<span className="text-base font-bold ml-1 text-gray-500">Menit</span></span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400 mt-2 font-semibold">
                      Estimasi total waktu yang dibutuhkan untuk menyelesaikan seluruh sisa produksi
                    </p>
                  </div>
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-center min-w-[90px]">
                    <p className="text-3xl font-black text-gray-900">{grandTotalEstimasi.toLocaleString('id-ID', { maximumFractionDigits: 1 })}</p>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Total Jam</p>
                  </div>
                </div>
              </div>
            )}

            {filteredMachines.map((machine, idx) => (
              <div key={idx} onClick={() => { setSelectedMachine(machine); setModalSearchTerm(''); }} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm transition-shadow hover:shadow-md cursor-pointer">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-xl font-bold text-gray-900">{machine.name}</h2>
                  <div className="flex space-x-2">
                    <span className="px-3 py-1 bg-blue-50 text-blue-600 text-xs font-extrabold rounded-full">{machine.items} Items</span>
                    {machine.ctItems > 0 && (
                      <span className="px-3 py-1 bg-purple-50 text-purple-600 text-xs font-extrabold rounded-full">CT: {machine.ctItems} items</span>
                    )}
                  </div>
                </div>

                <div className="mb-5">
                  <p className="text-[10px] font-extrabold text-gray-400 mb-1 uppercase tracking-wider">WAKTU PROSES</p>
                  {machine.time > 0 ? (
                    <p className="text-xl font-extrabold text-blue-500">{machine.time.toLocaleString('id-ID', { maximumFractionDigits: 2 })} <span className="text-sm font-bold">jam</span></p>
                  ) : (
                    <p className="text-sm font-semibold text-gray-400">Tidak ada data</p>
                  )}
                </div>

                {machine.estimasiSisaWaktu > 0 && (
                  <div className="mb-4 bg-gray-50 border border-gray-200 rounded-xl px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-0.5">⏱ ESTIMASI SISA WAKTU</p>
                      <p className="text-lg font-black text-gray-900">
                        {formatDurasi(machine.estimasiSisaWaktu)}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-gray-600 bg-gray-200 px-2 py-1 rounded-full">
                      {machine.estimasiSisaWaktu.toLocaleString('id-ID', { maximumFractionDigits: 2 })} Jam
                    </span>
                  </div>
                )}

                {Object.keys(machine.subMachines).length > 0 && (
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 mb-4">
                    <p className="text-[10px] font-extrabold text-gray-400 mb-3 uppercase tracking-wider">DETAIL MESIN</p>
                    <div className="space-y-2">
                      {Object.entries(machine.subMachines).map(([subName, subTime], sIdx) => (
                        <div key={sIdx} className="flex justify-between items-center text-sm">
                          <span className="font-bold text-gray-700">{subName}</span>
                          <span className="font-bold text-blue-600">{subTime.toLocaleString('id-ID', { maximumFractionDigits: 2 })} jam</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-gray-100 mt-2 text-xs font-semibold text-gray-500">
                  Klik untuk melihat detail waktu proses & mesin
                </div>
              </div>
            ))}

            {filteredMachines.length === 0 && (
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
