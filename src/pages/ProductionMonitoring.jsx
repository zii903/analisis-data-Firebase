import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Activity, Clock, FileText, Settings2, BarChart2, Factory, MonitorPlay, AlertTriangle, ChevronDown, Check, TrendingUp, TrendingDown, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import Chart from 'react-apexcharts';
import { useMachineData } from '../hooks/useMachineData';

export default function ProductionMonitoring() {
  const { machineStats, loading } = useMachineData();

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
        target: g.target,
        actual: totalActual,
        remaining: remaining > 0 ? remaining : 0,
        hoursLeft,
        progress,
        willSpillOver
      };
    }).sort((a, b) => b.remaining - a.remaining); // Sort by highest remaining first
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
    const adherence = Math.round(adherenceRaw * 10) / 10; // 1 decimal place

    return {
      adherence,
      underCount,
      overCount,
      onTrackCount
    };
  }, [monitoringData]);

  const adherenceChartOptions = {
    chart: { type: 'radialBar', sparkline: { enabled: true } },
    plotOptions: {
      radialBar: {
        startAngle: -100,
        endAngle: 100,
        track: {
          background: "#f3f4f6",
          strokeWidth: '100%',
          margin: 5
        },
        hollow: { size: '60%' },
        dataLabels: {
          name: { show: false },
          value: {
            offsetY: 10,
            fontSize: '32px',
            fontWeight: '900',
            color: '#111827',
            formatter: function (val) {
              return val + "%";
            }
          }
        }
      }
    },
    fill: {
      type: 'gradient',
      gradient: {
        shade: 'dark',
        type: 'horizontal',
        gradientToColors: ['#10b981'],
        stops: [0, 100]
      }
    },
    colors: ['#3b82f6'],
    stroke: { lineCap: 'round' }
  };

  const [selectedArea, setSelectedArea] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

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
        area: 'Keseluruhan Area (Total)',
        target: totalTarget,
        actual: totalActual,
        remaining: totalRemaining,
        hoursLeft: totalHoursLeft,
        progress,
        willSpillOver
      }];
    }
    return monitoringData.filter(d => d.area === selectedArea);
  }, [monitoringData, selectedArea]);

  return (
    <div className="flex flex-col h-full bg-[#F5F6F8]">
      {/* Top Navigation */}
      <header className="bg-white h-20 px-8 flex items-center justify-between border-b border-gray-200 shadow-sm relative shrink-0">
        <div className="flex items-center space-x-4">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-blue-500/20 flex-shrink-0">
            <MonitorPlay className="w-6 h-6" />
          </div>
          <div className="flex flex-col justify-center">
            <h1 className="text-xl font-extrabold text-gray-900 leading-none">Production Monitoring</h1>
            <p className="text-[11px] text-gray-500 font-bold tracking-[0.15em] mt-1 uppercase">Live Workload & Estimation</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Link to="/" className="flex items-center space-x-2 px-5 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 shadow-sm transition-colors">
            <BarChart2 className="w-4 h-4" />
            <span>Chart Dashboard</span>
          </Link>
          <Link to="/detail-area" className="flex items-center space-x-2 px-5 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 shadow-sm transition-colors">
            <FileText className="w-4 h-4" />
            <span>Detail Area</span>
          </Link>
          <Link to="/processing-time" className="flex items-center space-x-2 px-5 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 shadow-sm transition-colors">
            <Clock className="w-4 h-4" />
            <span>Processing Time</span>
          </Link>
          <Link to="/settings" className="flex items-center space-x-2 px-5 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 shadow-sm transition-colors">
            <Settings2 className="w-4 h-4" />
            <span>Pengaturan</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="p-8 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-400 font-medium animate-pulse">Memuat data monitoring...</p>
          </div>
        ) : monitoringData.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-400 font-medium">Tidak ada data untuk dimonitoring.</p>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto">

            {/* Summary Analytics Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              
              {/* Adherence Chart Card */}
              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between hover:shadow-md transition-shadow">
                <div className="mb-6 sm:mb-0 text-center sm:text-left">
                  <h2 className="text-sm font-extrabold text-gray-500 uppercase tracking-widest mb-1">Global Adherence</h2>
                  <p className="text-gray-900 text-3xl font-black tracking-tight mb-2">Pabrik</p>
                  <p className="text-xs text-gray-500 max-w-[200px] leading-relaxed">
                    Kepatuhan produksi secara keseluruhan berdasarkan rasio Total Output terhadap Total Target.
                  </p>
                </div>
                <div className="relative">
                  <Chart options={adherenceChartOptions} series={[analyticsSummary.adherence]} type="radialBar" height={220} width={220} />
                </div>
              </div>

              {/* Over/Underproduction Panel */}
              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-center">
                <h2 className="text-sm font-extrabold text-gray-500 uppercase tracking-widest mb-5">Status Line Produksi</h2>
                
                <div className="grid grid-cols-3 gap-4">
                  {/* Underproduction */}
                  <div className="bg-red-50/50 rounded-xl p-4 border border-red-100 flex flex-col items-center text-center">
                    <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-2">
                      <TrendingDown className="w-4 h-4" />
                    </div>
                    <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1">Under</p>
                    <p className="text-2xl font-black text-red-600">{analyticsSummary.underCount}</p>
                    <p className="text-[10px] font-medium text-red-400 mt-1">Line</p>
                  </div>

                  {/* On Track */}
                  <div className="bg-green-50/50 rounded-xl p-4 border border-green-100 flex flex-col items-center text-center">
                    <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-2">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <p className="text-[10px] font-bold text-green-500 uppercase tracking-wider mb-1">On Track</p>
                    <p className="text-2xl font-black text-green-600">{analyticsSummary.onTrackCount}</p>
                    <p className="text-[10px] font-medium text-green-500 mt-1">Line</p>
                  </div>

                  {/* Overproduction */}
                  <div className="bg-yellow-50/50 rounded-xl p-4 border border-yellow-100 flex flex-col items-center text-center">
                    <div className="w-8 h-8 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center mb-2">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <p className="text-[10px] font-bold text-yellow-500 uppercase tracking-wider mb-1">Over</p>
                    <p className="text-2xl font-black text-yellow-600">{analyticsSummary.overCount}</p>
                    <p className="text-[10px] font-medium text-yellow-500 mt-1">Line</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              <div className="w-full relative" ref={dropdownRef}>
                <div 
                  className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-blue-400 transition-colors group"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                  <div className="flex items-center">
                    <span className="text-sm font-bold text-gray-500 pl-2 whitespace-nowrap">Area:</span>
                    <span className="ml-3 text-sm font-black text-gray-900 group-hover:text-blue-600 transition-colors">
                      {selectedArea === 'Keseluruhan Area' ? 'Keseluruhan Area' : selectedArea}
                    </span>
                  </div>
                  <div className={`p-1.5 rounded-lg transition-transform duration-200 ${isDropdownOpen ? 'bg-blue-50 text-blue-600 rotate-180' : 'bg-gray-50 text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600'}`}>
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>

                {isDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 shadow-xl rounded-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="max-h-64 overflow-y-auto p-1.5">
                      <div 
                        className={`px-4 py-2.5 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${selectedArea === 'Keseluruhan Area' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'}`}
                        onClick={() => {
                          setSelectedArea('Keseluruhan Area');
                          setIsDropdownOpen(false);
                        }}
                      >
                        <span className="text-sm font-bold">Keseluruhan Area</span>
                        {selectedArea === 'Keseluruhan Area' && <Check className="w-4 h-4" />}
                      </div>
                      
                      <div className="h-px bg-gray-100 my-1"></div>
                      
                      {monitoringData.map(m => (
                        <div 
                          key={m.area}
                          className={`px-4 py-2.5 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${selectedArea === m.area ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'}`}
                          onClick={() => {
                            setSelectedArea(m.area);
                            setIsDropdownOpen(false);
                          }}
                        >
                          <span className="text-sm font-semibold">{m.area}</span>
                          {selectedArea === m.area && <Check className="w-4 h-4" />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayData.map((item, idx) => (
                <div key={idx} className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                
                {/* Card Header */}
                <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center">
                      <Factory className="w-4 h-4 text-gray-500" />
                    </div>
                    <div>
                      <h2 className="text-base font-extrabold text-gray-900 leading-tight">{item.area}</h2>
                    </div>
                  </div>
                  <div className={`px-2.5 py-1 text-[10px] font-bold rounded-full bg-gray-100 text-gray-600`}>
                    {item.progress}% DONE
                  </div>
                </div>

                {/* Primary Metrics */}
                <div className="bg-gray-50 rounded-lg py-4 px-4 border border-gray-100 grid grid-cols-2 gap-4 mb-5">
                  {/* Remaining */}
                  <div className="text-center px-2 border-r border-gray-200">
                    <p className="text-[10px] font-extrabold text-gray-400 mb-1 tracking-widest uppercase">Remaining Qty</p>
                    <div className="flex items-baseline justify-center">
                      <p className="text-2xl font-black text-gray-900 tracking-tight">
                        {item.remaining.toLocaleString('id-ID')}
                      </p>
                    </div>
                  </div>

                  {/* Est Time */}
                  <div className="text-center px-2">
                    <p className="text-[10px] font-extrabold text-blue-400 mb-1 tracking-widest uppercase">Est. Waktu</p>
                    <div className="flex items-baseline justify-center">
                      <p className="text-2xl font-black text-blue-600 tracking-tight">
                        {Math.floor(item.hoursLeft).toLocaleString('id-ID')}
                      </p>
                      <span className="text-xs font-bold text-blue-400 ml-1">Jam</span>
                    </div>
                  </div>
                </div>

                {item.willSpillOver && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start space-x-2.5">
                    <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-red-700">Peringatan Keterlambatan Mingguan</p>
                      <p className="text-[10px] font-medium text-red-600 mt-0.5 leading-tight">
                        Estimasi sisa {Math.floor(item.hoursLeft)} jam ({Math.ceil(item.hoursLeft / 8)} hari kerja) tidak akan selesai pada hari Jumat minggu ini (Jam kerja: 8 Jam/hari). Berisiko berlanjut ke akhir pekan.
                      </p>
                    </div>
                  </div>
                )}

                {/* Progress Bar */}
                <div className="mt-2">
                  <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-1.5">
                    <span>Progress Produksi Target</span>
                    <span>{item.actual.toLocaleString('id-ID')} / {item.target.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div 
                      className={`h-2 rounded-full transition-all duration-1000 ease-out ${item.progress >= 100 ? 'bg-green-500' : 'bg-blue-600'}`}
                      style={{ width: `${Math.min(item.progress, 100)}%` }}
                    ></div>
                  </div>
                </div>

              </div>
            ))}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
