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
      const endDay = endParts[endParts[0].length > 2 ? endParts.length -1 : 0]; // If month isn't provided (e.g., 05/13-14), endParts[0] is day
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