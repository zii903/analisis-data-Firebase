import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Calendar } from 'lucide-react';
import { daysKeys, dayColors } from '../utils/constants';

export default function ModernDayDropdown({ selectedDay, onSelectDay }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentColor = selectedDay !== 'Semua Hari' && dayColors[selectedDay] 
    ? dayColors[selectedDay].planned 
    : null;

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all duration-200 shadow-xs cursor-pointer select-none bg-white hover:bg-gray-50/90 active:scale-98 ${
          isOpen 
            ? 'border-blue-500 ring-2 ring-blue-500/10 text-blue-700' 
            : 'border-gray-200 text-gray-700 hover:border-gray-300'
        }`}
      >
        {/* Active Dot / Icon */}
        {selectedDay === 'Semua Hari' ? (
          <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
        ) : (
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs ring-1 ring-black/5"
            style={{ backgroundColor: currentColor || '#3B82F6' }}
          />
        )}

        <span className="truncate">{selectedDay}</span>

        {/* Animated Chevron */}
        <ChevronDown 
          className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-blue-600' : ''
          }`} 
        />
      </button>

      {/* Floating Menu Popup */}
      {isOpen && (
        <div 
          className="absolute right-0 mt-1.5 w-44 origin-top-right rounded-xl bg-white/95 backdrop-blur-md p-1.5 shadow-xl ring-1 ring-black/5 border border-gray-100 z-50 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Option: Semua Hari */}
          <button
            type="button"
            onClick={() => {
              onSelectDay('Semua Hari');
              setIsOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors text-left font-bold ${
              selectedDay === 'Semua Hari'
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <div className="w-5 h-5 rounded-md bg-blue-100/70 text-blue-600 flex items-center justify-center shrink-0">
                <Calendar className="w-3 h-3" />
              </div>
              <span>Semua Hari</span>
            </div>
            {selectedDay === 'Semua Hari' && (
              <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 font-black" />
            )}
          </button>

          {/* Divider */}
          <div className="h-px bg-gray-100 my-1"></div>

          {/* List of Days */}
          <div className="space-y-0.5">
            {daysKeys.map((day) => {
              const isSelected = selectedDay === day;
              const color = dayColors[day]?.planned || '#3B82F6';

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    onSelectDay(day);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors text-left ${
                    isSelected
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-medium'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <div 
                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs ring-1 ring-black/5" 
                      style={{ backgroundColor: color }}
                    />
                    <span>{day}</span>
                  </div>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 font-black" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
