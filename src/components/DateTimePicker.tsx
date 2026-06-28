/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock } from 'lucide-react';

interface DateTimePickerProps {
  id?: string;
  value: string; // Format: 'YYYY-MM-DDTHH:mm' or empty
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  level?: number;
  placeholder?: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function DateTimePicker({
  id,
  value,
  onChange,
  disabled = false,
  required = false,
  level = 3,
  placeholder = 'Select date & time'
}: DateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Parse initial date & time or fallback to current time
  const initialDate = value ? new Date(value) : new Date();
  const isValidDate = !isNaN(initialDate.getTime());
  
  // Internal date/time state
  const [currentYear, setCurrentYear] = useState((isValidDate ? initialDate : new Date()).getFullYear());
  const [currentMonth, setCurrentMonth] = useState((isValidDate ? initialDate : new Date()).getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(value && isValidDate ? initialDate.getDate() : null);
  const [selectedYear, setSelectedYear] = useState<number | null>(value && isValidDate ? initialDate.getFullYear() : null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(value && isValidDate ? initialDate.getMonth() : null);

  const [hours, setHours] = useState(isValidDate ? initialDate.getHours() : 12);
  const [minutes, setMinutes] = useState(isValidDate ? initialDate.getMinutes() : 0);

  // Sync state if value prop changes
  useEffect(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        setCurrentYear(d.getFullYear());
        setCurrentMonth(d.getMonth());
        setSelectedDay(d.getDate());
        setSelectedYear(d.getFullYear());
        setSelectedMonth(d.getMonth());
        setHours(d.getHours());
        setMinutes(d.getMinutes());
      }
    } else {
      setSelectedDay(null);
      setSelectedYear(null);
      setSelectedMonth(null);
    }
  }, [value]);

  // Click outside handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Accent color mappings based on trust levels
  const getLevelColors = (lvl: number) => {
    switch (lvl) {
      case 1:
        return {
          text: 'text-slate-400',
          bg: 'bg-slate-600',
          bgHover: 'hover:bg-slate-800/60',
          border: 'border-slate-500/30',
          focusRing: 'focus:ring-slate-500/80',
          focusBorder: 'focus:border-slate-500',
          textMuted: 'text-slate-500'
        };
      case 2:
        return {
          text: 'text-blue-400',
          bg: 'bg-blue-600',
          bgHover: 'hover:bg-blue-900/40',
          border: 'border-blue-500/30',
          focusRing: 'focus:ring-blue-500/80',
          focusBorder: 'focus:border-blue-500',
          textMuted: 'text-blue-500'
        };
      case 3:
        return {
          text: 'text-teal-400',
          bg: 'bg-teal-600',
          bgHover: 'hover:bg-teal-900/40',
          border: 'border-teal-500/30',
          focusRing: 'focus:ring-teal-500/80',
          focusBorder: 'focus:border-teal-500',
          textMuted: 'text-teal-500'
        };
      case 4:
        return {
          text: 'text-emerald-400',
          bg: 'bg-emerald-600',
          bgHover: 'hover:bg-emerald-900/40',
          border: 'border-emerald-500/30',
          focusRing: 'focus:ring-emerald-500/80',
          focusBorder: 'focus:border-emerald-500',
          textMuted: 'text-emerald-500'
        };
      case 5:
        return {
          text: 'text-amber-400',
          bg: 'bg-amber-600',
          bgHover: 'hover:bg-amber-900/40',
          border: 'border-amber-500/30',
          focusRing: 'focus:ring-amber-500/80',
          focusBorder: 'focus:border-amber-500',
          textMuted: 'text-amber-500'
        };
      default:
        return {
          text: 'text-indigo-400',
          bg: 'bg-indigo-600',
          bgHover: 'hover:bg-indigo-900/40',
          border: 'border-indigo-500/30',
          focusRing: 'focus:ring-indigo-500/80',
          focusBorder: 'focus:border-indigo-500',
          textMuted: 'text-indigo-500'
        };
    }
  };

  const colors = getLevelColors(level);

  // Calendar calculations
  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const updateDateTime = (day: number, year: number, month: number, targetHours: number, targetMinutes: number) => {
    setSelectedDay(day);
    setSelectedYear(year);
    setSelectedMonth(month);

    const localDate = new Date(year, month, day, targetHours, targetMinutes);
    onChange(localDate.toISOString());
  };

  const handleDaySelect = (day: number) => {
    updateDateTime(day, currentYear, currentMonth, hours, minutes);
  };

  const handleHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newHour = parseInt(e.target.value, 10);
    setHours(newHour);
    if (selectedDay !== null && selectedYear !== null && selectedMonth !== null) {
      updateDateTime(selectedDay, selectedYear, selectedMonth, newHour, minutes);
    }
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMinute = parseInt(e.target.value, 10);
    setMinutes(newMinute);
    if (selectedDay !== null && selectedYear !== null && selectedMonth !== null) {
      updateDateTime(selectedDay, selectedYear, selectedMonth, hours, newMinute);
    }
  };

  // Keyboard navigation within the calendar popover
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (e.key === 'Escape') {
      setIsOpen(false);
      triggerRef.current?.focus();
      return;
    }

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    // If calendar is open and we have a selected or focused date, enable date navigation
    if (selectedDay !== null && selectedYear !== null && selectedMonth !== null) {
      let nextDay = selectedDay;
      let nextMonth = selectedMonth;
      let nextYear = selectedYear;
      let handled = false;

      if (e.key === 'ArrowLeft') {
        nextDay -= 1;
        handled = true;
      } else if (e.key === 'ArrowRight') {
        nextDay += 1;
        handled = true;
      } else if (e.key === 'ArrowUp') {
        nextDay -= 7;
        handled = true;
      } else if (e.key === 'ArrowDown') {
        nextDay += 7;
        handled = true;
      }

      if (handled) {
        e.preventDefault();
        // Check bounds
        const tempDate = new Date(nextYear, nextMonth, nextDay);
        updateDateTime(tempDate.getDate(), tempDate.getFullYear(), tempDate.getMonth(), hours, minutes);
        setCurrentYear(tempDate.getFullYear());
        setCurrentMonth(tempDate.getMonth());
      }
    }
  };

  // Render the calendar grid
  const renderCalendarDays = () => {
    const totalDays = daysInMonth(currentYear, currentMonth);
    const firstDayIndex = firstDayOfMonth(currentYear, currentMonth);
    const dayCells: React.ReactNode[] = [];

    // Empty cells for alignment before the 1st of the month
    for (let i = 0; i < firstDayIndex; i++) {
      dayCells.push(
        <div key={`empty-${i}`} className="w-8 h-8" />
      );
    }

    const today = new Date();

    // Actual month day cells
    for (let day = 1; day <= totalDays; day++) {
      const isSelected = selectedDay === day && selectedYear === currentYear && selectedMonth === currentMonth;
      const isToday = today.getDate() === day && today.getFullYear() === currentYear && today.getMonth() === currentMonth;

      dayCells.push(
        <button
          key={`day-${day}`}
          type="button"
          onClick={() => handleDaySelect(day)}
          className={`w-8 h-8 rounded-lg text-xs font-mono font-medium transition-all flex items-center justify-center cursor-pointer focus:outline-hidden focus:ring-1 ${colors.focusRing} ${
            isSelected
              ? `${colors.bg} text-white font-bold`
              : isToday
                ? 'border border-[#26283d] text-[#f4f4f5] font-semibold bg-[#1c1d2e]'
                : 'text-slate-300 hover:bg-[#1a1b2c] hover:text-white'
          }`}
        >
          {day}
        </button>
      );
    }

    return dayCells;
  };

  // Format the display text for the input box
  const getDisplayText = () => {
    if (!value || !isValidDate) return '';
    const dateObj = new Date(value);
    
    // Formatting: YYYY-MM-DD HH:mm
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const hh = String(dateObj.getHours()).padStart(2, '0');
    const min = String(dateObj.getMinutes()).padStart(2, '0');
    
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  };

  return (
    <div id={id ? `datetime-picker-container-${id}` : 'datetime-picker-container'} className="relative w-full" ref={containerRef}>
      {/* Trigger Input Button */}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={`w-full text-left pl-10 pr-3.5 py-2.5 bg-[#171926] border ${
          isOpen ? `border-indigo-500 ring-1 ring-indigo-500` : 'border-[#26283d]'
        } rounded-xl text-white text-sm transition-all duration-200 cursor-pointer flex items-center justify-between focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <span className={getDisplayText() ? 'text-white' : 'text-slate-500 font-medium'}>
          {getDisplayText() || placeholder}
        </span>
        <Calendar className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500 pointer-events-none" />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          id={id ? `datetime-picker-popover-${id}` : 'datetime-picker-popover'}
          className="absolute top-full left-0 mt-2 bg-[#12131a] border border-[#212332] rounded-2xl p-4.5 shadow-[0_12px_36px_rgba(0,0,0,0.6)] z-50 w-72 select-none animate-in fade-in slide-in-from-top-2 duration-150"
        >
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-3 border-b border-[#212332]/50 pb-2">
            <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              {MONTHS[currentMonth]} {currentYear}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-[#1a1b2c] transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-[#1a1b2c] transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEKDAYS.map((day) => (
              <span key={day} className="text-[10px] font-mono text-slate-500 font-bold text-center uppercase">
                {day}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 mb-4">
            {renderCalendarDays()}
          </div>

          {/* Time Selector */}
          <div className="border-t border-[#212332]/60 pt-3 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Time (24h)</span>
            </div>
            
            <div className="flex items-center gap-1">
              <select
                value={hours}
                onChange={handleHourChange}
                className="bg-[#171926] border border-[#26283d] rounded-lg text-xs text-white px-1.5 py-1 focus:outline-hidden focus:border-indigo-500 text-center font-mono cursor-pointer"
              >
                {Array.from({ length: 24 }).map((_, h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, '0')}
                  </option>
                ))}
              </select>
              <span className="text-slate-500 text-xs font-bold font-mono">:</span>
              <select
                value={minutes}
                onChange={handleMinuteChange}
                className="bg-[#171926] border border-[#26283d] rounded-lg text-xs text-white px-1.5 py-1 focus:outline-hidden focus:border-indigo-500 text-center font-mono cursor-pointer"
              >
                {Array.from({ length: 60 }).map((_, m) => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, '0')}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
