import React, { createContext, useContext, useState, useEffect } from 'react';
import en from '../locales/en.json';
import hi from '../locales/hi.json';
import ta from '../locales/ta.json';

const translations = { en, hi, ta };

const LanguageContext = createContext();

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState('en');

  useEffect(() => {
    const saved = localStorage.getItem('rr_lang');
    if (saved && translations[saved]) {
      setLang(saved);
    } else {
      const browserLang = navigator.language.slice(0, 2);
      if (translations[browserLang]) {
        setLang(browserLang);
      }
    }
  }, []);

  const changeLanguage = (newLang) => {
    if (translations[newLang]) {
      setLang(newLang);
      localStorage.setItem('rr_lang', newLang);
    }
  };

  const t = (keyStr) => {
    const keys = keyStr.split('.');
    let current = translations[lang];
    for (let k of keys) {
      if (current[k] === undefined) {
        // Fallback to English if translation is missing
        let fallback = translations['en'];
        for (let fk of keys) {
          if (fallback[fk] === undefined) return keyStr;
          fallback = fallback[fk];
        }
        return fallback;
      }
      current = current[k];
    }
    return current;
  };

  return (
    <LanguageContext.Provider value={{ lang, changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
