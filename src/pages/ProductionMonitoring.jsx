import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Clock, FileText, Settings2, BarChart2, Factory, MonitorPlay, AlertTriangle, ChevronDown, Check, TrendingUp, TrendingDown, CheckCircle2, Gauge, BarChart3, Layers, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMachineData } from '../hooks/useMachineData';

// SVG Semi-Radial Gauge Component (Zero Overflow, Perfectly Fitted)
function AdherenceGauge({ adherence }) {
  const isTargetAchieved = adherence >= 100;
  const isWarning = adherence < 80;
  const strokeColor = isTargetAchieved ? '#10b981' : isWarning ? '#ef4444' : '#3b82f6';
  const startColor = isTargetAchieved ? '#059669' : isWarning ? '#dc2626' : '#2563eb';
  const gradientId = "adherenceGaugeGrad";

  // Arc: Center (80, 74), Radius = 58, from (22, 74) to (138, 74)
  // Arc length = PI * 58 = 182.21
  const arcLength = 182.21;
  const percent = Math.min(Math.max(adherence, 0), 100);
  const strokeDashoffset = arcLength * (1 - percent / 100);

  return (
    <div className="relative flex items-center justify-center">
      <svg viewBox="0 0 160 84" className="w-[145px] h-[76px]">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={startColor} />
            <stop offset="100%" stopColor={strokeColor} />
          </linearGradient>
        </defs>
        {/* Background Track */}
        <path
          d="M 22 74 A 58 58 0 0 1 138 74"
          fill="none"
          stroke="#f1f5f9"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* Progress Arc */}
        <path
          d="M 22 74 A 58 58 0 0 1 138 74"
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={arcLength}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out"
        />
        {/* Percentage Label */}
        <text x="80" y="68" textAnchor="middle" className="text-2xl font-black fill-gray-900 tracking-tight">
          {adherence}%
        </text>
        <text x="80" y="80" textAnchor="middle" className="text-[8px] font-bold fill-gray-400 uppercase tracking-widest">
          Adherence
        </text>
      </svg>
    </div>
  );
}

export default function ProductionMonitoring() {
  const { machineStats, loading } = useMachineData();
  const [adherenceViewMode, setAdherenceViewMode] = useState('gauge'); // 'gauge' | 'bar'
  const [selectedArea, setSelectedArea] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const monitoringData = useMemo(() => {
    if (!machineStats || machineStats.length === 0) return [];

    return machineStats.map(g => {
      let totalActual = 0;
      Object.values(g.daily).forEach(d => {
        totalActual += d.total;
      });

      const remaining = g.target - totalActual;
      const progress = g.target > 0 ? Math.round((totalActual / g.target) * 100) : 0;
      const hoursLeft = g.estimasiSisaWaktuTotal || 0;
      
      const currentDay = new Date().getDay(); // 0 (Sun) to 6 (Sat)
      let effectiveDay = currentDay;
      if (currentDay === 0 || currentDay === 6) {
        effectiveDay = 5; // Treat weekend as Friday end
      }
      const WORK_HOURS_PER_DAY = 8;
      const daysNeeded = hoursLeft / WORK_HOURS_PER_DAY;
      const willSpillOver = remaining > 0 && (effectiveDay + daysNeeded) > 5;

      return {
        area: g.name,
        target: Math.round(g.target),
        actual: Math.round(totalActual),
        remaining: remaining > 0 ? Math.round(remaining) : 0,
        hoursLeft,
        progress,
        willSpillOver
      };
    }).sort((a, b) => b.remaining - a.remaining);
  }, [machineStats]);

  const analyticsSummary = useMemo(() => {
    let globalTarget = 0;
    let globalActual = 0;
    
    let underCount = 0;
    let overCount = 0;
    let onTrackCount = 0;

    monitoringData.forEach(line => {
      globalTarget += line.target || 0;
      globalActual += line.actual || 0;

      if (line.actual < line.target) {
        underCount++;
      } else if (line.actual > line.target) {
        overCount++;
      } else if (line.target > 0 && line.actual === line.target) {
        onTrackCount++;
      }
    });

    const adherenceRaw = globalTarget > 0 ? (globalActual / globalTarget) * 100 : 0;
    const adherence = Math.round(adherenceRaw * 10) / 10;

    return {
      adherence,
      globalTarget: Math.round(globalTarget),
      globalActual: Math.round(globalActual),
      underCount,
      overCount,
      onTrackCount
    };
  }, [monitoringData]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (monitoringData && monitoringData.length > 0 && !selectedArea) {
      setSelectedArea(monitoringData[0].area);
    }
  }, [monitoringData, selectedArea]);

  const displayData = useMemo(() => {
    if (selectedArea === 'Keseluruhan Area') {
      let totalTarget = 0;
      let totalActual = 0;
      let totalRemaining = 0;
      let totalHoursLeft = 0;

      monitoringData.forEach(d => {
        totalTarget += d.target || 0;
        totalActual += d.actual || 0;
        totalRemaining += d.remaining || 0;
        totalHoursLeft += d.hoursLeft || 0;
      });

      const progress = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;
      
      const currentDay = new Date().getDay();
      let effectiveDay = currentDay;
      if (currentDay === 0 || currentDay === 6) {
        effectiveDay = 5;
      }
      const WORK_HOURS_PER_DAY = 8;
      const daysNeeded = totalHoursLeft / WORK_HOURS_PER_DAY;
      const willSpillOver = totalRemaining > 0 && (effectiveDay + daysNeeded) > 5;

      return [{
        area: 'Keseluruhan Area',
        subTitle: 'Agregat Beban & Target Seluruh Lini Produksi',
        target: totalTarget,
        actual: totalActual,
        remaining: totalRemaining,
        hoursLeft: totalHoursLeft,
        progress,
        willSpillOver,
        isOverall: true
      }];
    }
    return monitoringData.filter(d => d.area === selectedArea).map(d => ({
      ...d,
      subTitle: 'Status Beban & Target Lini Produksi'
    }));
  }, [monitoringData, selectedArea]);

  const selectedItem = displayData[0] || null;

  return (
    <div className="flex flex-col h-full bg-[#F5F6F8] overflow-hidden select-none">
      {/* Compact Top Navigation (Single Screen Header) */}
      <header className="bg-white h-16 px-6 flex items-center justify-between border-b border-gray-200 shadow-sm relative shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-blue-500/20 flex-shrink-0">
            <MonitorPlay className="w-5 h-5" />
          </div>
          <div className="flex flex-col justify-center">
            <h1 className="text-lg font-extrabold text-gray-900 leading-none">Production Monitoring</h1>
            <p className="text-[10px] text-gray-500 font-bold tracking-[0.15em] mt-1 uppercase">Live Workload & Estimation</p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <Link to="/" className="flex items-center space-x-1.5 px-3.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 shadow-sm transition-colors">
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Chart Dashboard</span>
          </Link>
          <Link to="/detail-area" className="flex items-center space-x-1.5 px-3.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 shadow-sm transition-colors">
            <FileText className="w-3.5 h-3.5" />
            <span>Detail Area</span>
          </Link>
          <Link to="/processing-time" className="flex items-center space-x-1.5 px-3.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 shadow-sm transition-colors">
            <Clock className="w-3.5 h-3.5" />
            <span>Processing Time</span>
          </Link>
          <Link to="/settings" className="flex items-center space-x-1.5 px-3.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 shadow-sm transition-colors">
            <Settings2 className="w-3.5 h-3.5" />
            <span>Pengaturan</span>
          </Link>
        </div>
      </header>

      {/* Main Single-Screen Content Viewport */}
      <div className="p-3.5 sm:p-4 flex-1 flex flex-col overflow-hidden min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-400 font-medium animate-pulse text-sm">Memuat data monitoring...</p>
          </div>
        ) : monitoringData.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-400 font-medium text-sm">Tidak ada data untuk dimonitoring.</p>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col gap-3 overflow-hidden min-h-0 max-w-7xl mx-auto">

            {/* TOP ROW: Summary Analytics (Comfortable Height ~150px, No Overflow/Clipping) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 shrink-0 h-[150px]">
              
              {/* Adherence Chart Card */}
              <div className="bg-white rounded-xl p-3.5 px-4 border border-gray-200 shadow-sm flex flex-col justify-between overflow-hidden">
                
                {/* Header & Chart Switcher (Gauge & Bar) */}
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <div className="flex items-center space-x-2">
                    <h2 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest">Global Adherence</h2>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                      analyticsSummary.adherence >= 100
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : analyticsSummary.adherence >= 80
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      {analyticsSummary.adherence >= 100 ? 'Target Terpenuhi' : `${Math.round(100 - analyticsSummary.adherence)}% Lagi`}
                    </span>
                  </div>

                  {/* Visual Style Toggle (Gauge & Bar only) */}
                  <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200/80 space-x-1">
                    <button
                      type="button"
                      onClick={() => setAdherenceViewMode('gauge')}
                      className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all flex items-center space-x-1.5 ${
                        adherenceViewMode === 'gauge' ? 'bg-white text-blue-600 shadow-xs font-black' : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      <Gauge className="w-3.5 h-3.5" />
                      <span>Gauge</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdherenceViewMode('bar')}
                      className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all flex items-center space-x-1.5 ${
                        adherenceViewMode === 'bar' ? 'bg-white text-emerald-600 shadow-xs font-black' : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                      <span>Bar</span>
                    </button>
                  </div>
                </div>

                {/* Adherence Body */}
                <div className="flex items-center justify-between my-auto">
                  {adherenceViewMode === 'gauge' && (
                    <>
                      <div className="flex flex-col justify-center pr-2">
                        <p className="text-xs font-semibold text-gray-500">Total Output vs Target Pabrik</p>
                        <div className="flex items-center space-x-2 mt-1.5">
                          <span className="text-xs text-gray-400 font-medium">Output: <strong className="text-gray-900 font-extrabold">{analyticsSummary.globalActual.toLocaleString('id-ID')}</strong></span>
                          <span className="text-gray-300">/</span>
                          <span className="text-xs text-gray-400 font-medium">Target: <strong className="text-gray-900 font-extrabold">{analyticsSummary.globalTarget.toLocaleString('id-ID')}</strong></span>
                        </div>
                      </div>
                      <div className="flex items-center justify-center shrink-0">
                        <AdherenceGauge adherence={analyticsSummary.adherence} />
                      </div>
                    </>
                  )}

                  {adherenceViewMode === 'bar' && (
                    <div className="w-full py-1">
                      <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                        <span className="text-gray-500 text-xs">Kapasitas Produksi Pabrik</span>
                        <span className="text-lg font-black text-gray-900">{analyticsSummary.adherence}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-3.5 overflow-hidden border border-gray-200">
                        <div 
                          className={`h-full rounded-full transition-all duration-1000 ${
                            analyticsSummary.adherence >= 100 
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-400' 
                              : 'bg-gradient-to-r from-blue-600 to-indigo-500'
                          }`}
                          style={{ width: `${Math.min(analyticsSummary.adherence, 100)}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-[11px] text-gray-400 font-medium mt-1">
                        <span>Output: {analyticsSummary.globalActual.toLocaleString('id-ID')}</span>
                        <span>Target: {analyticsSummary.globalTarget.toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* Status Line Produksi Card */}
              <div className="bg-white rounded-xl p-3.5 px-4 border border-gray-200 shadow-sm flex flex-col justify-between overflow-hidden">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <h2 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest">Status Line Produksi</h2>
                  <span className="text-xs font-bold text-gray-500">{monitoringData.length} Total Line Terpantau</span>
                </div>
                
                {/* Status Counter Grid */}
                <div className="grid grid-cols-3 gap-2.5 my-auto">
                  {/* Under */}
                  <div className="bg-red-50/70 rounded-xl p-2.5 sm:p-3 border border-red-100 flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0 shadow-xs">
                      <TrendingDown className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Under</p>
                      <p className="text-lg font-black text-red-600 leading-tight">{analyticsSummary.underCount} <span className="text-[10px] font-medium text-red-400">Line</span></p>
                    </div>
                  </div>

                  {/* On Track */}
                  <div className="bg-green-50/70 rounded-xl p-2.5 sm:p-3 border border-green-100 flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-green-100 text-green-600 flex items-center justify-center shrink-0 shadow-xs">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-green-500 uppercase tracking-wider">On Track</p>
                      <p className="text-lg font-black text-green-600 leading-tight">{analyticsSummary.onTrackCount} <span className="text-[10px] font-medium text-green-500">Line</span></p>
                    </div>
                  </div>

                  {/* Over */}
                  <div className="bg-yellow-50/70 rounded-xl p-2.5 sm:p-3 border border-yellow-100 flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-yellow-100 text-yellow-600 flex items-center justify-center shrink-0 shadow-xs">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-yellow-500 uppercase tracking-wider">Over</p>
                      <p className="text-lg font-black text-yellow-600 leading-tight">{analyticsSummary.overCount} <span className="text-[10px] font-medium text-yellow-500">Line</span></p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* BOTTOM MAIN SECTION: Unified Workload & Estimation (Fills all remaining height in 1 screen) */}
            <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-white rounded-xl border border-gray-200 shadow-sm">
              
              {/* Integrated Header Toolbar with Dropdown Area */}
              <div className="p-3 px-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-white via-blue-50/20 to-white shrink-0">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-xs">
                    <Factory className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-gray-900 leading-tight">Estimasi Waktu & Beban Kerja Area</h2>
                    <p className="text-[10px] text-gray-500 font-medium">Sisa target dan estimasi jam pengerjaan</p>
                  </div>
                </div>

                {/* Embedded Area Dropdown Selector */}
                <div className="relative min-w-[220px] sm:min-w-[260px]" ref={dropdownRef}>
                  <button
                    type="button"
                    className="w-full bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-xs flex items-center justify-between cursor-pointer hover:border-blue-500 transition-all group"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  >
                    <div className="flex items-center space-x-1.5 truncate">
                      <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Area:</span>
                      <span className="text-xs font-black text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                        {selectedArea === 'Keseluruhan Area' ? 'Keseluruhan Area' : selectedArea}
                      </span>
                    </div>
                    <div className={`p-0.5 rounded ml-1.5 transition-transform duration-200 shrink-0 ${isDropdownOpen ? 'bg-blue-50 text-blue-600 rotate-180' : 'text-gray-400 group-hover:text-blue-600'}`}>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </div>
                  </button>

                  {/* Dropdown Menu Popup */}
                  {isDropdownOpen && (
                    <div className="absolute top-full right-0 mt-1.5 w-64 bg-white border border-gray-200 shadow-2xl rounded-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="max-h-56 overflow-y-auto p-1 text-xs">
                        <div 
                          className={`px-3 py-2 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${selectedArea === 'Keseluruhan Area' ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-50 text-gray-700'}`}
                          onClick={() => {
                            setSelectedArea('Keseluruhan Area');
                            setIsDropdownOpen(false);
                          }}
                        >
                          <span className="flex items-center font-bold">
                            <Layers className="w-3.5 h-3.5 mr-2 text-blue-500" />
                            Keseluruhan Area
                          </span>
                          {selectedArea === 'Keseluruhan Area' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                        </div>
                        
                        <div className="h-px bg-gray-100 my-1"></div>
                        
                        {monitoringData.map(m => (
                          <div 
                            key={m.area}
                            className={`px-3 py-1.5 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${selectedArea === m.area ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-50 text-gray-700'}`}
                            onClick={() => {
                              setSelectedArea(m.area);
                              setIsDropdownOpen(false);
                            }}
                          >
                            <span>{m.area}</span>
                            {selectedArea === m.area && <Check className="w-3.5 h-3.5 text-blue-600" />}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Seamless Single-Screen Content Body */}
              <div className="flex-1 p-2.5 sm:p-3 bg-[#FAFAFC] overflow-hidden flex flex-col min-h-0">
                {selectedItem && (
                  /* UNIFIED SUMMARY DASHBOARD (Fits 100% in viewport without scrolling) */
                  <div className="h-full flex flex-col justify-between gap-2 sm:gap-2.5">
                    
                    {/* Area Title & Status Header */}
                    <div className="flex items-center justify-between bg-white p-2 sm:p-2.5 px-3 sm:px-3.5 rounded-lg border border-gray-200/80 shadow-xs shrink-0">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
                          <Factory className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-gray-900 leading-tight">{selectedItem.area}</h3>
                          <p className="text-[9px] text-gray-500">{selectedItem.subTitle || 'Status Beban & Target Lini Produksi'}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`px-2.5 py-0.5 text-[11px] font-black rounded-md ${
                          selectedItem.progress >= 100 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {selectedItem.progress}% DONE
                        </div>
                      </div>
                    </div>

                    {/* Primary Key Metrics 3-Card Split Grid (Compact & Refined) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-2.5 flex-1 items-stretch min-h-0">
                      {/* Metric 1: Remaining Qty */}
                      <div className="bg-white rounded-xl p-2.5 sm:p-3 px-3.5 border border-gray-200/90 shadow-xs flex flex-col justify-center items-center text-center">
                        <p className="text-[9px] font-extrabold text-gray-400 mb-0.5 tracking-wider uppercase">Remaining Qty</p>
                        <p className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight leading-tight">
                          {selectedItem.remaining.toLocaleString('id-ID')}
                        </p>
                        <p className="text-[10px] text-gray-400 font-semibold mt-0.5">
                          Dari total {selectedItem.target.toLocaleString('id-ID')} unit target
                        </p>
                      </div>

                      {/* Metric 2: Est. Waktu */}
                      <div className="bg-white rounded-xl p-2.5 sm:p-3 px-3.5 border border-gray-200/90 shadow-xs flex flex-col justify-center items-center text-center">
                        <p className="text-[9px] font-extrabold text-blue-500 mb-0.5 tracking-wider uppercase">Estimasi Sisa Waktu</p>
                        <div className="flex items-baseline justify-center">
                          <p className="text-2xl sm:text-3xl font-black text-blue-600 tracking-tight leading-tight">
                            {Math.floor(selectedItem.hoursLeft).toLocaleString('id-ID')}
                          </p>
                          <span className="text-xs font-bold text-blue-400 ml-1">Jam</span>
                        </div>
                        <p className="text-[10px] text-gray-500 font-semibold mt-0.5">
                          ≈ {Math.ceil(selectedItem.hoursLeft / 8)} Hari Kerja (8 Jam/Hari)
                        </p>
                      </div>

                      {/* Metric 3: Weekly Spillover Assessment */}
                      <div className={`rounded-xl p-3 sm:p-3.5 px-4 border shadow-xs flex flex-col justify-center ${
                        selectedItem.willSpillOver 
                          ? 'bg-red-50 border-red-200/90' 
                          : 'bg-emerald-50 border-emerald-200/90'
                      }`}>
                        <div className="flex items-center space-x-2 mb-1">
                          {selectedItem.willSpillOver ? (
                            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                          ) : (
                            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                          )}
                          <p className={`text-sm sm:text-[15px] font-extrabold tracking-tight ${selectedItem.willSpillOver ? 'text-red-900' : 'text-emerald-900'}`}>
                            {selectedItem.willSpillOver ? 'Peringatan Spillover Mingguan' : 'Jadwal Produksi Aman'}
                          </p>
                        </div>
                        <p className={`text-xs sm:text-[12.5px] font-medium leading-relaxed ${selectedItem.willSpillOver ? 'text-red-700' : 'text-emerald-700'}`}>
                          {selectedItem.willSpillOver
                            ? `Estimasi ${Math.floor(selectedItem.hoursLeft)} jam tidak akan selesai pada Jumat minggu ini. Berisiko berlanjut ke akhir pekan.`
                            : 'Estimasi beban kerja mencukupi kapasitas jam kerja normal minggu ini.'}
                        </p>
                      </div>
                    </div>

                    {/* Bottom Progress Bar */}
                    <div className="bg-white p-2 sm:p-2.5 px-3 sm:px-3.5 rounded-lg border border-gray-200/80 shadow-xs shrink-0">
                      <div className="flex justify-between text-[11px] font-bold text-gray-600 mb-1">
                        <span>Progress Realisasi Terhadap Target</span>
                        <span className="text-gray-900 font-black">
                          {selectedItem.actual.toLocaleString('id-ID')} / {selectedItem.target.toLocaleString('id-ID')} Unit
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-1000 ${selectedItem.progress >= 100 ? 'bg-emerald-500' : 'bg-blue-600'}`}
                          style={{ width: `${Math.min(selectedItem.progress, 100)}%` }}
                        ></div>
                      </div>
                    </div>

                  </div>
                )}
              </div>

            </div>

          </div>
        )}
      </div>
    </div>
  );
}
