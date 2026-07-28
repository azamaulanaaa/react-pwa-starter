import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
} from "react";

export type IntlDateInput = Date | string | number | null | undefined;
export type IntlNumberInput = number | string | null | undefined;

interface IntlContextValue {
  locale: string; // e.g., 'en-US', 'id-ID', 'de'
  language: string; // Extracted e.g., 'en'
  region?: string; // Extracted e.g., 'US'
  currency: string;
  formatCurrency: (
    value: IntlNumberInput,
    options?: Intl.NumberFormatOptions,
  ) => string;
  formatNumber: (
    value: IntlNumberInput,
    options?: Intl.NumberFormatOptions,
  ) => string;
  formatPercent: (
    value: IntlNumberInput,
    options?: Intl.NumberFormatOptions,
  ) => string;
  formatDate: (
    date: IntlDateInput,
    options?: Intl.DateTimeFormatOptions,
  ) => string;
  formatRelativeTime: (
    value: number,
    unit: Intl.RelativeTimeFormatUnit,
    options?: Intl.RelativeTimeFormatOptions,
  ) => string;
  parseNumber: (formattedString: string) => number;
  parseDate: (dateString: string) => Date | null;
}

const IntlContext = createContext<IntlContextValue | null>(null);

interface IntlProviderProps {
  locale?: string; // Standard BCP 47 tag (e.g., 'en-US', 'id-ID', 'de')
  currency?: string; // e.g., 'USD', 'IDR', 'EUR'
  children: ReactNode;
}

export function IntlProvider({
  locale = "en-US",
  currency = "USD",
  children,
}: IntlProviderProps) {
  const [language, region] = useMemo(() => {
    const parts = locale.split("-");
    return [parts[0], parts[1]];
  }, [locale]);

  /**
   * Helper to safely extract numeric values
   */
  const toNumericValue = (value: IntlNumberInput): number | null => {
    if (value === null || value === undefined) return null;
    const num = typeof value === "string" ? parseFloat(value) : value;
    return isNaN(num) ? null : num;
  };

  /**
   * Formats currency safely with fallback if invalid currency code is supplied
   */
  const formatCurrency = useCallback(
    (
      value: IntlNumberInput,
      options: Intl.NumberFormatOptions = {},
    ): string => {
      const numericValue = toNumericValue(value);
      if (numericValue === null) return "";

      try {
        return new Intl.NumberFormat(locale, {
          style: "currency",
          currency,
          ...options,
        }).format(numericValue);
      } catch {
        return new Intl.NumberFormat(locale, {
          style: "currency",
          currency: "USD",
          ...options,
        }).format(numericValue);
      }
    },
    [locale, currency],
  );

  /**
   * Formats numbers with localized grouping/decimals
   */
  const formatNumber = useCallback(
    (
      value: IntlNumberInput,
      options: Intl.NumberFormatOptions = {},
    ): string => {
      const numericValue = toNumericValue(value);
      if (numericValue === null) return "";

      return new Intl.NumberFormat(locale, options).format(numericValue);
    },
    [locale],
  );

  /**
   * Formats percentages
   */
  const formatPercent = useCallback(
    (
      value: IntlNumberInput,
      options: Intl.NumberFormatOptions = {},
    ): string => {
      const numericValue = toNumericValue(value);
      if (numericValue === null) return "";

      return new Intl.NumberFormat(locale, {
        style: "percent",
        ...options,
      }).format(numericValue);
    },
    [locale],
  );

  /**
   * Formats dates
   */
  const formatDate = useCallback(
    (
      date: IntlDateInput,
      options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
    ): string => {
      if (!date) return "";
      const dateObj = typeof date === "object" ? date : new Date(date);
      if (isNaN(dateObj.getTime())) return "";

      return new Intl.DateTimeFormat(locale, options).format(dateObj);
    },
    [locale],
  );

  /**
   * Formats relative time (e.g., "2 days ago")
   */
  const formatRelativeTime = useCallback(
    (
      value: number,
      unit: Intl.RelativeTimeFormatUnit,
      options: Intl.RelativeTimeFormatOptions = { numeric: "auto" },
    ): string => {
      return new Intl.RelativeTimeFormat(locale, options).format(value, unit);
    },
    [locale],
  );

  /**
   * Parses localized number string into raw float based on local decimal rules
   */
  const parseNumber = useCallback(
    (formattedString: string): number => {
      if (!formattedString || typeof formattedString !== "string") return 0;

      const parts = new Intl.NumberFormat(locale).formatToParts(123456.78);
      const decimalSeparator =
        parts.find((part) => part.type === "decimal")?.value || ".";
      const groupSeparator =
        parts.find((part) => part.type === "group")?.value || ",";

      const cleanString = formattedString
        .split(groupSeparator)
        .join("")
        .replace(decimalSeparator, ".");

      const normalized = cleanString.replace(/[^0-9.-]/g, "");

      const parsed = parseFloat(normalized);
      return isNaN(parsed) ? 0 : parsed;
    },
    [locale],
  );

  /**
   * Parses ISO or standard date strings safely
   */
  const parseDate = useCallback((dateString: string): Date | null => {
    const parsedDate = new Date(dateString);
    return isNaN(parsedDate.getTime()) ? null : parsedDate;
  }, []);

  const value = useMemo(
    () => ({
      locale,
      language,
      region,
      currency,
      formatCurrency,
      formatNumber,
      formatPercent,
      formatDate,
      formatRelativeTime,
      parseNumber,
      parseDate,
    }),
    [
      locale,
      language,
      region,
      currency,
      formatCurrency,
      formatNumber,
      formatPercent,
      formatDate,
      formatRelativeTime,
      parseNumber,
      parseDate,
    ],
  );

  return <IntlContext.Provider value={value}>{children}</IntlContext.Provider>;
}

export function useIntl() {
  const context = useContext(IntlContext);
  if (!context) {
    throw new Error("useIntl must be used within an IntlProvider");
  }
  return context;
}
