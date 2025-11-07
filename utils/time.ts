export const formatTime = (
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
  // the hour '0' should be '12'
  h = h === 0 ? 12 : h;

  return `${h}:${minutes} ${suffix}`;
};
