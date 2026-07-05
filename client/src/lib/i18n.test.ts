import { describe, expect, it } from "vitest";
import {
  getDirection,
  isSupportedLocale,
  localeOptions,
  t,
  translateUiLabel,
} from "./i18n";

describe("ui i18n", () => {
  it("supports the required Nile Learn UI languages only", () => {
    expect(localeOptions.map(option => option.value)).toEqual([
      "en",
      "ar",
      "zh",
      "ru",
      "ur",
      "tr",
    ]);
    expect(isSupportedLocale("en")).toBe(true);
    expect(isSupportedLocale("fr")).toBe(false);
  });

  it("keeps Arabic and Urdu right-to-left", () => {
    expect(getDirection("ar")).toBe("rtl");
    expect(getDirection("ur")).toBe("rtl");
    expect(getDirection("zh")).toBe("ltr");
  });

  it("translates shell and navigation UI labels without touching unknown content", () => {
    expect(t("zh", "signOut")).toBe("退出登录");
    expect(t("ru", "notifications")).toBe("Уведомления");
    expect(translateUiLabel("ar", "Dashboard")).toBe("لوحة التحكم");
    expect(translateUiLabel("ur", "Courses")).toBe("کورسز");
    expect(translateUiLabel("zh", "Student portal")).toBe("学生入口");
    expect(translateUiLabel("tr", "Language")).toBe("Dil");
    expect(translateUiLabel("tr", "Standard Arabic Level 3")).toBe(
      "Standard Arabic Level 3"
    );
  });
});
