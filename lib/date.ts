import { format as dateFnsFormat } from "date-fns";
import { th, enUS } from "date-fns/locale";

/**
 * Formats a date string, number, or Date object into a localized string.
 * Supports Thai Buddhist Era (BE) automatically when locale is 'th'.
 * 
 * @param date The date to format
 * @param formatStr The format string (date-fns format). Default: "d MMMM yyyy"
 * @param locale The locale code (e.g., 'en', 'th')
 * @returns The formatted date string
 */
export function formatDate(
    date: Date | string | number | null | undefined,
    formatStrOrLocale: string = "d MMMM yyyy",
    localeArg: string = "en"
): string {
    if (!date) return "";

    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return "";

    // Support both signatures: formatDate(date, formatStr, locale) and formatDate(date, locale)
    const isSecondArgLocale = formatStrOrLocale === "th" || formatStrOrLocale === "en" || formatStrOrLocale.length === 2;
    const formatStr = isSecondArgLocale ? "d MMMM yyyy" : formatStrOrLocale;
    const locale = isSecondArgLocale ? formatStrOrLocale : localeArg;

    // If Thai locale, use Intl.DateTimeFormat for Buddhist Year support
    // date-fns doesn't natively support Buddhist calendar types easily without plugins
    if (locale === 'th') {
        // Map date-fns format tokens to Intl options (Approximate mapping)
        // This is a basic mapping for common patterns used in the app
        // If it looks like a standard date format we want to localize to BE
        const hasDay = formatStr.includes("d");
        const hasMonth = formatStr.includes("MMM");
        const hasYear = formatStr.includes("yyyy") || formatStr.includes("yy");
        const hasTime = formatStr.includes("HH:mm");

        if (hasDay && hasMonth) {
            const hasWeekday = formatStr.includes("E");
            const options: Intl.DateTimeFormatOptions = {
                day: 'numeric',
                month: formatStr.includes("MMMM") ? 'long' : 'short',
                year: hasYear ? 'numeric' : undefined,
                weekday: hasWeekday ? (formatStr.includes("EEEE") ? 'long' : 'short') : undefined,
                calendar: 'buddhist',
                timeZone: 'Asia/Bangkok'
            };


            if (hasTime) {
                options.hour = '2-digit';
                options.minute = '2-digit';
                options.hour12 = false;
            }

            return new Intl.DateTimeFormat('th-TH', options).format(dateObj);
        }
    }

    // Fallback to date-fns for English or non-Thai (Gregorian)
    return dateFnsFormat(dateObj, formatStr, {
        locale: locale === 'th' ? th : enUS 
    });
}

/**
 * Checks if a document deadline has passed.
 * For date-only strings (e.g. YYYY-MM-DD), the deadline is valid through 23:59:59.999 of that day.
 */
export function isPastDocumentDeadline(deadlineStr?: string | null): boolean {
    if (!deadlineStr) return false;
    let deadlineDate: Date;
    if (deadlineStr.length <= 10) {
        deadlineDate = new Date(deadlineStr + "T23:59:59.999");
    } else {
        deadlineDate = new Date(deadlineStr);
    }
    if (isNaN(deadlineDate.getTime())) return false;
    return new Date() > deadlineDate;
}
