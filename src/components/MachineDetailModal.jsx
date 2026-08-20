import React, { useState } from 'react';
import { X, Factory, AlertTriangle, Boxes, ChevronLeft, ChevronRight } from 'lucide-react';

export default function MachineDetailModal({ selectedMachineModal, onClose }) {
  const [activeTab, setActiveTab] = useState('remaining'); // 'remaining' | 'completed'
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  if (!selectedMachineModal) return null;

  // Pre-process materials to calculate actual and remaining, just like before
  const processedMaterials = selectedMachineModal.materials
    .filter(m => m.isPlanned)
    .map(mat => {
      const actualMat = mat.dailyActuals ? Object.values(mat.dailyActuals).reduce((a, b) => a + Number(b || 0), 0) : 0;
      const rem = mat.variant < 0 ? Math.max(0, Number(mat.qtyProduksi || 0) - actualMat) : 0;
      return { ...mat, calculatedActual: actualMat, calculatedRemaining: rem };
    });

  // Filter based on active tab
  const filteredMaterials = processedMaterials.filter(mat => {
    if (activeTab === 'remaining') {
      return mat.calculatedRemaining > 0;
    } else {
      // Completed: either remaining is 0 (and was initially planned) and actual > 0, or achieved target
      return mat.calculatedRemaining === 0 && mat.calculatedActual > 0;
    }
  });

  // Sort by estimasiSisaWaktu descending for remaining tab, or actual descending for completed
  const sortedMaterials = filteredMaterials.sort((a, b) => {
    if (activeTab === 'remaining') {
      return (b.estimasiSisaWaktu || 0) - (a.estimasiSisaWaktu || 0);
    }
    return b.calculatedActual - a.calculatedActual;
  });

  // Pagination logic
  const totalPages = Math.ceil(sortedMaterials.length / itemsPerPage) || 1;
  const currentItems = sortedMaterials.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentPage(1); // Reset page on tab change
  };

  // calculate excess hours for spillover message
  const currentDay = new Date().getDay();
  let effectiveDay = currentDay;
  if (currentDay === 0 || currentDay === 6) effectiveDay = 5;
  const availableHours = (6 - effectiveDay) * 8;
  const excessHours = Math.ceil(selectedMachineModal.hoursLeft - availableHours);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div 
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>
      
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-sm">
              <Factory className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-900 leading-tight">
                {selectedMachineModal.name}
              </h3>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {selectedMachineModal.areaName}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-0.5">PROGRESS</p>
              <p className="text-base font-black text-blue-600">{selectedMachineModal.progress}% DONE</p>
            </div>
            <div className="h-8 w-px bg-gray-200 hidden sm:block"></div>
            <button 
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
          
          {/* Top Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1">Total Target</p>
              <p className="text-lg font-black text-gray-900">{selectedMachineModal.target.toLocaleString('id-ID')} <span className="text-xs text-gray-500 font-bold">Unit</span></p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1">Total Aktual</p>
              <p className="text-lg font-black text-emerald-600">{selectedMachineModal.actual.toLocaleString('id-ID')} <span className="text-xs text-emerald-500/70 font-bold">Unit</span></p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1">Total Remaining</p>
              <p className="text-lg font-black text-blue-600">{selectedMachineModal.remaining.toLocaleString('id-ID')} <span className="text-xs text-blue-400 font-bold">Unit</span></p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1">Est. Sisa Waktu</p>
              <p className="text-lg font-black text-purple-600">{Math.floor(selectedMachineModal.hoursLeft).toLocaleString('id-ID')} <span className="text-xs text-purple-400 font-bold">Jam</span></p>
            </div>
          </div>

          {/* Spillover Alert if applicable */}
          {selectedMachineModal.willSpillOver && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 shadow-sm">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-red-900 mb-1">Status: Spillover Terdeteksi</h4>
                <p className="text-xs text-red-700 leading-relaxed font-medium">
                  Beban kerja terakumulasi sebesar {Math.floor(selectedMachineModal.hoursLeft)} jam melebihi sisa kapasitas waktu kerja minggu ini. Terdapat proyeksi kelebihan beban (Spillover) sebesar {excessHours} jam yang berpotensi melampaui jadwal produksi yang ditetapkan.
                  {selectedMachineModal.materials.some(m => m.willSpillOver) ? ` Hal ini utamanya dipengaruhi oleh beberapa material dengan estimasi waktu proses yang tinggi.` : ''}
                </p>
              </div>
            </div>
          )}

          {/* Material List Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
            <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Boxes className="w-4 h-4 text-blue-500" />
                Rincian Beban Material
              </h4>
              
              {/* Tabs */}
              <div className="flex space-x-1 bg-gray-200/60 p-1 rounded-lg">
                <button
                  onClick={() => handleTabChange('remaining')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                    activeTab === 'remaining' 
                      ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' 
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                  }`}
                >
                  Belum Selesai ({processedMaterials.filter(m => m.calculatedRemaining > 0).length})
                </button>
                <button
                  onClick={() => handleTabChange('completed')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                    activeTab === 'completed' 
                      ? 'bg-white text-emerald-600 shadow-sm ring-1 ring-black/5' 
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                  }`}
                >
                  Berhasil Dibuat ({processedMaterials.filter(m => m.calculatedRemaining === 0 && m.calculatedActual > 0).length})
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-white shadow-[0_1px_2px_-1px_rgba(0,0,0,0.1)] z-10">
                  <tr className="border-b border-gray-100 text-[10px] uppercase tracking-widest text-gray-400 font-extrabold">
                    <th className="p-4 py-3 font-extrabold">PRO Dan Description</th>
                    <th className="p-4 py-3 font-extrabold text-right">Target</th>
                    <th className="p-4 py-3 font-extrabold text-right">Aktual</th>
                    <th className="p-4 py-3 font-extrabold text-right">Remaining</th>
                    {activeTab === 'remaining' && (
                      <th className="p-4 py-3 font-extrabold text-right text-blue-600 bg-blue-50/30">Sisa Waktu</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-sm">
                  {currentItems.length > 0 ? currentItems.map((mat, idx) => {
                    const isHighImpact = mat.estimasiSisaWaktu > 8;
                    
                    return (
                      <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                        <td className="p-4 py-3">
                          <div className="flex flex-col items-start gap-1.5">
                            {mat.proNumber ? (
                              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200 tracking-wider uppercase">
                                PRO: {mat.proNumber}
                              </span>
                            ) : (
                              <span className="font-bold text-gray-400">-</span>
                            )}
                            <span className="text-[10px] text-gray-500 font-medium line-clamp-2 max-w-[220px] leading-snug">{mat.description || '-'}</span>
                          </div>
                        </td>
                        <td className="p-4 py-3 text-right font-semibold text-gray-600">
                          {Number(mat.qtyProduksi || 0).toLocaleString('id-ID')}
                        </td>
                        <td className="p-4 py-3 text-right font-semibold text-emerald-600">
                          {mat.calculatedActual.toLocaleString('id-ID')}
                        </td>
                        <td className="p-4 py-3 text-right font-bold text-gray-900">
                          {mat.calculatedRemaining.toLocaleString('id-ID')}
                        </td>
                        {activeTab === 'remaining' && (
                          <td className={`p-4 py-3 text-right font-black bg-blue-50/30 ${isHighImpact ? 'text-red-600' : 'text-blue-600'}`}>
                            {Number(mat.estimasiSisaWaktu || 0).toLocaleString('id-ID', { maximumFractionDigits: 1 })} <span className="text-[10px] font-bold text-gray-400">Jam</span>
                          </td>
                        )}
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={activeTab === 'remaining' ? 5 : 4} className="p-8 text-center text-gray-400 font-medium">
                        Tidak ada material dalam kategori ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-5 py-3 border-t border-gray-100 bg-white flex justify-between items-center">
                <p className="text-xs font-semibold text-gray-500">
                  Menampilkan <span className="text-gray-900 font-bold">{(currentPage - 1) * itemsPerPage + 1}</span> hingga <span className="text-gray-900 font-bold">{Math.min(currentPage * itemsPerPage, sortedMaterials.length)}</span> dari <span className="text-gray-900 font-bold">{sortedMaterials.length}</span> material
                </p>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2.5 py-1 rounded-md">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
