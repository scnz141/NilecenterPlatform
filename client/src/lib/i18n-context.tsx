import { createContext, useContext, type ReactNode } from "react";
import { translateUiLabel, type Locale } from "./i18n";

const UiLanguageContext = createContext<Locale>("en");

export function UiLanguageProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <UiLanguageContext.Provider value={locale}>
      {children}
    </UiLanguageContext.Provider>
  );
}

export function useUiLanguage() {
  return useContext(UiLanguageContext);
}

export function useUiLabel() {
  const locale = useUiLanguage();
  return (label: ReactNode): ReactNode => {
    if (typeof label !== "string") return label;
    return translateUiLabel(locale, label);
  };
}
