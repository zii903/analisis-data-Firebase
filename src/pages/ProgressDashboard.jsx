import React, { useEffect, useState, useRef } from 'react';

let isFirstAppLoad_ProgressDashboard = true;
import ReactApexChart from 'react-apexcharts';
import { useFilter } from '../contexts/FilterContext';
import { useFolderSyncContext } from '../contexts/FolderSyncContext';
import { useMachineData } from '../hooks/useMachineData';
import { daysKeys } from '../utils/constants';
import { FileText, Clock, Settings2, Circle, Factory, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ProgressDashboard() {
  const [chartData, setChartData] = useState([]);
  const [availableDays, setAvailableDays] = useState([]);
  const [animateChart, setAnimateChart] = useState(false);
  const [selectedDayFilter, setSelectedDayFilter] = useState('Semua Hari');
  
  const { selectedFile } = useFilter();
  const { isSyncing, needsPermission, startWatching } = useFolderSyncContext();
  const { machineStats, loading } = useMachineData();

  const isFirstComponentMount = useRef(true);
  const prevDataStr = useRef('');
  const prevValuesRef = useRef({});
  const hasDataChangedRef = useRef(false);

  useEffect(() => {
    if (!machineStats || machineStats.length === 0) {
      setChartData([]);
      setAvailableDays([]);
      return;
    }

    const formattedData = [];
    const daysSet = new Set();

    machineStats.forEach((machine) => {
      let sumOutput = 0;
      const dataItem = { name: machine.name };

      daysKeys.forEach(dk => {
        const dayTotal = machine.daily[dk].total || 0;
        if (dayTotal > 0) daysSet.add(dk);
        sumOutput += dayTotal;

        dataItem[`${dk}_Planned`] = machine.daily[dk].planned || 0;
        dataItem[`${dk}_Unplan`] = machine.daily[dk].unplan || 0;
      });

      const remaining = machine.target - sumOutput;
      dataItem.RemainingOrder = remaining > 0 ? Math.round(remaining) : 0;
      dataItem.TargetStr = Math.round(machine.target).toLocaleString('id-ID');
      dataItem.unplannedTargetStr = Math.round(machine.unplannedTarget || 0).toLocaleString('id-ID');
      dataItem.isFullUnplan = (!machine.hasPlanned && sumOutput > 0);

      formattedData.push(dataItem);
    });

    const sortedDays = daysKeys.filter(d => daysSet.has(d));
    setAvailableDays(sortedDays);
    setChartData(formattedData);
  }, [machineStats]);

  useEffect(() => {
    if (chartData && chartData.length > 0) {
      const timer = setTimeout(() => {
        setAnimateChart(true);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setAnimateChart(false);
    }
  }, [chartData]);

  // Efek memutar angka (odometer)
  useEffect(() => {
    if (!chartData || chartData.length === 0) return;

    const currentDataStr = JSON.stringify(chartData);
    if (prevDataStr.current !== currentDataStr) {
      hasDataChangedRef.current = true;
      prevDataStr.current = currentDataStr;
    }

    let isFirstMountAnim = false;

    if (isFirstComponentMount.current) {
      isFirstComponentMount.current = false;
      if (isFirstAppLoad_ProgressDashboard) {
        isFirstAppLoad_ProgressDashboard = false;
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
        const current = Math.floor(easeProgress * (end - start) + start);
        obj.textContent = current.toLocaleString('id-ID');
        if (progress < 1) {
          animationFrames.push(window.requestAnimationFrame(step));
        } else {
          obj.textContent = end.toLocaleString('id-ID');
        }
      };
      animationFrames.push(window.requestAnimationFrame(step));
    };

    const timeout = setTimeout(() => {
      const shouldAnimate = isFirstMountAnim || hasDataChangedRef.current;

      const annotationTexts = document.querySelectorAll('.apexcharts-point-annotations text tspan:nth-child(2)');
      annotationTexts.forEach((tspan, idx) => {
        const chartItem = chartData[idx];
        if (!chartItem) return;
        
        if (chartItem.isFullUnplan) {
          tspan.textContent = 'UNPLAN';
          return;
        }
        
        const finalNum = parseInt((chartItem.TargetStr || '0').replace(/\./g, ''));
        const id = `annot_${idx}`;
        const prevNum = prevValuesRef.current[id] !== undefined ? prevValuesRef.current[id] : 0;

        if (shouldAnimate && !isNaN(finalNum) && finalNum !== prevNum) {
          animateValue(tspan, prevNum, finalNum, 1500);
        } else if (!isNaN(finalNum)) {
          tspan.textContent = finalNum.toLocaleString('id-ID');
        }

        if (!isNaN(finalNum)) {
          prevValuesRef.current[id] = finalNum;
        }
      });

      const dataLabels = document.querySelectorAll('.apexcharts-datalabel');
      dataLabels.forEach((text, idx) => {
        const chartItem = chartData[idx];
        if (!chartItem) return;

        const isRemainingActive = selectedDayFilter === 'Semua Hari';
        const finalNum = isRemainingActive ? (chartItem.RemainingOrder || 0) : 0;
        
        if (finalNum === 0) {
          text.textContent = '';
          return;
        }

        const id = `label_${idx}`;
        const prevNum = prevValuesRef.current[id] !== undefined ? prevValuesRef.current[id] : 0;

        if (shouldAnimate && !isNaN(finalNum) && finalNum !== prevNum) {
          animateValue(text, prevNum, finalNum, 1500);
        } else if (!isNaN(finalNum)) {
          text.textContent = finalNum.toLocaleString('id-ID');
        }

        if (!isNaN(finalNum)) {
          prevValuesRef.current[id] = finalNum;
        }
      });

      hasDataChangedRef.current = false;
    }, 850);

    return () => {
      clearTimeout(timeout);
      animationFrames.forEach(id => window.cancelAnimationFrame(id));
    };
  }, [chartData]);

  const displayFileName = selectedFile ? selectedFile.split(/[\\/]/).pop() : 'Belum ada file';

  const dayColors = {
    Senin: { planned: '#3B82F6', unplan: '#93C5FD' },
    Selasa: { planned: '#10B981', unplan: '#6EE7B7' },
    Rabu: { planned: '#F59E0B', unplan: '#FCD34D' },
    Kamis: { planned: '#8B5CF6', unplan: '#C4B5FD' },
    Jumat: { planned: '#EC4899', unplan: '#F9A8D4' },
    Sabtu: { planned: '#6366F1', unplan: '#A5B4FC' },
    Minggu: { planned: '#EF4444', unplan: '#FCA5A5' },
  };

  return (
    <div className="flex flex-col h-full bg-[#F5F6F8] overflow-hidden select-none">
      <header className="bg-white h-16 px-6 flex items-center justify-between border-b border-gray-200 shadow-sm relative shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-blue-500/20 flex-shrink-0">
            <Factory className="w-5 h-5" />
          </div>
          <div className="flex flex-col justify-center">
            <h1 className="text-lg font-extrabold text-gray-900 leading-none">Chart Dashboard</h1>
            <p className="text-[10px] text-gray-500 font-bold tracking-[0.15em] mt-1 uppercase">Production Progress</p>
          </div>

          {/* Live Status Badge safely placed on the left next to title */}
          <div className="hidden sm:flex items-center space-x-2 pl-3 border-l border-gray-200 ml-1">
            <div className="flex items-center space-x-1.5 px-3 py-1 border rounded-full text-xs font-bold shadow-xs bg-white"
                 style={{ 
                   borderColor: needsPermission ? '#FCA5A5' : (isSyncing ? '#FDBA74' : '#BBF7D0'), 
                   color: needsPermission ? '#EF4444' : (isSyncing ? '#F97316' : '#22C55E') 
                 }}>
              <Circle className={`w-2 h-2 ${isSyncing ? 'animate-pulse' : ''}`} 
                style={{ fill: needsPermission ? '#EF4444' : (isSyncing ? '#F97316' : '#22C55E') }} 
              />
              <span>{needsPermission ? 'Terhenti' : (isSyncing ? 'Sinkronisasi...' : 'Live')}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Link to="/detail-area" className="flex items-center space-x-1.5 px-3.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 shadow-xs transition-colors">
            <FileText className="w-3.5 h-3.5" />
            <span>Detail Area</span>
          </Link>
          <Link to="/processing-time" className="flex items-center space-x-1.5 px-3.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 shadow-xs transition-colors">
            <Clock className="w-3.5 h-3.5" />
            <span>Processing Timee</span>
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

      <div className="p-4 flex-1 flex flex-col overflow-hidden">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 h-full flex flex-col overflow-hidden">
          <div className="border-b border-gray-100 pb-2 mb-3">
            <h2 className="text-lg font-bold text-gray-900">Production Progress By Area</h2>
          </div>

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

          <div className="flex justify-center mb-4 shrink-0">
            <div className="px-5 py-1.5 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-600 shadow-sm">
              Menampilkan: <span className="text-blue-600">{displayFileName}</span>
            </div>
          </div>

          <div className="flex-1 min-h-0 relative w-full overflow-hidden">
            {!selectedFile ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-gray-400 font-medium">Pilih File di Pengaturan</p>
              </div>
            ) : loading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-gray-400 font-medium animate-pulse">Memuat data...</p>
              </div>
            ) : chartData.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-gray-400 font-medium">Tidak ada data untuk ditampilkan</p>
              </div>
            ) : (
              <div
                className="w-full h-full transition-all"
                style={{
                  transitionDuration: '1500ms',
                  transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
                  clipPath: animateChart ? 'inset(0% -10% -10% -10%)' : 'inset(100% -10% -10% -10%)',
                  opacity: animateChart ? 1 : 0,
                  transform: animateChart ? 'translateY(0)' : 'translateY(40px)'
                }}
              >
                {(() => {
                  const series = [];
                  const colors = [];

                  // Helper to calculate manipulated values
                  const getManipulatedValue = (realValue) => {
                    if (realValue <= 0) return 0;
                    return Number(Math.pow(realValue, 0.3).toFixed(4));
                  };

                  availableDays.forEach(day => {
                    const isActive = selectedDayFilter === 'Semua Hari' || selectedDayFilter === day;
                    const realData = chartData.map(d => (d[`${day}_Planned`] || 0) + (d[`${day}_Unplan`] || 0));

                    series.push({
                      name: day,
                      dayName: day,
                      data: chartData.map((d, i) => isActive ? getManipulatedValue(realData[i]) : 0),
                      realData: realData
                    });
                    colors.push(dayColors[day]?.planned || '#3B82F6');
                  });

                  const isRemainingActive = selectedDayFilter === 'Semua Hari';
                  const remainingRealData = chartData.map(d => d.RemainingOrder || 0);

                  series.push({
                    name: 'Remaining Order',
                    data: chartData.map((d, i) => isRemainingActive ? getManipulatedValue(remainingRealData[i]) : 0),
                    realData: remainingRealData
                  });
                  colors.push('#D1D5DB');

                  const options = {
                    chart: {
                      type: 'bar',
                      stacked: true,
                      toolbar: { show: false },
                      fontFamily: 'Inter, sans-serif',
                      animations: {
                        enabled: true,
                        easing: 'easeinout',
                        speed: 1500,
                        dynamicAnimation: {
                          enabled: true,
                          speed: 1500
                        }
                      }
                    },
                    colors: colors,
                    plotOptions: {
                      bar: {
                        horizontal: false,
                        columnWidth: '50%',
                        dataLabels: {
                          orientation: 'vertical',
                          position: 'center',
                          total: {
                            enabled: false
                          }
                        }
                      },
                    },
                    annotations: {
                      points: chartData.map((d, i) => {
                        let sum = 0;
                        series.forEach(s => {
                          sum += s.data[i] || 0;
                        });
                        return {
                          x: d.name,
                          y: sum,
                          marker: { size: 0, strokeWidth: 0, fillOpacity: 0, strokeOpacity: 0 },
                          label: {
                            borderColor: d.isFullUnplan ? '#F59E0B' : '#BFDBFE',
                            borderWidth: 2,
                            borderRadius: 20,
                            offsetY: -30,
                            style: {
                              background: d.isFullUnplan ? '#FFFBEB' : '#ffffff',
                              color: d.isFullUnplan ? '#D97706' : '#0F172A',
                              fontSize: '12px',
                              fontWeight: 900,
                              padding: { left: 8, right: 8, top: 4, bottom: 4 }
                            },
                            text: d.isFullUnplan ? ['FULL', 'UNPLAN'] : ['TARGET', d.TargetStr || '0']
                          }
                        };
                      })
                    },
                    xaxis: {
                      categories: chartData.map(d => d.name),
                      labels: {
                        rotate: -90,
                        rotateAlways: true,
                        style: {
                          fontSize: '12px',
                          fontWeight: 600,
                          colors: '#6B7280'
                        }
                      }
                    },
                    yaxis: {
                      labels: {
                        show: false
                      }
                    },
                    tooltip: {
                      custom: function({series, seriesIndex, dataPointIndex, w}) {
                        const s = w.config.series[seriesIndex];
                        if (s.name === 'Remaining Order') {
                          return `<div class="px-3 py-2 bg-white shadow rounded border font-semibold text-sm">Remaining Order: ${s.realData[dataPointIndex].toLocaleString('id-ID')}</div>`;
                        }
                        
                        const chartItem = chartData[dataPointIndex];
                        const day = s.dayName;
                        const planned = chartItem[`${day}_Planned`] || 0;
                        const unplan = chartItem[`${day}_Unplan`] || 0;
                        const totalActual = planned + unplan;
                        
                        let warningBox = '';
                        if (unplan > 0) {
                          if (chartItem.isFullUnplan) {
                            warningBox = `<div class="mt-2 bg-red-100 border border-red-300 text-red-700 px-2 py-1.5 rounded text-[11px] font-bold flex items-center gap-1.5"><span>🚨</span> 100% Pekerjaan Unplanned (Target ${chartItem.unplannedTargetStr})</div>`;
                          } else {
                            warningBox = `<div class="mt-2 bg-yellow-100 border border-yellow-300 text-yellow-800 px-2 py-1.5 rounded text-[11px] font-bold flex items-center gap-1.5"><span>⚠️</span> Terdapat ${unplan.toLocaleString('id-ID')} output Unplanned</div>`;
                          }
                        }

                        return `
                          <div class="p-1 font-sans min-w-[210px]">
                            <div class="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 mb-2 flex justify-between items-center gap-3">
                              <span class="truncate">${chartItem.name}</span>
                              <span class="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">TARGET: ${chartItem.TargetStr}</span>
                            </div>
                            <div class="text-[11px] text-gray-500 font-extrabold mb-2 uppercase tracking-wider">${day}</div>
                            <div class="space-y-1.5">
                              <div class="flex justify-between items-center text-xs">
                                <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full" style="background: ${dayColors[day]?.planned}"></span> Planned</span>
                                <span class="font-bold text-gray-800">${planned.toLocaleString('id-ID')}</span>
                              </div>
                              <div class="flex justify-between items-center text-xs">
                                <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full" style="background: ${dayColors[day]?.unplan}"></span> Unplanned</span>
                                <span class="font-bold text-gray-800">${unplan.toLocaleString('id-ID')}</span>
                              </div>
                              <div class="flex justify-between items-center text-xs pt-1.5 mt-1.5 border-t border-gray-100">
                                <span class="font-bold text-gray-600">Total Output</span>
                                <span class="font-extrabold text-blue-600">${totalActual.toLocaleString('id-ID')}</span>
                              </div>
                            </div>
                            ${warningBox}
                          </div>
                        `;
                      }
                    },
                    dataLabels: {
                      enabled: true,
                      enabledOnSeries: [series.length - 1],
                      offsetX: -32,
                      offsetY: 10,
                      formatter: function (val, opts) {
                        if (!val) return '';
                        const realVal = opts.w.config.series[opts.seriesIndex].realData[opts.dataPointIndex];
                        return realVal ? realVal.toLocaleString('id-ID') : '';
                      },
                      style: {
                        colors: ['#374151'],
                        fontSize: '13px',
                        fontWeight: 800,
                      },
                      dropShadow: {
                        enabled: true,
                        top: 1,
                        left: 1,
                        blur: 1,
                        color: '#ffffff',
                        opacity: 1
                      }
                    },
                    legend: {
                      show: false
                    },
                    fill: {
                      opacity: 1
                    },
                    grid: {
                      borderColor: '#E5E7EB',
                      strokeDashArray: 3,
                      padding: {
                        top: 40
                      }
                    }
                  };

                  return (
                    <div className="w-full h-full overflow-hidden">
                      <ReactApexChart options={options} series={series} type="bar" height="100%" width="100%" />
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {selectedFile && !loading && availableDays.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-3 mt-3 shrink-0">
              {availableDays.map(day => {
                const isActive = selectedDayFilter === day;
                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDayFilter(isActive ? 'Semua Hari' : day)}
                    className="flex items-center space-x-2 px-4 py-1.5 rounded-full text-sm font-semibold border-2 transition-all duration-300"
                    style={{
                      borderColor: isActive ? (dayColors[day]?.planned || '#3B82F6') : '#E5E7EB',
                      backgroundColor: isActive ? `${dayColors[day]?.planned}18` : '#FFFFFF',
                      color: isActive ? (dayColors[day]?.planned || '#3B82F6') : '#6B7280',
                      transform: isActive ? 'scale(1.05)' : 'scale(1)'
                    }}
                  >
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dayColors[day]?.planned || '#3B82F6' }}></div>
                    <span>{day}</span>
                  </button>
                );
              })}
              {selectedDayFilter === 'Semua Hari' && (
                <div className="flex items-center space-x-2 px-4 py-1.5 rounded-full text-sm font-semibold border-2 border-gray-200 bg-white text-gray-500">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#D1D5DB]"></div>
                  <span>Remaining Order</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
