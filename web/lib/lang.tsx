"use client";

import { createContext, Fragment, type ReactNode, useContext, useEffect, useSyncExternalStore } from "react";
import { detectLang, type Lang, LANG_STORAGE_KEY, setCurrentLang } from "./i18n";

/* Bahasa pilihan sebagai "external store": server/prerender selalu "id", browser memakai pilihan
   tersimpan atau bahasa browser (dibaca sekali), lalu berubah lewat setLang. */
let chosen: Lang | undefined;
const listeners = new Set<() => void>();

function getSnapshot(): Lang {
  chosen ??= detectLang();
  return chosen;
}
const getServerSnapshot = (): Lang => "id";
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setLang(next: Lang) {
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, next);
  } catch {
    // penyimpanan diblokir: pilihan berlaku sampai halaman ditutup
  }
  chosen = next;
  listeners.forEach((l) => l());
}

type LangContextValue = { lang: Lang; setLang: (lang: Lang) => void };

const LangContext = createContext<LangContextValue>({ lang: "id", setLang });

/**
 * Menentukan bahasa (pilihan tersimpan → bahasa browser) dan menyimpannya saat diganti.
 * Dipasang di luar provider dompet; isi halaman dirender ulang lewat `LangBoundary`.
 */
export function LangProvider({ children }: { children: ReactNode }) {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // Diperbarui saat render, sebelum anak-anaknya dirender ulang.
  setCurrentLang(lang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

/**
 * Isi halaman dirender ulang dari awal saat bahasa berganti (key = bahasa) supaya semua teks, angka,
 * dan tanggal ikut berganti. Data chain tetap di cache react-query, jadi pergantiannya instan; koneksi
 * dompet tidak terganggu karena provider dompet berada di luar batas ini.
 */
export function LangBoundary({ children }: { children: ReactNode }) {
  const { lang } = useLang();
  return <Fragment key={lang}>{children}</Fragment>;
}

export function useLang() {
  return useContext(LangContext);
}
