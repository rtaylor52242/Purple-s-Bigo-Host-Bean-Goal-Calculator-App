export const parseEventDates = (datesStr: string): { validDates: Date[]; excludedPastDates: Date[] } => {
  const allParsedDates = new Set<string>(); // Use set to avoid duplicates, stores YYYY-MM-DD ISO strings
  const currentYear = new Date().getFullYear();

  const dateRanges = datesStr.split(';').map(s => s.trim());

  dateRanges.forEach(range => {
    if (!range) return;
    const parts = range.split('-');
    const startPart = parts[0];
    const [startMonthStr, startDayStr] = startPart.split('/');
    
    if (!startMonthStr || !startDayStr) return;
    
    const startMonth = parseInt(startMonthStr, 10);
    const startDay = parseInt(startDayStr, 10);

    let year = currentYear;
    
    if (isNaN(startMonth) || isNaN(startDay)) return;

    let startDate = new Date(Date.UTC(year, startMonth - 1, startDay));

    if (parts.length === 1) { // Single date
      allParsedDates.add(startDate.toISOString().split('T')[0]);
    } else { // Date range
      const endPart = parts[1];
      const endParts = endPart.split('/');
      
      const endDayStr = endParts[endParts.length - 1];
      const endMonthStr = endParts.length > 1 ? endParts[0] : startMonthStr;
      
      const endMonth = parseInt(endMonthStr, 10);
      const endDay = parseInt(endDayStr, 10);

      if (isNaN(endMonth) || isNaN(endDay)) return;

      let endYear = year;
      // If the end month is before the start month (e.g., Dec-Jan), assume it's for the next year.
      if (endMonth < startMonth) {
        endYear = year + 1;
      }
      
      let endDate = new Date(Date.UTC(endYear, endMonth - 1, endDay));

      for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
        allParsedDates.add(d.toISOString().split('T')[0]);
      }
    }
  });
  
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayISO = today.toISOString().split('T')[0];

  const validDates: Date[] = [];
  const excludedPastDates: Date[] = [];

  Array.from(allParsedDates).forEach(isoDateStr => {
    // Compare ISO strings directly to avoid timezone issues.
    if (isoDateStr < todayISO) {
      excludedPastDates.push(new Date(isoDateStr + 'T00:00:00Z'));
    } else {
      validDates.push(new Date(isoDateStr + 'T00:00:00Z'));
    }
  });
  
  validDates.sort((a,b) => a.getTime() - b.getTime());
  excludedPastDates.sort((a,b) => a.getTime() - b.getTime());

  return { validDates, excludedPastDates };
};

interface FormattedDateGroup {
  id: string; // Unique ID for React key, e.g., '2026-05-13_2026-05-14'
  displayString: string; // "1. 05/13/2026 - 05/14/2026"
  datesInGroup: string[]; // ['2026-05-13', '2026-05-14'] - ISO strings
}

export const formatSelectedDatesForDisplay = (
  selectedDates: Set<string>, 
  formatOptions: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' }
): FormattedDateGroup[] => {
  if (selectedDates.size === 0) {
    return [];
  }

  // Convert Set to Array of Date objects and sort them
  const sortedDates = Array.from(selectedDates)
    .map(isoString => new Date(isoString + 'T00:00:00')) // Ensure UTC to avoid timezone issues with date arithmetic
    .sort((a, b) => a.getTime() - b.getTime());

  const formattedGroups: FormattedDateGroup[] = [];
  let i = 0;
  while (i < sortedDates.length) {
    let currentRangeStart = sortedDates[i];
    let currentRangeEnd = sortedDates[i];
    const datesInCurrentGroup: string[] = [currentRangeStart.toISOString().split('T')[0]];

    let j = i + 1;
    while (j < sortedDates.length) {
      const nextDayExpected = new Date(currentRangeEnd);
      nextDayExpected.setDate(nextDayExpected.getDate() + 1); // Get the day after currentRangeEnd

      // Compare ISO strings to ignore time component
      if (nextDayExpected.toISOString().split('T')[0] === sortedDates[j].toISOString().split('T')[0]) {
        currentRangeEnd = sortedDates[j];
        datesInCurrentGroup.push(currentRangeEnd.toISOString().split('T')[0]);
        j++;
      } else {
        break;
      }
    }

    const startFormatted = currentRangeStart.toLocaleDateString(undefined, formatOptions);

    let displayString: string;
    let id: string;

    if (currentRangeStart.toISOString().split('T')[0] === currentRangeEnd.toISOString().split('T')[0]) {
      // Single date
      displayString = startFormatted;
      id = currentRangeStart.toISOString().split('T')[0];
    } else {
      // Date range
      const endFormatted = currentRangeEnd.toLocaleDateString(undefined, formatOptions);
      displayString = `${startFormatted} - ${endFormatted}`;
      id = `${currentRangeStart.toISOString().split('T')[0]}_${currentRangeEnd.toISOString().split('T')[0]}`;
    }
    
    formattedGroups.push({
      id,
      displayString,
      datesInGroup: datesInCurrentGroup,
    });
    i = j;
  }

  return formattedGroups.map((group, index) => ({
    ...group,
    displayString: `${index + 1}. ${group.displayString}`,
  }));
};