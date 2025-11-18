


import React, { useState } from 'react';
import { AppSettings, Language, Direction, UserRole } from './types';
import { storageService, authService } from './services/index';
import { translations, ICONS } from './constants';
import DriverApp from './components/DriverApp';
import ClientApp from './components/ClientApp';
import AdminDashboard from './components/AdminDashboard';
import { AuthContext, useAuth } from './contexts/AuthContext';
import { LocalizationContext, useLocalization } from './contexts/LocalizationContext';
import { SettingsContext, useSettings } from './contexts/SettingsContext';


declare const L: any; 

// --- Splash Screen Component ---
const SplashScreen: React.FC<{ isVisible: boolean }> = ({ isVisible }) => {
    const { t } = useLocalization();
    const TruckIcon = ICONS['truck'];
    return (
        <div className={`fixed inset-0 bg-slate-100 dark:bg-gray-900 z-[9999] flex flex-col items-center justify-center overflow-hidden transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
            <div className="animate-[drive-across-splash_2.5s_ease-in-out_1]">
                 <TruckIcon className="w-24 h-24 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-4xl font-bold mt-4 text-slate-700 dark:text-slate-200 animate-[fade-in-splash-text_2.5s_ease-out_1]">
                {t('appTitle')}
            </h1>
        </div>
    );
};

// --- MAIN APP COMPONENT (NOW THE ROUTER) ---
const App: React.FC = () => {
    const [isAuthenticated, setIsAuthenticated] = React.useState(authService.isAuthenticated());
    const [settings, setSettings] = React.useState<AppSettings>(storageService.loadSettings());
    const [isSplashMounted, setIsSplashMounted] = React.useState(true);
    const [isSplashVisible, setIsSplashVisible] = React.useState(true);
    const [authView, setAuthView] = React.useState<'welcome' | 'login' | 'signup'>('welcome');
    const [userRole, setUserRole] = React.useState<UserRole>('client');

    // Settings Modal State (Managed here to be accessible globally via context if needed, or passed down)
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

    React.useEffect(() => {
        const fadeTimer = setTimeout(() => setIsSplashVisible(false), 2500);
        const unmountTimer = setTimeout(() => setIsSplashMounted(false), 3000);
        return () => {
            clearTimeout(fadeTimer);
            clearTimeout(unmountTimer);
        };
    }, []);

    React.useEffect(() => {
        if (settings) {
            document.documentElement.classList.toggle('dark', settings.isDarkMode);
            document.documentElement.lang = settings.language;
            document.documentElement.dir = settings.language === 'ar' ? 'rtl' : 'ltr';
        }
    }, [settings]);

    const handleUpdateSettings = React.useCallback((newSettings: Partial<AppSettings>) => {
        setSettings(prev => {
            const updated = { ...prev, ...newSettings };
            storageService.saveSettings(updated);
            return updated;
        });
    }, []);

    const t = React.useCallback((key: string): string => {
        if (!settings || !key) return key;
        return translations[settings.language][key as keyof typeof translations.en] || key;
    }, [settings]);

    const translateOrShowOriginal = React.useCallback((key: string): string => {
        if (!settings || !key) return key;
        const translated = translations[settings.language][key as keyof typeof translations.en];
        return translated || key;
    }, [settings]);

    const localizationContextValue = React.useMemo(() => ({
        t,
        translateOrShowOriginal,
        language: settings?.language || 'ar',
        direction: (settings?.language === 'ar' ? 'rtl' : 'ltr') as Direction,
        setLanguage: (lang: Language) => handleUpdateSettings({ language: lang }),
    }), [t, translateOrShowOriginal, settings?.language, handleUpdateSettings]);
    
    const authContextValue = React.useMemo(() => ({
        isAuthenticated,
        login: async () => {
            await authService.login();
            setIsAuthenticated(true);
        },
        logout: () => {
            authService.logout();
            setIsAuthenticated(false);
            setAuthView('welcome');
        }
    }), [isAuthenticated]);

    const settingsContextValue = React.useMemo(() => ({
        settings: settings!,
        updateSettings: handleUpdateSettings
    }), [settings, handleUpdateSettings]);
    
    const renderAuthScreens = () => {
        switch (authView) {
            case 'login': return <LoginScreen onSignupClick={() => setAuthView('signup')} onBack={() => setAuthView('welcome')} />;
            case 'signup': return <SignupScreen onLoginClick={() => setAuthView('login')} onBack={() => setAuthView('welcome')} />;
            case 'welcome':
            default: return <WelcomeScreen onLoginClick={() => setAuthView('login')} onSignupClick={() => setAuthView('signup')} />;
        }
    };

    const renderMainApp = () => {
        return (
            <>
                {userRole === 'client' && <ClientApp onSettingsClick={() => setIsSettingsModalOpen(true)} />}
                {userRole === 'driver' && <DriverApp />}
                {userRole === 'admin' && <AdminDashboard />}
                
                {/* Mode Switcher for Demo Purpose */}
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[999] bg-slate-800/90 text-white text-xs px-4 py-2 rounded-full shadow-lg backdrop-blur flex gap-4">
                    <button className={userRole === 'client' ? 'text-blue-400 font-bold' : 'text-white'} onClick={() => setUserRole('client')}>Client</button>
                    <button className={userRole === 'driver' ? 'text-green-400 font-bold' : 'text-white'} onClick={() => setUserRole('driver')}>Driver</button>
                    <button className={userRole === 'admin' ? 'text-purple-400 font-bold' : 'text-white'} onClick={() => setUserRole('admin')}>Admin</button>
                </div>
            </>
        );
    };

    return (
        <AuthContext.Provider value={authContextValue}>
            <LocalizationContext.Provider value={localizationContextValue}>
                <SettingsContext.Provider value={settingsContextValue}>
                    {isSplashMounted && <SplashScreen isVisible={isSplashVisible} />}

                    <div className={`font-sans bg-slate-100 dark:bg-gray-900 text-slate-800 dark:text-slate-200 min-h-screen transition-colors duration-300`}>
                        {isAuthenticated ? renderMainApp() : renderAuthScreens()}
                    </div>

                     {isSettingsModalOpen && <SettingsModal onClose={() => setIsSettingsModalOpen(false)} />}

                </SettingsContext.Provider>
            </LocalizationContext.Provider>
        </AuthContext.Provider>
    );
};


// --- AUTHENTICATION SCREENS ---
const WelcomeScreen: React.FC<{ onLoginClick: () => void; onSignupClick: () => void }> = ({ onLoginClick, onSignupClick }) => {
    const { t } = useLocalization();
    const TruckIcon = ICONS['truck'];
    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
             <TruckIcon className="w-24 h-24 text-blue-600 dark:text-blue-400" />
            <h1 className="text-4xl font-bold mt-4">{t('welcomeTo')} <span className="text-blue-600 dark:text-blue-400">{t('appTitle')}</span></h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 mb-8">{t('bookEasily')}</p>
            <div className="w-full max-w-xs space-y-4">
                <button onClick={onLoginClick} className="w-full bg-blue-600 text-white font-bold py-3 px-8 rounded-full hover:bg-blue-700 transition-transform transform hover:scale-105 shadow-lg">{t('login')}</button>
                <button onClick={onSignupClick} className="w-full bg-slate-200 dark:bg-gray-700 text-slate-800 dark:text-slate-200 font-bold py-3 px-8 rounded-full hover:bg-slate-300 dark:hover:bg-gray-600 transition-transform transform hover:scale-105">{t('signup')}</button>
            </div>
        </div>
    );
};

const AuthForm: React.FC<React.PropsWithChildren<{ title: string; onBack: () => void }>> = ({ title, onBack, children }) => {
    const { direction } = useLocalization();
    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
             <div className="w-full max-w-sm relative">
                <button onClick={onBack} className="absolute -top-12 left-0 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-gray-700">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={direction === 'rtl' ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"} /></svg>
                </button>
                <h1 className="text-3xl font-bold text-center mb-8">{title}</h1>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md">
                    {children}
                </div>
            </div>
        </div>
    );
};

const LoginScreen: React.FC<{ onSignupClick: () => void; onBack: () => void; }> = ({ onSignupClick, onBack }) => {
    const { t } = useLocalization();
    const { login } = useAuth();
    const [isLoading, setIsLoading] = React.useState(false);
    
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        await login();
    };

    return (
        <AuthForm title={t('login')} onBack={onBack}>
            <form onSubmit={handleLogin} className="space-y-4">
                <AuthInput id="email" label={t('email')} type="email" />
                <AuthInput id="password" label={t('password')} type="password" />
                <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 disabled:bg-slate-400">
                    {isLoading ? <Spinner /> : t('login')}
                </button>
                <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                    {t('dontHaveAccount')} <button type="button" onClick={onSignupClick} className="font-semibold text-blue-600 hover:underline">{t('signup')}</button>
                </p>
            </form>
        </AuthForm>
    );
};

const SignupScreen: React.FC<{ onLoginClick: () => void; onBack: () => void; }> = ({ onLoginClick, onBack }) => {
    const { t } = useLocalization();
    const { login: signup } = useAuth(); // Using login as signup for mock
    const [isLoading, setIsLoading] = React.useState(false);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        await signup();
    };

    return (
        <AuthForm title={t('signup')} onBack={onBack}>
            <form onSubmit={handleSignup} className="space-y-4">
                <AuthInput id="fullName" label={t('fullName')} type="text" />
                <AuthInput id="email-signup" label={t('email')} type="email" />
                <AuthInput id="password-signup" label={t('password')} type="password" />
                <AuthInput id="confirmPassword" label={t('confirmPassword')} type="password" />
                <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 disabled:bg-slate-400">
                     {isLoading ? <Spinner /> : t('signup')}
                </button>
                <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                    {t('alreadyHaveAccount')} <button type="button" onClick={onLoginClick} className="font-semibold text-blue-600 hover:underline">{t('login')}</button>
                </p>
            </form>
        </AuthForm>
    );
};

const AuthInput: React.FC<{id: string, label: string, type: string}> = ({id, label, type}) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{label}</label>
        <input id={id} type={type} required className="w-full p-2 border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
    </div>
);
const Spinner: React.FC = () => <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>;

// --- Settings Modal ---
const SettingsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { settings, updateSettings } = useSettings();
    const { t, language, setLanguage } = useLocalization();
    const { logout } = useAuth();

    return (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b border-slate-200 dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-lg font-bold">{t('settings')}</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-gray-700">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </header>
                <div className="p-4 space-y-4">
                    <h3 className="text-sm font-semibold text-slate-500">{t('appearance')}</h3>
                    <SwitchRow label={t('darkMode')} checked={settings.isDarkMode} onChange={isDarkMode => updateSettings({ isDarkMode })}>🌙</SwitchRow>

                    <h3 className="text-sm font-semibold text-slate-500 pt-2">{t('notifications')}</h3>
                    <SwitchRow label={t('enableNotifications')} checked={settings.notificationsEnabled} onChange={notificationsEnabled => updateSettings({ notificationsEnabled })}>🔔</SwitchRow>
                    
                    <h3 className="text-sm font-semibold text-slate-500 pt-2">{t('location')}</h3>
                    <SwitchRow label={t('autoLocation')} checked={settings.autoLocation} onChange={autoLocation => updateSettings({ autoLocation })}>📍</SwitchRow>

                    <h3 className="text-sm font-semibold text-slate-500 pt-2">{t('language')}</h3>
                    <div className="flex items-center gap-2 p-2 bg-slate-100 dark:bg-gray-700 rounded-lg">
                        <button onClick={() => setLanguage('ar')} className={`w-full py-2 rounded-md font-semibold ${language === 'ar' ? 'bg-white dark:bg-gray-800 shadow' : ''}`}>{t('arabic')}</button>
                        <button onClick={() => setLanguage('en')} className={`w-full py-2 rounded-md font-semibold ${language === 'en' ? 'bg-white dark:bg-gray-800 shadow' : ''}`}>{t('english')}</button>
                    </div>

                    <button onClick={logout} className="w-full mt-4 py-3 bg-red-500/10 text-red-600 dark:text-red-400 font-bold rounded-lg hover:bg-red-500/20">{t('logout')}</button>
                </div>
            </div>
        </div>
    );
};

const SwitchRow: React.FC<React.PropsWithChildren<{ label: string; checked: boolean; onChange: (checked: boolean) => void }>> = ({ label, checked, onChange, children }) => {
    return (
        <div className="flex justify-between items-center p-3 bg-slate-100 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center gap-3">
                <span className="text-lg">{children}</span>
                <span className="font-semibold">{label}</span>
            </div>
            <button
                onClick={() => onChange(!checked)}
                className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-300 dark:bg-gray-600'}`}
                role="switch"
                aria-checked={checked}
            >
                <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${checked ? 'translate-x-6 rtl:-translate-x-6' : 'translate-x-1 rtl:-translate-x-1'}`} />
            </button>
        </div>
    );
};

export default App;