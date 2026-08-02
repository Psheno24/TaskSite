"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { useI18n } from "@/lib/i18n/context";

export function DashboardHeader() {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const navItems = [{ href: "/dashboard", label: t("dashboard") }];

  return (
    <header className="sticky top-0 z-20 border-b border-gray-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4 py-3 sm:py-4">
        <div className="rounded-2xl border border-gray-200 bg-gradient-to-r from-white via-gray-50 to-gray-100/80 px-4 py-4 shadow-sm sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/dashboard" className="group inline-flex items-center gap-3 shrink-0">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900 text-sm font-semibold text-white shadow-sm transition-transform group-hover:scale-105">
                TS
              </span>
              <span className="text-lg font-semibold text-gray-900">{t("appName")}</span>
            </Link>
            <div className="flex items-center gap-2 sm:gap-3">
              <LanguageSwitcher />
              <Button variant="ghost" size="sm" className="rounded-full px-4" onClick={handleLogout}>
                {t("signOut")}
              </Button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-200/80 pt-4">
            <nav className="flex flex-wrap items-center gap-2 text-sm">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center rounded-full px-4 py-2 font-medium transition ${
                      isActive
                        ? "bg-gray-900 text-white shadow-sm"
                        : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <Link
              href="/dashboard/create"
              className="inline-flex items-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 sm:ml-auto"
            >
              + {t("createTask")}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
