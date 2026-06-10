"use client";

import { useI18n } from "@/lib/i18n/context";
import type { Locale } from "@/lib/i18n/translations";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  const toggle = () => {
    const next: Locale = locale === "ru" ? "en" : "ru";
    setLocale(next);
  };

  return (
    <button
      onClick={toggle}
      className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
      title={t("language")}
    >
      {locale === "ru" ? "EN" : "RU"}
    </button>
  );
}
