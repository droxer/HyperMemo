import { useRef, useEffect, useState, memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    LogOut,
    PanelRightClose,
    PanelRightOpen,
    Moon,
    Sun,
    Monitor,
    Languages,
    Check,
} from 'lucide-react';
import { useTheme, type ThemeMode } from '@/contexts/ThemeContext';
import { SubscriptionBadge } from '@/components/SubscriptionBadge';
import type { Subscription } from '@/types/subscription';
import type { User } from '@supabase/supabase-js';

export type TabType = 'overview' | 'chat' | 'notes';

const SUPPORTED_LANGUAGES = [
    { code: 'en', label: 'English' },
    { code: 'zh-CN', label: '简体中文' },
    { code: 'zh-TW', label: '繁體中文' },
] as const;

type HeaderProps = {
    user: User;
    activeTab: TabType;
    isChatHistoryOpen: boolean;
    subscription: Subscription | null;
    onTabChange: (tab: TabType) => void;
    onNotesTabClick: () => void;
    onChatHistoryToggle: () => void;
    onSubscriptionClick: () => void;
    onLogout: () => void;
};

export const Header = memo(function Header({
    user,
    activeTab,
    isChatHistoryOpen,
    subscription,
    onTabChange,
    onNotesTabClick,
    onChatHistoryToggle,
    onSubscriptionClick,
    onLogout,
}: HeaderProps) {
    const { t, i18n } = useTranslation();
    const { theme, setTheme, resolvedTheme } = useTheme();
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
    const profileMenuRef = useRef<HTMLDivElement>(null);
    const languageMenuRef = useRef<HTMLDivElement>(null);

    // Close menus when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
                setIsProfileMenuOpen(false);
            }
            if (languageMenuRef.current && !languageMenuRef.current.contains(event.target as Node)) {
                setIsLanguageMenuOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const changeLanguage = (langCode: string) => {
        i18n.changeLanguage(langCode);
        setIsLanguageMenuOpen(false);
    };

    const cycleTheme = () => {
        const modes: ThemeMode[] = ['light', 'dark', 'system'];
        const currentIndex = modes.indexOf(theme);
        const nextIndex = (currentIndex + 1) % modes.length;
        setTheme(modes[nextIndex]);
    };

    return (
        <header className="px-4 md:px-8 border-b border-border flex justify-between items-center bg-bg-main h-14 md:h-16 shrink-0">
            <div className="flex gap-3 md:gap-6 h-full overflow-x-auto">
                <button
                    type="button"
                    className={`flex items-center px-1 text-sm md:text-[0.9375rem] font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'overview' ? 'text-primary border-primary' : 'text-text-secondary border-transparent hover:text-text-primary'}`}
                    onClick={() => onTabChange('overview')}
                >
                    {t('sidebar.bookmarks')}
                </button>
                <button
                    type="button"
                    className={`flex items-center px-1 text-sm md:text-[0.9375rem] font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'chat' ? 'text-primary border-primary' : 'text-text-secondary border-transparent hover:text-text-primary'}`}
                    onClick={() => onTabChange('chat')}
                >
                    {t('sidebar.chat')}
                </button>
                <button
                    type="button"
                    className={`flex items-center gap-2 px-1 text-sm md:text-[0.9375rem] font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'notes' ? 'text-primary border-primary' : 'text-text-secondary border-transparent hover:text-text-primary'}`}
                    onClick={onNotesTabClick}
                >
                    {t('sidebar.notes')}
                    <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{t('header.beta')}</span>
                </button>
            </div>
            <div className="flex items-center">
                {activeTab === 'chat' && (
                    <button
                        type="button"
                        className={`p-2 rounded-md transition-colors mr-2 ${isChatHistoryOpen ? 'text-primary bg-bg-active' : 'text-text-secondary hover:bg-bg-subtle'}`}
                        onClick={onChatHistoryToggle}
                        title={isChatHistoryOpen ? t('header.collapseHistory') : t('header.openHistory')}
                    >
                        {isChatHistoryOpen ? <PanelRightClose className="w-5 h-5" /> : <PanelRightOpen className="w-5 h-5" />}
                    </button>
                )}
                <button
                    type="button"
                    className="p-2 rounded-md transition-colors mr-2 text-text-secondary hover:bg-bg-subtle"
                    onClick={cycleTheme}
                    title={`${t('header.theme')}: ${t(`header.theme${theme.charAt(0).toUpperCase()}${theme.slice(1)}`)}`}
                >
                    {theme === 'system' ? (
                        <Monitor className="w-5 h-5" />
                    ) : resolvedTheme === 'dark' ? (
                        <Moon className="w-5 h-5" />
                    ) : (
                        <Sun className="w-5 h-5" />
                    )}
                </button>
                <div className="relative" ref={languageMenuRef}>
                    <button
                        type="button"
                        className={`p-2 rounded-md transition-colors mr-2 ${isLanguageMenuOpen ? 'text-primary bg-bg-active' : 'text-text-secondary hover:bg-bg-subtle'}`}
                        onClick={() => setIsLanguageMenuOpen(!isLanguageMenuOpen)}
                        title={t('header.language')}
                    >
                        <Languages className="w-5 h-5" />
                    </button>
                    {isLanguageMenuOpen && (
                        <div className="absolute right-0 top-full mt-2 w-40 bg-bg-main border border-border rounded-lg shadow-md z-50 overflow-hidden">
                            {SUPPORTED_LANGUAGES.map((lang) => (
                                <button
                                    key={lang.code}
                                    type="button"
                                    className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm text-text-primary hover:bg-bg-subtle transition-colors"
                                    onClick={() => changeLanguage(lang.code)}
                                >
                                    <span>{lang.label}</span>
                                    {i18n.language === lang.code && (
                                        <Check className="w-4 h-4 text-primary" />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <button
                    type="button"
                    onClick={onSubscriptionClick}
                    className="bg-transparent border-none p-0 cursor-pointer"
                >
                    <SubscriptionBadge subscription={subscription} />
                </button>
                <div className="relative" ref={profileMenuRef}>
                    <button
                        type="button"
                        className="w-9 h-9 rounded-full overflow-hidden border-2 border-border hover:border-primary transition-colors"
                        onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                        title={user.email || t('header.profile')}
                    >
                        {user.user_metadata?.avatar_url || user.user_metadata?.picture ? (
                            <img
                                src={user.user_metadata.avatar_url || user.user_metadata.picture}
                                alt={user.email || 'User'}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full bg-primary text-white flex items-center justify-center text-sm font-medium">
                                {user.email?.charAt(0).toUpperCase() || 'U'}
                            </div>
                        )}
                    </button>
                    {isProfileMenuOpen && (
                        <div className="absolute right-0 top-full mt-2 w-56 bg-bg-main border border-border rounded-lg shadow-md z-50 overflow-hidden">
                            <div className="px-4 py-3 border-b border-border">
                                <div className="text-sm font-medium text-text-primary truncate">{user.email}</div>
                            </div>
                            <button
                                type="button"
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-text-primary hover:bg-bg-subtle transition-colors"
                                onClick={() => {
                                    setIsProfileMenuOpen(false);
                                    onLogout();
                                }}
                            >
                                <LogOut className="w-4 h-4" />
                                {t('app.signOut')}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
});
