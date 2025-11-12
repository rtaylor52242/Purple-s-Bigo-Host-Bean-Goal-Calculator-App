// utils/holidays.ts

// Helper function to get the nth day of the week in a month
const getNthDayOfWeek = (year: number, month: number, dayOfWeek: number, n: number): Date => {
    const date = new Date(Date.UTC(year, month, 1));
    // Find the first occurrence of the dayOfWeek
    while (date.getUTCDay() !== dayOfWeek) {
        date.setUTCDate(date.getUTCDate() + 1);
    }
    // Add (n-1) weeks to get the nth occurrence
    date.setUTCDate(date.getUTCDate() + (n - 1) * 7);
    return date;
};

// Helper function to get the last day of the week in a month
const getLastDayOfWeek = (year: number, month: number, dayOfWeek: number): Date => {
    const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0));
    const date = new Date(lastDayOfMonth);
    while (date.getUTCDay() !== dayOfWeek) {
        date.setUTCDate(date.getUTCDate() - 1);
    }
    return date;
};

/**
 * Calculates US federal holidays for a given year, including weekend observances.
 * @param year The year to calculate holidays for.
 * @returns A Map where keys are ISO date strings (YYYY-MM-DD) and values are the holiday names.
 */
export const getHolidays = (year: number): Map<string, string> => {
    const holidays = new Map<string, string>();

    // Helper to add a fixed-date holiday and handle weekend observance
    const addFixedHoliday = (month: number, day: number, name: string) => {
        const date = new Date(Date.UTC(year, month, day));
        const dayOfWeek = date.getUTCDay();
        let observedDate = date;

        if (dayOfWeek === 6) { // Saturday
            observedDate = new Date(date);
            observedDate.setUTCDate(date.getUTCDate() - 1); // Observed on Friday
        } else if (dayOfWeek === 0) { // Sunday
            observedDate = new Date(date);
            observedDate.setUTCDate(date.getUTCDate() + 1); // Observed on Monday
        }
        
        holidays.set(observedDate.toISOString().split('T')[0], name);
    };

    // --- Fixed Date Holidays ---
    addFixedHoliday(0, 1, "New Year's Day");
    addFixedHoliday(5, 19, "Juneteenth National Independence Day");
    addFixedHoliday(6, 4, "Independence Day");
    addFixedHoliday(10, 11, "Veterans Day");
    addFixedHoliday(11, 25, "Christmas Day");

    // --- Floating Holidays ---
    // Martin Luther King, Jr.'s Birthday (Third Monday in January)
    holidays.set(getNthDayOfWeek(year, 0, 1, 3).toISOString().split('T')[0], "Martin Luther King, Jr.'s Birthday");

    // Washington's Birthday (Third Monday in February)
    holidays.set(getNthDayOfWeek(year, 1, 1, 3).toISOString().split('T')[0], "Washington's Birthday");

    // Memorial Day (Last Monday in May)
    holidays.set(getLastDayOfWeek(year, 4, 1).toISOString().split('T')[0], "Memorial Day");

    // Labor Day (First Monday in September)
    holidays.set(getNthDayOfWeek(year, 8, 1, 1).toISOString().split('T')[0], "Labor Day");

    // Thanksgiving Day (Fourth Thursday in November)
    holidays.set(getNthDayOfWeek(year, 10, 4, 4).toISOString().split('T')[0], "Thanksgiving Day");

    return holidays;
};
