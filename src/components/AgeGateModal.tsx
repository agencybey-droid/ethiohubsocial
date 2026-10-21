import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';

export const AgeGateModal: React.FC = () => {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const verified = localStorage.getItem('ethiohub_age_confirmed');
    if (!verified) {
      setIsOpen(true);
    }
  }, []);

  const handleConfirm = () => {
    localStorage.setItem('ethiohub_age_confirmed', 'true');
    setIsOpen(false);
  };

  const handleDecline = () => {
    window.location.href = 'https://www.google.com';
  };

  if (!isOpen) return null;

  const isAmharic = language === 'am';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
      <div className="bg-[#121215] border border-neutral-800 rounded-lg max-w-md w-full p-6 shadow-2xl text-center space-y-4">
        {/* Header: Logo and Clean Language Switcher */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-1 select-none">
            <span className="text-xl font-black tracking-tight text-white">ethio</span>
            <span className="bg-[#ff9000] text-black font-black text-xl px-1.5 py-0.2 rounded tracking-tight">
              hub
            </span>
          </div>

          <div className="flex items-center bg-[#1c1c22] border border-neutral-700/60 rounded p-0.5 text-xs font-semibold">
            <button
              onClick={() => setLanguage('en')}
              className={`px-2 py-0.5 rounded transition-all duration-150 active:scale-95 cursor-pointer ${
                language === 'en' ? 'bg-[#ff9000] text-black font-bold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage('am')}
              className={`px-2 py-0.5 rounded transition-all duration-150 active:scale-95 cursor-pointer ${
                language === 'am' ? 'bg-[#ff9000] text-black font-bold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              አማ
            </button>
          </div>
        </div>

        {/* Notice Content */}
        <div className="space-y-2 pt-1 text-left">
          <h2 className="text-base font-bold text-white tracking-tight">
            {isAmharic ? 'የዕድሜ ማረጋገጫ (18+)' : 'Age Verification (18+)'}
          </h2>
          <p className="text-xs text-neutral-300 leading-relaxed">
            {isAmharic
              ? 'ይህ ድረ-ገጽ የዕድሜ ገደብ ያለባቸውን የቪዲዮ ይዘቶች ይዟል። ወደዚህ ድረ-ገጽ በመግባት እድሜዎ 18 ዓመት ወይም ከዚያ በላይ መሆኑን እና የአገልግሎት ውሎችን እንደሚቀበሉ ያረጋግጣሉ።'
              : 'This website contains age-restricted video content. By entering, you confirm that you are at least 18 years of age or the age of legal majority in your jurisdiction, and agree to the Terms of Service.'}
          </p>
        </div>

        {/* Buttons with consistent tactile hover and click effects */}
        <div className="pt-2 flex flex-col sm:flex-row gap-2">
          <button
            onClick={handleConfirm}
            className="flex-1 py-2.5 px-4 rounded-md bg-[#ff9000] hover:bg-[#ffa31a] active:bg-[#e68200] active:scale-[0.98] text-black font-bold text-xs uppercase tracking-wide transition-all duration-150 cursor-pointer shadow-sm"
          >
            {isAmharic ? 'እድሜዬ 18+ ነው · ግባ' : 'I am 18 or older · Enter'}
          </button>
          <button
            onClick={handleDecline}
            className="sm:w-28 py-2.5 px-3 rounded-md bg-[#1f1f26] hover:bg-[#282832] active:bg-[#18181d] active:scale-[0.98] border border-neutral-700/80 text-neutral-300 hover:text-white font-medium text-xs transition-all duration-150 cursor-pointer"
          >
            {isAmharic ? 'ውጣ' : 'Exit'}
          </button>
        </div>
      </div>
    </div>
  );
};
