import { useMemo } from "react";
import type { Formatters } from "react-day-picker";

/**
 * Returns formatters that use the native `Intl` API.
 * `react-day-picker` does not need an external locale bundle.
 */
export function useFormatters(
  /** BCP 47 locale tag (e.g., "en-US", "id-ID", "ja-JP", "ar-SA") */
  locale: string,
): Formatters {
  return useMemo(() => {
    // ─── Creates the native Intl instances once per locale ────────────────────
    const numberFormatter = new Intl.NumberFormat(locale, {
      useGrouping: false,
    });

    const captionFormatter = new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
    });

    const monthDropdownFormatter = new Intl.DateTimeFormat(locale, {
      month: "short",
    });

    const weekdayFormatter = new Intl.DateTimeFormat(locale, {
      weekday: "short",
    });

    // ─── Native Intl formatters ───────────────────────────────────────────────

    /** Header label for the month and the year (e.g., "August 2026") */
    const formatCaption = (date: Date): string => {
      return captionFormatter.format(date);
    };

    /** Day number in the month (e.g., "1", "2", "3") */
    const formatDay = (date: Date): string => {
      return numberFormatter.format(date.getDate());
    };

    /** Option label in the month list (e.g., "Aug") */
    const formatMonthDropdown = (month: Date): string => {
      const parts = monthDropdownFormatter.formatToParts(month);
      return parts.find((p) => p.type === "month")?.value ?? "";
    };

    /** Column label for the week number */
    const formatWeekNumber = (weekNumber: number): string => {
      return numberFormatter.format(weekNumber);
    };

    /** Header label for the week number */
    const formatWeekNumberHeader = (): string => "";

    /** Column header label for the weekday (e.g., "Mo", "Tu", "We") */
    const formatWeekdayName = (weekday: Date): string => {
      const parts = weekdayFormatter.formatToParts(weekday);
      return parts.find((p) => p.type === "weekday")?.value ?? "";
    };

    /** Option label in the year list (e.g., "2026") */
    const formatYearDropdown = (year: Date): string => {
      return numberFormatter.format(year.getFullYear());
    };

    return {
      formatCaption,
      formatDay,
      formatMonthDropdown,
      formatWeekNumber,
      formatWeekNumberHeader,
      formatWeekdayName,
      formatYearDropdown,
    };
  }, [locale]);
}
