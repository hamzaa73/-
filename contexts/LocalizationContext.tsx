import React from 'react';
import { Language, Direction } from '../types';

interface LocalizationContextType {
  t: (key: string) => string;
  translateOrShowOriginal: (key: string) => string;
  language: Language;
  direction: Direction;
  setLanguage: (lang: Language) => void;
}

export const LocalizationContext = React.createContext<LocalizationContextType | undefined>(undefined);

export const useLocalization = (): LocalizationContextType => {
  const context = React.useContext(LocalizationContext);
  if (!context) throw new Error('useLocalization must be used within a LocalizationProvider');
  return context;
};
