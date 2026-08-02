import { useMemo } from "react";
import type { Formatters } from "react-day-picker";

/**
 * Custom hook providing native Intl-driven formatters for react-day-picker,
 * eliminating external locale bundle dependencies.
 */
export function useFormatters(
  /** BCP 47 locale tag (e.g., "en-US", "id-ID", "ja-JP", "ar-SA") */
  locale: string,
): Formatters {
  return useMemo(() => {
    // ─── Cache native Intl instances once per locale ──────────────────────────
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

    // ─── Native Intl Formatters ───────────────────────────────────────────────

    /** Month & Year header label (e.g., "August 2026") */
    const formatCaption = (date: Date): string => {
      return captionFormatter.format(date);
    };

    /** Day of month number (e.g., "1", "2", "3") */
    const formatDay = (date: Date): string => {
      return numberFormatter.format(date.getDate());
    };

    /** Month dropdown select option label (e.g., "Aug") */
    const formatMonthDropdown = (month: Date): string => {
      const parts = monthDropdownFormatter.formatToParts(month);
      return parts.find((p) => p.type === "month")?.value ?? "";
    };

    /** Week number column label */
    const formatWeekNumber = (weekNumber: number): string => {
      return numberFormatter.format(weekNumber);
    };

    /** Week number header label */
    const formatWeekNumberHeader = (): string => "";

    /** Column header weekday label (e.g., "Mo", "Tu", "We") */
    const formatWeekdayName = (weekday: Date): string => {
      const parts = weekdayFormatter.formatToParts(weekday);
      return parts.find((p) => p.type === "weekday")?.value ?? "";
    };

    /** Year dropdown select option label (e.g., "2026") */
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
