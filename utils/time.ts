import { Event } from '../types';

const _formatSimpleTime = (
  time: string, // Expects "HH:MM" format
  format: 'military' | 'standard'
): string => {
  if (format === 'military') {
    return time;
  }

  const [hours, minutes] = time.split(':');
  let h = parseInt(hours, 10);
  const suffix = h >= 12 ? 'PM' : 'AM';
  
  h = h % 12;
  h = h === 0 ? 12 : h;

  return `${h}:${minutes} ${suffix}`;
};

export const formatTime = (
  time: string, // Expects "HH:MM" format
  format: 'military' | 'standard',
  event?: Event,
  targetTimeZone?: string
): string => {
  // If no event or timezone is provided, use the simple formatter
  if (!event || !targetTimeZone) {
    return _formatSimpleTime(time, format);
  }

  try {
    const dateMatch = event.name.match(/\((\d{2}\/\d{2}\/\d{4})\)/);
    const dateStr = dateMatch ? dateMatch[1] : event.eventDates;
    
    if (!dateStr) return _formatSimpleTime(time, format);

    const [month, day, year] = dateStr.split('/');
    const [hours, minutes] = time.split(':');

    // Assume the original times are in 'America/Los_Angeles' (PST/PDT).
    // The most reliable way to handle time zone conversion without a library is to
    // create a UTC date and then format it for the target time zone.
    // We'll approximate the UTC offset. PDT is UTC-7, PST is UTC-8. We'll use -7 as a general offset
    // for Pacific time as most events will fall under DST. This is a simplification.
    const PACIFIC_OFFSET_HOURS = 7;
    const eventUTCHour = parseInt(hours, 10) + PACIFIC_OFFSET_HOURS;

    const eventDate = new Date(Date.UTC(
      parseInt(year, 10),
      parseInt(month, 10) - 1,
      parseInt(day, 10),
      eventUTCHour,
      parseInt(minutes, 10)
    ));

    const options: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: 'numeric',
      hour12: format === 'standard',
      timeZone: targetTimeZone,
      timeZoneName: 'short',
    };
    
    return new Intl.DateTimeFormat('en-US', options).format(eventDate);
  } catch (error) {
    console.error("Error converting time zone:", error);
    // Fallback to simple formatting on error
    return _formatSimpleTime(time, format);
  }
};