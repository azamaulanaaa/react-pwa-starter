import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useRef,
} from "react";
import { compile, type Renderer } from "micromustache";

export type TranslationParams = Record<string, string | number>;

export type TFunction<TKey extends string = string> = (
  key: TKey,
  params?: TranslationParams,
) => string;

export type NestedRecord = {
  [key: string]: string | NestedRecord;
};

export interface TranslationContextType {
  t: TFunction;
}

export interface TranslationProviderProps {
  children: ReactNode;
  dictionary?: NestedRecord;
  fallbackDictionary?: NestedRecord;
}

function getNestedValue(
  obj: NestedRecord | undefined,
  path: string,
): string | undefined {
  if (!obj) return undefined;

  const result = path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);

  return typeof result === "string" ? result : undefined;
}

const TranslationContext = createContext<TranslationContextType | null>(null);

export function TranslationProvider({
  children,
  dictionary = {},
  fallbackDictionary = {},
}: TranslationProviderProps) {
  const compileCache = useRef<Map<string, Renderer>>(new Map());

  const contextValue = useMemo<TranslationContextType>(() => {
    compileCache.current.clear();

    const t: TFunction = (key, params) => {
      let renderer = compileCache.current.get(key);

      if (!renderer) {
        const format = getNestedValue(dictionary, key) ??
          getNestedValue(fallbackDictionary, key) ??
          key;

        renderer = compile(format);
        compileCache.current.set(key, renderer);
      }

      return renderer.render(params);
    };

    return { t };
  }, [dictionary, fallbackDictionary]);

  return (
    <TranslationContext.Provider value={contextValue}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation(): TranslationContextType {
  const context = useContext(TranslationContext);

  if (!context) {
    throw new Error("useTranslation must be used within a TranslationProvider");
  }

  return context;
}
