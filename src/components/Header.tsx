import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useNotifications } from '../context/NotificationContext.tsx';
import { useLanguage } from '../context/LanguageContext.tsx';
import {
  Search,
  Upload,
  Bell,
  Shield,
  ShieldAlert,
  LogOut,
  Sparkles,
  Menu,
  X,
  Volume2,
  VolumeX,
} from 'lucide-react';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeNav: string;
  onNavChange: (nav: string) => void;
  onOpenUpload: () => void;
  onOpenPermissions: () => void;
  pendingReportsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  activeNav,
  onNavChange,
  onOpenUpload,
  onOpenPermissions,
  pendingReportsCount,
}) => {
  const { user, signInWithGoogle, signOut } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    pushEnabled,
    enablePushNotifications,
    soundEnabled,
    setSoundEnabled,
  } = useNotifications();

  const [showNotificationDrawer, setShowNotificationDrawer] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getRoleLabel = () => {
    switch (user?.role) {
      case 'admin':
        return 'Admin';
      case 'moderator':
        return 'Moderator';
      case 'educator':
        return 'Creator';
      default:
        return 'Member';
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-neutral-950/95 border-b border-neutral-800/80 backdrop-blur-md">
      {/* Top Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3 sm:gap-4">
        {/* Left: Brand Logo: ethiohub */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-neutral-400 hover:text-white p-1 rounded transition-colors active:scale-95 cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Iconic Logo: ethiohub */}
          <div
            onClick={() => onNavChange('home')}
            className="flex items-center gap-1 cursor-pointer select-none group active:scale-[0.98] transition-transform duration-150"
            title="ethiohub"
          >
            <span className="text-2xl font-black tracking-tight text-white group-hover:text-amber-400 transition-colors">
              ethio
            </span>
            <span className="bg-[#ff9000] text-black font-black text-2xl px-2 py-0.5 rounded tracking-tight shadow-sm">
              hub
            </span>
          </div>
        </div>

        {/* Center: Search Input */}
        <div className="flex-1 max-w-lg hidden sm:block">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full bg-[#141418] border border-neutral-800 focus:border-amber-500 rounded-full py-2 pl-10 pr-9 text-xs text-neutral-100 placeholder-neutral-500 transition-colors focus:outline-none shadow-inner"
            />
            <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white text-xs cursor-pointer active:scale-90 transition-transform"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Right: Language Toggle, Push Bell, Upload, Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Language Switcher */}
          <div className="flex items-center bg-[#17171c] border border-neutral-800 rounded p-0.5 text-xs font-bold">
            <button
              onClick={() => setLanguage('en')}
              className={`px-2 py-1 rounded transition-all duration-150 active:scale-95 cursor-pointer ${
                language === 'en' ? 'bg-[#ff9000] text-black font-bold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage('am')}
              className={`px-2 py-1 rounded transition-all duration-150 active:scale-95 cursor-pointer ${
                language === 'am' ? 'bg-[#ff9000] text-black font-bold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              አማ
            </button>
          </div>

          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotificationDrawer(!showNotificationDrawer)}
              className="relative p-2 rounded-full hover:bg-neutral-900 active:scale-95 text-neutral-300 hover:text-white transition-all duration-150 cursor-pointer"
              title={t.notifications}
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 bg-amber-500 text-black text-[10px] font-mono font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Popover Dropdown */}
            {showNotificationDrawer && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#16161b] border border-neutral-800 rounded-lg shadow-2xl overflow-hidden z-50 text-xs text-neutral-200">
                <div className="p-3 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between">
                  <span className="font-bold text-white">{t.notifications}</span>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      onClick={() => setSoundEnabled(!soundEnabled)}
                      className="text-neutral-400 hover:text-white p-1 rounded cursor-pointer active:scale-90 transition-transform"
                      title={soundEnabled ? 'Mute' : 'Unmute'}
                    >
                      {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-amber-400" /> : <VolumeX className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={markAllAsRead}
                      className="text-amber-400 hover:underline cursor-pointer active:scale-95 transition-transform"
                    >
                      Mark read
                    </button>
                  </div>
                </div>

                {!pushEnabled && (
                  <div className="p-2.5 bg-amber-500/10 border-b border-amber-500/20 text-neutral-300 flex items-center justify-between gap-2">
                    <span className="text-[11px]">Enable push notifications?</span>
                    <button
                      onClick={enablePushNotifications}
                      className="px-2 py-1 bg-[#ff9000] hover:bg-[#ffa31a] active:bg-[#e68200] active:scale-95 text-black font-bold rounded text-[10px] transition-all duration-150 cursor-pointer"
                    >
                      Enable
                    </button>
                  </div>
                )}

                <div className="max-h-80 overflow-y-auto divide-y divide-neutral-800/60">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-neutral-500">
                      <p>No new notifications.</p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => markAsRead(n.id)}
                        className={`p-3 transition-colors cursor-pointer ${
                          !n.isRead ? 'bg-amber-500/5 hover:bg-amber-500/10' : 'hover:bg-neutral-800/40'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white">{n.title}</span>
                          {!n.isRead && <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />}
                        </div>
                        <p className="text-neutral-400 mt-1 line-clamp-2 leading-relaxed text-[11px]">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Upload Button */}
          <button
            onClick={onOpenUpload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#ff9000] hover:bg-[#ffa31a] active:bg-[#e68200] active:scale-[0.98] text-black text-xs font-bold transition-all duration-150 cursor-pointer shadow-sm"
            title={t.upload}
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.upload}</span>
          </button>

          {/* User Profile / Role */}
          <button
            onClick={onOpenPermissions}
            className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-md bg-[#16161b] hover:bg-[#202026] active:bg-[#121216] active:scale-[0.98] border border-neutral-800 transition-all duration-150 cursor-pointer"
            title={t.myAccount}
          >
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                className="w-6 h-6 rounded-full object-cover border border-amber-500/60"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-[#ff9000] text-black font-bold flex items-center justify-center text-[10px]">
                {getRoleLabel()[0]}
              </div>
            )}
            <div className="hidden md:flex flex-col text-left">
              <span className="text-[11px] font-bold text-white truncate max-w-[90px]">
                {user?.displayName || 'User'}
              </span>
              <span className="text-[9px] font-mono text-amber-400 uppercase tracking-tight">
                {getRoleLabel()}
              </span>
            </div>
          </button>

          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="text-neutral-400 hover:text-white p-1 text-xs cursor-pointer active:scale-90 transition-transform"
          >
            ▼
          </button>

          {showUserMenu && (
            <div className="absolute right-4 top-16 w-52 bg-[#16161b] border border-neutral-800 rounded-lg shadow-2xl p-2 z-50 text-xs space-y-1">
              <div className="p-2 border-b border-neutral-800 text-neutral-400">
                <p className="font-semibold text-white truncate">{user?.displayName}</p>
                <p className="text-[10px] truncate">{user?.email}</p>
              </div>

              <button
                onClick={() => {
                  onOpenPermissions();
                  setShowUserMenu(false);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded hover:bg-neutral-800 active:bg-neutral-700 text-neutral-200 flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span>{t.myAccount}</span>
              </button>

              <button
                onClick={() => {
                  signInWithGoogle();
                  setShowUserMenu(false);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded hover:bg-neutral-800 active:bg-neutral-700 text-neutral-200 flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                <span>{t.signIn} (Google)</span>
              </button>

              <button
                onClick={() => {
                  signOut();
                  setShowUserMenu(false);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded hover:bg-neutral-800 active:bg-neutral-700 text-red-400 flex items-center gap-2 cursor-pointer transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{t.signOut}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Secondary Navigation Row: Classic Clean Tabs */}
      <div className="border-t border-neutral-900 bg-neutral-950/70 overflow-x-auto">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 py-1.5 text-xs font-semibold whitespace-nowrap">
          <button
            onClick={() => onNavChange('home')}
            className={`px-3 py-1 rounded transition-all duration-150 active:scale-[0.97] cursor-pointer ${
              activeNav === 'home'
                ? 'bg-neutral-800 text-amber-400 font-bold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            {t.navHome}
          </button>
          <button
            onClick={() => onNavChange('trending')}
            className={`px-3 py-1 rounded transition-all duration-150 active:scale-[0.97] cursor-pointer ${
              activeNav === 'trending'
                ? 'bg-neutral-800 text-amber-400 font-bold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            {t.navTrending}
          </button>
          <button
            onClick={() => onNavChange('top_rated')}
            className={`px-3 py-1 rounded transition-all duration-150 active:scale-[0.97] cursor-pointer ${
              activeNav === 'top_rated'
                ? 'bg-neutral-800 text-amber-400 font-bold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            {t.navTopRated}
          </button>
          <button
            onClick={() => onNavChange('categories')}
            className={`px-3 py-1 rounded transition-all duration-150 active:scale-[0.97] cursor-pointer ${
              activeNav === 'categories'
                ? 'bg-neutral-800 text-amber-400 font-bold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            {t.navCategories}
          </button>

          {/* Moderation Board Link */}
          {/* Admin & Moderation Portal Link */}
          <button
            onClick={() => onNavChange('moderation')}
            className={`ml-auto px-3 py-1 rounded transition-all duration-150 active:scale-[0.97] cursor-pointer flex items-center gap-1.5 ${
              activeNav === 'moderation'
                ? 'bg-[#ff9000] text-black font-bold shadow-sm'
                : 'text-neutral-400 hover:text-amber-400'
            }`}
            title="Admin Portal - Upload videos, manage catalog, review reports"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>{t.navAdmin || 'Admin'}</span>
            {pendingReportsCount > 0 && (
              <span className="px-1.5 py-0.2 bg-red-600 text-white rounded-full text-[10px] font-mono">
                {pendingReportsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="sm:hidden p-3 bg-neutral-900 border-t border-neutral-800">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-md p-2 text-xs text-white"
          />
        </div>
      )}
    </header>
  );
};
