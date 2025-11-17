import React, { useState, useMemo, useCallback } from 'react';

interface CalendarProps {
  selectedDates: Set<string>; // Now receives selected dates as a prop
  onDatesChange: (selectedDates: Set<string>) => void; // Callback to update parent
  currentMonth: Date;
  onMonthChange: (newDate: Date) => void;
  holidays?: Map<string, string>;
  onHolidayClick?: (name: string, date: Date) => void;
  isMonthLocked?: boolean;
}

interface DayInfo {
  date: Date;
  isCurrentMonth: boolean;
}

const Calendar: React.FC<CalendarProps> = ({ selectedDates, onDatesChange, currentMonth, onMonthChange, holidays, onHolidayClick, isMonthLocked = false }) => {
  const [lastClickedDate, setLastClickedDate] = useState<string | null>(null); // For shift-click range selection

  const getDaysInMonth = (date: Date): DayInfo[] => {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed month

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0); // Day 0 of next month is last day of current
    const numDays = lastDayOfMonth.getDate();

    const startDayOfWeek = firstDayOfMonth.getDay(); // 0 for Sunday, 1 for Monday, etc.

    const days: DayInfo[] = [];

    // Add days from the previous month to fill the first row
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
      });
    }

    // Add days for the current month
    for (let i = 1; i <= numDays; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // Add days from the next month to fill the last row(s) for a consistent 6-row height (42 cells)
    const totalCells = days.length;
    const remainingCells = 42 - totalCells; 
    if (remainingCells > 0) {
      for (let i = 1; i <= remainingCells; i++) {
        days.push({
          date: new Date(year, month + 1, i),
          isCurrentMonth: false,
        });
      }
    }

    return days;
  };

  const daysInCalendar = useMemo(() => getDaysInMonth(currentMonth), [currentMonth]);

  const goToPreviousMonth = useCallback(() => {
    onMonthChange(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    setLastClickedDate(null); // Reset last clicked on month change
  }, [currentMonth, onMonthChange]);

  const goToNextMonth = useCallback(() => {
    onMonthChange(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    setLastClickedDate(null); // Reset last clicked on month change
  }, [currentMonth, onMonthChange]);

  const handleDayClick = useCallback((dayDate: Date, e: React.MouseEvent) => {
    if (!dayDate) return; 
    const dateIsoString = dayDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    const newSelectedDates = new Set(selectedDates); // Start with a copy of the prop

    if (e.shiftKey && lastClickedDate) {
      // Shift-click: Select/deselect all dates in a range
      const startDate = new Date(lastClickedDate);
      const endDate = dayDate;

      const minDate = new Date(Math.min(startDate.getTime(), endDate.getTime()));
      const maxDate = new Date(Math.max(startDate.getTime(), endDate.getTime()));

      const datesToConsiderInShiftRange: string[] = [];
      for (let d = new Date(minDate); d <= maxDate; d.setDate(d.getDate() + 1)) {
        datesToConsiderInShiftRange.push(d.toISOString().split('T')[0]);
      }
      
      const allDatesInShiftRangeSelected = datesToConsiderInShiftRange.every(d => newSelectedDates.has(d));

      datesToConsiderInShiftRange.forEach(d => {
        if (allDatesInShiftRangeSelected) {
          newSelectedDates.delete(d);
        } else {
          newSelectedDates.add(d);
        }
      });

    } else if (e.metaKey || e.ctrlKey) {
      // Ctrl/Cmd-click: Toggle individual date without affecting others
      if (newSelectedDates.has(dateIsoString)) {
        newSelectedDates.delete(dateIsoString);
      } else {
        newSelectedDates.add(dateIsoString);
      }
    } else {
      // Simple click: Select single date, clearing others, or deselect if already the only one
      if (newSelectedDates.has(dateIsoString) && newSelectedDates.size === 1) {
        newSelectedDates.delete(dateIsoString); 
      } else {
        newSelectedDates.clear(); 
        newSelectedDates.add(dateIsoString); 
      }
    }

    onDatesChange(newSelectedDates); // Call parent callback
    setLastClickedDate(dateIsoString); // Update internal last clicked date for subsequent shift-clicks
  }, [selectedDates, lastClickedDate, onDatesChange]); // Dependencies updated

  // Helper to get all ISO date strings for days in the current month (only)
  const getCurrentMonthOnlyDays = useCallback((): string[] => {
    return daysInCalendar
      .filter(day => day.isCurrentMonth)
      .map(day => day.date.toISOString().split('T')[0]);
  }, [daysInCalendar]);

  const getDaysForActualCurrentWeek = useCallback((): string[] => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Go to Sunday of current week
    const weekDays: string[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      weekDays.push(day.toISOString().split('T')[0]);
    }
    return weekDays;
  }, []);


  // Helper to get all ISO date strings for weekends in the current month
  const getDaysForWeekendsInMonth = useCallback((): string[] => {
    return daysInCalendar
      .filter(day => day.isCurrentMonth && (day.date.getDay() === 0 || day.date.getDay() === 6)) // Sunday (0) or Saturday (6)
      .map(day => day.date.toISOString().split('T')[0]);
  }, [daysInCalendar]);

  // Helper to get all ISO date strings for weekdays in the current month
  const getDaysForWeekdaysInMonth = useCallback((): string[] => {
    return daysInCalendar
      .filter(day => day.isCurrentMonth && (day.date.getDay() > 0 && day.date.getDay() < 6)) // Monday (1) to Friday (5)
      .map(day => day.date.toISOString().split('T')[0]);
  }, [daysInCalendar]);

  const handleToggleSelection = useCallback((targetDates: string[], type: 'month' | 'week' | 'weekends' | 'weekdays' | 'dayOfWeek') => {
    const newSelectedDates = new Set(selectedDates);
    const allTargetDatesSelected = targetDates.length > 0 && targetDates.every(dateIso => newSelectedDates.has(dateIso));

    if (allTargetDatesSelected) {
      targetDates.forEach(dateIso => newSelectedDates.delete(dateIso));
    } else {
      targetDates.forEach(dateIso => newSelectedDates.add(dateIso));
    }
    onDatesChange(newSelectedDates);
    setLastClickedDate(null); // Reset last clicked date after mass selection
  }, [selectedDates, onDatesChange]);

  const handleToggleMonthSelection = useCallback(() => {
    handleToggleSelection(getCurrentMonthOnlyDays(), 'month');
  }, [getCurrentMonthOnlyDays, handleToggleSelection]);

  const handleToggleCurrentWeekSelection = useCallback(() => {
    const fullWeekDaysIso = getDaysForActualCurrentWeek();
    handleToggleSelection(fullWeekDaysIso, 'week');
  }, [getDaysForActualCurrentWeek, handleToggleSelection]);

  const handleToggleWeekendsSelection = useCallback(() => {
    handleToggleSelection(getDaysForWeekendsInMonth(), 'weekends');
  }, [getDaysForWeekendsInMonth, handleToggleSelection]);

  const handleToggleWeekdaysSelection = useCallback(() => {
    handleToggleSelection(getDaysForWeekdaysInMonth(), 'weekdays');
  }, [getDaysForWeekdaysInMonth, handleToggleSelection]);

  // New handler for clicking weekday labels
  const handleWeekdayLabelClick = useCallback((dayOfWeekIndex: number) => {
    const targetDates = daysInCalendar
      .filter(day => day.isCurrentMonth && day.date.getDay() === dayOfWeekIndex)
      .map(day => day.date.toISOString().split('T')[0]);
    
    handleToggleSelection(targetDates, 'dayOfWeek');
  }, [daysInCalendar, handleToggleSelection]);


  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Determine if all current month days are selected for the toggle button text
  const currentMonthDaysOnly = getCurrentMonthOnlyDays();
  const allCurrentMonthDaysSelected = currentMonthDaysOnly.length > 0 && currentMonthDaysOnly.every(day => selectedDates.has(day));

  const currentWeekDays = useMemo(() => getDaysForActualCurrentWeek(), [getDaysForActualCurrentWeek]);
  const allCurrentWeekDaysSelected = currentWeekDays.length > 0 && currentWeekDays.every(day => selectedDates.has(day));

  // Determine if all weekends in current month are selected
  const weekendsInMonth = getDaysForWeekendsInMonth();
  const allWeekendsInMonthSelected = weekendsInMonth.length > 0 && weekendsInMonth.every(day => selectedDates.has(day));

  // Determine if all weekdays in current month are selected
  const weekdaysInMonth = getDaysForWeekdaysInMonth();
  const allWeekdaysInMonthSelected = weekdaysInMonth.length > 0 && weekdaysInMonth.every(day => selectedDates.has(day));
  
  const isViewingCurrentMonth = useMemo(() => {
    const today = new Date();
    return currentMonth.getMonth() === today.getMonth() && currentMonth.getFullYear() === today.getFullYear();
  }, [currentMonth]);

  return (
    <div className="p-4 bg-gray-50 dark:bg-[#2a233a] rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={goToPreviousMonth}
          disabled={isMonthLocked}
          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Previous Month"
        >
          &lt;
        </button>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white w-40 text-center">
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h3>
        <button
          onClick={goToNextMonth}
          disabled={isMonthLocked}
          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Next Month"
        >
          &gt;
        </button>
      </div>
      
      <div className="mb-4 space-y-2">
        <button
          onClick={handleToggleMonthSelection}
          className="w-full bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-white py-2 rounded-md hover:bg-purple-200 dark:hover:bg-purple-700 transition-colors text-sm font-medium"
          aria-label={allCurrentMonthDaysSelected ? "Deselect all days in current month" : "Select all days in current month"}
        >
          {allCurrentMonthDaysSelected ? 'Deselect Month' : 'Select Month'}
        </button>
        <button
          onClick={handleToggleCurrentWeekSelection}
          disabled={!isViewingCurrentMonth}
          className="w-full bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-white py-2 rounded-md hover:bg-purple-200 dark:hover:bg-purple-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={allCurrentWeekDaysSelected ? "Deselect all days in current week" : "Select all days in current week"}
        >
          {allCurrentWeekDaysSelected ? 'Deselect Current Week' : 'Select Current Week'}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleToggleWeekendsSelection}
            className="w-full bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-white py-2 rounded-md hover:bg-purple-200 dark:hover:bg-purple-700 transition-colors text-sm font-medium"
            aria-label={allWeekendsInMonthSelected ? "Deselect weekends in current month" : "Select weekends in current month"}
          >
            {allWeekendsInMonthSelected ? 'Deselect Weekends' : 'Select Weekends'}
          </button>
          <button
            onClick={handleToggleWeekdaysSelection}
            className="w-full bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-white py-2 rounded-md hover:bg-purple-200 dark:hover:bg-purple-700 transition-colors text-sm font-medium"
            aria-label={allWeekdaysInMonthSelected ? "Deselect weekdays in current month" : "Select weekdays in current month"}
          >
            {allWeekdaysInMonthSelected ? 'Deselect Weekdays' : 'Select Weekdays'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-sm">
        {weekdayNames.map((day, index) => (
          <div 
            key={day} 
            className="font-medium text-gray-500 dark:text-gray-400 py-2 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            onClick={() => handleWeekdayLabelClick(index)}
            role="button"
            aria-label={`Toggle selection for all ${day}s in ${monthNames[currentMonth.getMonth()]}`}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleWeekdayLabelClick(index);
              }
            }}
          >
            {day}
          </div>
        ))}
        {daysInCalendar.map((day, index) => {
          const dateIsoString = day.date.toISOString().split('T')[0];
          const isSelected = selectedDates.has(dateIsoString);
          const holidayName = holidays?.get(dateIsoString);
          const today = new Date();
          const isToday = day.date.getDate() === today.getDate() &&
                          day.date.getMonth() === today.getMonth() &&
                          day.date.getFullYear() === today.getFullYear();

          return (
            <div
              key={index}
              className={`relative flex items-center justify-center h-10 w-10 rounded-full cursor-pointer transition-colors
                ${day.isCurrentMonth ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'}
                ${isSelected ? 'bg-purple-600 text-white hover:bg-purple-700' : (day.isCurrentMonth ? 'hover:bg-gray-200 dark:hover:bg-gray-700' : '')}
                ${isToday && day.isCurrentMonth && !isSelected ? 'border-2 border-purple-400 dark:border-purple-500' : ''}
              `}
              onClick={(e) => day.isCurrentMonth && handleDayClick(day.date, e)}
              aria-pressed={isSelected}
              aria-label={day.date.toDateString()}
              tabIndex={day.isCurrentMonth ? 0 : -1}
              role="gridcell"
            >
              <span className="z-10">{day.date.getDate()}</span>
              {holidayName && (
                <div 
                  className="absolute bottom-1 right-1 h-2 w-2 bg-red-500 rounded-full z-20 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onHolidayClick) {
                      onHolidayClick(holidayName, day.date);
                    } else {
                      alert(holidayName);
                    }
                  }}
                  title={holidayName}
                ></div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Calendar;
