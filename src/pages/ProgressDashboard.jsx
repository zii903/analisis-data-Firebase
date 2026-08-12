import React, { useEffect, useState, useRef } from 'react';

let isFirstAppLoad_ProgressDashboard = true;
import { get } from 'idb-keyval';
import ReactApexChart from 'react-apexcharts';
import { useFilter } from '../contexts/FilterContext';
import { useFolderSyncContext } from '../contexts/FolderSyncContext';
import { FileText, Clock, Settings2, Circle, Factory } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ProgressDashboard() {
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState([]);
  const [availableDays, setAvailableDays] = useState([]);
  const [animateChart, setAnimateChart] = useState(false);
  const [selectedDayFilter, setSelectedDayFilter] = useState('Semua Hari');
  const [rawRows, setRawRows] = useState([]);
  const { selectedFile } = useFilter();

  const isFirstComponentMount = useRef(true);
  const prevDataStr = useRef('');
  const prevValuesRef = useRef({});
  const hasDataChangedRef = useRef(false);

  const { isSyncing } = useFolderSyncContext();

  useEffect(() => {
    if (isSyncing) return;

    const fetchData = async () => {
      if (!selectedFile) {
        setChartData([]);
        setRawRows([]);
        return;
      }
      try {
        setLoading(true);
        const safeId = selectedFile.replace(/[\/\\]/g, '_');
        const rows = await get(`file_data_${safeId}`) || [];

        setRawRows(rows);

        const grouped = {};
        rows.forEach((row) => {
          const machineName = row.machine_name || 'Unknown';
          if (!grouped[machineName]) grouped[machineName] = [];
          grouped[machineName].push(row);
        });

        const formattedData = [];
        const daysSet = new Set();
        const daysKeys = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

        for (const [machineName, rows] of Object.entries(grouped)) {
          let totalOrder = 0;
          const totalOutputPerKey = {};
          const plannedOutput = {};
          const unplanOutput = {};

          daysKeys.forEach(d => {
            totalOutputPerKey[d] = 0;
            plannedOutput[d] = 0;
            unplanOutput[d] = 0;
          });

          const seenMaterials = {};

          rows.forEach(row => {
            const daily = typeof row.daily_details === 'string' ? JSON.parse(row.daily_details) : row.daily_details;
            const excelRowIdx = daily?.excel_row_index || 0;
            const materialKey = `${row.customer}_${row.pro_number}_${row.description}_${row.qty_produksi}_${excelRowIdx}`;
            const statusRaw = (row.status || '').toString().trim().toLowerCase();

            if (!seenMaterials[materialKey]) {
              if ((statusRaw.includes('plan') && !statusRaw.includes('unplan')) || statusRaw.includes('backlog')) {
                totalOrder += Number(row.qty_produksi || 0);
              }
              seenMaterials[materialKey] = true;
            }

            if (daily) {
              for (const [k, v] of Object.entries(daily)) {
                if (typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v)))) {
                  for (const dk of daysKeys) {
                    if (k.trim().toLowerCase().startsWith(dk.toLowerCase())) {
                      const val = Number(v);
                      totalOutputPerKey[dk] += val;
                      if (row.status === 'UNPLAN') {
                        unplanOutput[dk] += val;
                      } else {
                        plannedOutput[dk] += val;
                      }
                      break;
                    }
                  }
                }
              }
            }
          });

          let sumOutput = 0;
          const dataItem = { name: machineName };

          daysKeys.forEach(dk => {
            if (totalOutputPerKey[dk] > 0) daysSet.add(dk);
            sumOutput += totalOutputPerKey[dk];

            dataItem[`${dk}_Planned`] = plannedOutput[dk] || 0;
            dataItem[`${dk}_Unplan`] = unplanOutput[dk] || 0;
          });

          const remaining = totalOrder - sumOutput;
          dataItem.RemainingOrder = remaining > 0 ? Math.round(remaining) : 0;
          dataItem.TargetStr = Math.round(totalOrder).toLocaleString('id-ID');

          formattedData.push(dataItem);
        }

        const sortedDays = daysKeys.filter(d => daysSet.has(d));
        setAvailableDays(sortedDays);
        setChartData(formattedData);
      } catch (err) {
        console.error("Error fetching data: ", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedFile, isSyncing]);

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
        const finalStr = tspan.textContent;
        const finalNum = parseInt(finalStr.replace(/\./g, ''));
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
        const finalStr = text.textContent;
        const finalNum = parseInt(finalStr.replace(/\./g, ''));
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
    <div className="flex flex-col h-full bg-[#F5F6F8]">
      <header className="bg-white h-20 px-8 flex items-center justify-between border-b border-gray-200 shadow-sm relative">
        <div className="flex items-center space-x-4">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-blue-500/20 flex-shrink-0">
            <Factory className="w-6 h-6" />
          </div>
          <div className="flex flex-col justify-center">
            <h1 className="text-xl font-extrabold text-gray-900 leading-none">Dashboard</h1>
            <p className="text-[11px] text-gray-500 font-bold tracking-[0.15em] mt-1 uppercase">Production Progress</p>
          </div>
        </div>

        {/* Centered Live / Sync Indicator */}
        <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center space-x-2 px-4 py-1.5 border rounded-full text-sm font-bold shadow-sm transition-colors duration-300 bg-white"
          style={{ borderColor: isSyncing ? '#FDBA74' : '#BBF7D0', color: isSyncing ? '#F97316' : '#22C55E' }}>
          <Circle className={`w-3 h-3 ${isSyncing ? 'animate-pulse' : ''}`} style={{ fill: isSyncing ? '#F97316' : '#22C55E' }} />
          <span>{isSyncing ? 'Sinkronisasi...' : 'Live'}</span>
        </div>

        <div className="flex items-center space-x-3">
          <Link to="/detail-area" className="flex items-center space-x-2 px-5 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 bg-white hover:bg-gray-50 shadow-sm transition-colors">
            <FileText className="w-4 h-4" />
            <span>Detail Area</span>
          </Link>
          <Link to="/processing-time" className="flex items-center space-x-2 px-5 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 bg-white hover:bg-gray-50 shadow-sm transition-colors">
            <Clock className="w-4 h-4" />
            <span>Processing Time</span>
          </Link>
          <Link to="/settings" className="flex items-center space-x-2 px-5 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 bg-white hover:bg-gray-50 shadow-sm transition-colors">
            <Settings2 className="w-4 h-4" />
            <span>Pengaturan</span>
          </Link>
        </div>
      </header>

      <div className="p-4 flex-1 flex flex-col overflow-hidden">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 h-full flex flex-col overflow-hidden">
          <div className="border-b border-gray-100 pb-2 mb-3">
            <h2 className="text-lg font-bold text-gray-900">Production Progress By Area</h2>
          </div>

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
                            borderColor: '#BFDBFE',
                            borderWidth: 2,
                            borderRadius: 20,
                            offsetY: -30,
                            style: {
                              background: '#ffffff',
                              color: '#0F172A',
                              fontSize: '12px',
                              fontWeight: 900,
                              padding: { left: 8, right: 8, top: 4, bottom: 4 }
                            },
                            text: ['TARGET', d.TargetStr || '0']
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
                      y: {
                        formatter: function (val, opts) {
                          const realValue = opts.w.config.series[opts.seriesIndex].realData[opts.dataPointIndex];
                          return realValue.toLocaleString('id-ID');
                        }
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

                  const minChartWidth = Math.max(800, chartData.length * 60);
                  return (
                    <div className="w-full h-full overflow-x-auto overflow-y-hidden">
                      <div className="h-full" style={{ minWidth: `${minChartWidth}px` }}>
                        <ReactApexChart options={options} series={series} type="bar" height="100%" width="100%" />
                      </div>
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
