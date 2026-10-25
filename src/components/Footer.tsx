import React, { useState } from 'react';
import { Globe, ChevronDown } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.tsx';

interface FooterProps {
  onNavChange: (nav: string) => void;
  onOpenPermissions: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavChange, onOpenPermissions }) => {
  const { language, setLanguage, t } = useLanguage();
  const [showLangMenu, setShowLangMenu] = useState(false);

  const languages: { code: 'en' | 'am'; label: string }[] = [
    { code: 'en', label: 'English' },
    { code: 'am', label: 'አማርኛ (Amharic)' },
  ];

  return (
    <footer className="mt-20 bg-[#0e0e11] border-t border-neutral-800 text-neutral-400 text-xs">
      {/* Top Banner / Identity Row */}
      <div className="max-w-7xl mx-auto px-4 pt-10 pb-6 border-b border-neutral-800/80 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            onClick={() => onNavChange('home')}
            className="flex items-center gap-1 cursor-pointer select-none group"
          >
            <span className="text-2xl font-black tracking-tight text-white group-hover:text-amber-400 transition-colors">
              ethio
            </span>
            <span className="bg-[#ff9000] text-black font-black text-2xl px-2 py-0.5 rounded-md tracking-tight shadow-sm">
              hub
            </span>
          </div>
          <span className="text-neutral-500 hidden sm:inline text-xs border-l border-neutral-800 pl-3">
            {t.tagline}
          </span>
        </div>

        {/* Language Selector */}
        <div className="relative">
          <button
            onClick={() => setShowLangMenu(!showLangMenu)}
            className="flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700/80 text-neutral-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer text-xs"
          >
            <Globe className="w-3.5 h-3.5 text-amber-500" />
            <span>{language === 'am' ? 'አማርኛ' : 'English'}</span>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
          </button>

          {showLangMenu && (
            <div className="absolute right-0 bottom-full mb-1 w-44 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl py-1 z-50">
              {languages.map((item) => (
                <button
                  key={item.code}
                  onClick={() => {
                    setLanguage(item.code);
                    setShowLangMenu(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors cursor-pointer ${
                    language === item.code
                      ? 'bg-[#ff9000] text-black font-bold'
                      : 'text-neutral-300 hover:bg-neutral-800'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Multi-Column Directory */}
      <div className="max-w-7xl mx-auto px-4 py-10 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
        {/* Column 1: Information */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-neutral-200 uppercase tracking-wider">{t.footerInfo}</h4>
          <ul className="space-y-2 text-neutral-400">
            <li>
              <button onClick={() => onNavChange('home')} className="hover:text-amber-400 transition-colors cursor-pointer">
                {t.footerAbout}
              </button>
            </li>
            <li>
              <span className="hover:text-amber-400 transition-colors cursor-pointer">{t.footerPress}</span>
            </li>
            <li>
              <span className="hover:text-amber-400 transition-colors cursor-pointer">{t.footerCareers}</span>
            </li>
          </ul>
        </div>

        {/* Column 2: Creators & Community */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-neutral-200 uppercase tracking-wider">{t.footerCreators}</h4>
          <ul className="space-y-2 text-neutral-400">
            <li>
              <span className="hover:text-amber-400 transition-colors cursor-pointer">{t.footerCreatorProg}</span>
            </li>
            <li>
              <span className="hover:text-amber-400 transition-colors cursor-pointer">{t.footerUploadGuide}</span>
            </li>
            <li>
              <span className="hover:text-amber-400 transition-colors cursor-pointer">
                {t.footerModeration}
              </span>
            </li>
          </ul>
        </div>

        {/* Column 3: Legal & Safety */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-neutral-200 uppercase tracking-wider">{t.footerLegal}</h4>
          <ul className="space-y-2 text-neutral-400">
            <li>
              <span className="hover:text-amber-400 transition-colors cursor-pointer">{t.footerTerms}</span>
            </li>
            <li>
              <span className="hover:text-amber-400 transition-colors cursor-pointer">{t.footerPrivacy}</span>
            </li>
            <li>
              <span className="hover:text-amber-400 transition-colors cursor-pointer">{t.footerDmca}</span>
            </li>
            <li>
              <span className="hover:text-amber-400 transition-colors cursor-pointer">{t.footerChildSafety}</span>
            </li>
          </ul>
        </div>

        {/* Column 4: Discover */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-neutral-200 uppercase tracking-wider">{t.footerDiscover}</h4>
          <ul className="space-y-2 text-neutral-400">
            <li>
              <button onClick={() => onNavChange('trending')} className="hover:text-amber-400 transition-colors cursor-pointer">
                {t.navTrending}
              </button>
            </li>
            <li>
              <button onClick={() => onNavChange('top_rated')} className="hover:text-amber-400 transition-colors cursor-pointer">
                {t.navTopRated}
              </button>
            </li>
            <li>
              <button onClick={() => onNavChange('categories')} className="hover:text-amber-400 transition-colors cursor-pointer">
                {t.navCategories}
              </button>
            </li>
          </ul>
        </div>

        {/* Column 5: Support & Trust */}
        <div className="space-y-3 col-span-2 sm:col-span-1">
          <h4 className="text-xs font-bold text-neutral-200 uppercase tracking-wider">{t.footerSupport}</h4>
          <ul className="space-y-2 text-neutral-400">
            <li>
              <span className="hover:text-amber-400 transition-colors cursor-pointer">{t.footerHelp}</span>
            </li>
            <li>
              <button
                onClick={() => {
                  window.history.pushState({}, '', '/admin');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
                className="hover:text-amber-400 transition-colors cursor-pointer"
              >
                Admin Studio
              </button>
            </li>
          </ul>
        </div>
      </div>

      {/* Compliance Notice Block */}
      <div className="border-t border-neutral-800/80 bg-neutral-950/80 py-6">
        <div className="max-w-7xl mx-auto px-4 space-y-3 text-[11px] text-neutral-500 leading-relaxed">
          <p>{t.footerNotice}</p>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-neutral-900 text-neutral-400">
            <span>© 2026 ethiohub.com. {t.footerRights}</span>
            <div className="flex items-center gap-4">
              <span className="hover:underline cursor-pointer">{t.footerTerms}</span>
              <span>·</span>
              <span className="hover:underline cursor-pointer">{t.footerPrivacy}</span>
              <span>·</span>
              <span className="hover:underline cursor-pointer">{t.footerDmca}</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
