import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
} from "react";

export type Config = {
  theme: "light" | "dark" | "system";
  locale: string | null;
  isSidebarOpen: boolean;
};

export type ConfigContextType = {
  config: Config;
  setConfig: (value: Config | ((prev: Config) => Config)) => void;
  updateConfig: (updates: Partial<Config>) => void;
};

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export type ConfigProviderProps = {
  children: ReactNode;
  config: Config;
  setConfig: (value: Config | ((prev: Config) => Config)) => void;
};

export const ConfigProvider = ({
  children,
  config,
  setConfig,
}: ConfigProviderProps) => {
  const updateConfig = useCallback((updates: Partial<Config>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, [setConfig]);

  const value = useMemo(
    () => ({ config, setConfig, updateConfig }),
    [config, setConfig, updateConfig],
  );

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error("useConfig must be used within a ConfigProvider");
  }
  return context;
};
