
interface DayInfo {
  date: Date;
  isCurrentMonth: boolean;
}

export const getMonthGrid = (date: Date): DayInfo[] => {
  const year = date.getFullYear();
  const month = date.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  
  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 for Sunday
  
  const days: DayInfo[] = [];
  
  // Days from previous month
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startDayOfWeek; i > 0; i--) {
    days.push({
      date: new Date(year, month - 1, prevMonthLastDay - i + 1),
      isCurrentMonth: false,
    });
  }
  
  // Days of current month
  for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
    days.push({
      date: new Date(year, month, i),
      isCurrentMonth: true,
    });
  }
  
  // Days from next month to fill grid (usually up to 6 weeks / 42 cells)
  const totalCells = 42;
  let nextMonthDay = 1;
  while (days.length < totalCells) {
    days.push({
      date: new Date(year, month + 1, nextMonthDay++),
      isCurrentMonth: false,
    });
  }
  
  return days;
};

export const getWeekDays = (date: Date): Date[] => {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Go to Sunday
    const week: Date[] = [];
    for(let i=0; i < 7; i++) {
        const day = new Date(startOfWeek);
        day.setDate(day.getDate() + i);
        week.push(day);
    }
    return week;
}
