export const parseEventDates = (datesStr: string): Date[] => {
  const dates = new Set<string>(); // Use set to avoid duplicates
  const currentYear = new Date().getFullYear();

  const dateRanges = datesStr.split(';').map(s => s.trim());

  dateRanges.forEach(range => {
    const parts = range.split('-');
    const [startMonth, startDay] = parts[0].split('/');
    
    if (!startMonth || !startDay) return;

    let year = currentYear;
    let startDate = new Date(Date.UTC(year, parseInt(startMonth) - 1, parseInt(startDay)));
    
    const today = new Date();
    today.setUTCHours(0,0,0,0);

    // If date is in the past, assume next year
    if (startDate < today) {
        year = currentYear + 1;
        startDate = new Date(Date.UTC(year, parseInt(startMonth) - 1, parseInt(startDay)));
    }

    if (parts.length === 1) { // Single date
      dates.add(startDate.toISOString().split('T')[0]);
    } else { // Date range
      const endPart = parts[1];
      const endParts = endPart.split('/');
      const endDay = endParts[endParts.length - 1];
      const endMonth = endParts.length > 1 ? endParts[0] : startMonth;
      
      let endDate = new Date(Date.UTC(year, parseInt(endMonth) - 1, parseInt(endDay)));
      if (endDate < startDate) {
          endDate.setUTCFullYear(year + 1);
      }

      for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
        dates.add(d.toISOString().split('T')[0]);
      }
    }
  });
  
  return Array.from(dates)
    .map(d => new Date(d))
    .sort((a,b) => a.getTime() - b.getTime());
};
