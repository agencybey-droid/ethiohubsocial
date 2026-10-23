import React, { useState } from 'react';
import { VideoItem } from './VideoCard.tsx';
import { useLanguage } from '../context/LanguageContext.tsx';
import { Play, Flame, Sparkles } from 'lucide-react';

interface ShortsSectionProps {
  shorts: VideoItem[];
  onSelectShort: (short: VideoItem, index: number) => void;
  onOpenPostShort?: () => void;
}

export const ShortsSection: React.FC<ShortsSectionProps> = ({
  shorts,
  onSelectShort,
}) => {
  const { language } = useLanguage();
  const isAmharic = language === 'am';

  if (shorts.length === 0) return null;

  return (
    <div className="py-4 my-2 border-y border-neutral-800/80 bg-[#0d0d10]/40 -mx-4 px-4 sm:mx-0 sm:px-4 sm:rounded-xl">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-red-500/10 text-red-500">
            <Flame className="w-5 h-5 fill-red-500" />
          </div>
          <div>
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <span>{isAmharic ? 'አጫጭር ቪዲዮዎች' : 'Shorts & Reels'}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#ff9000] text-black font-bold">
                NEW
              </span>
            </h2>
          </div>
        </div>
      </div>

      {/* Horizontal Carousel of Vertical Shorts */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
        {shorts.map((short, index) => (
          <div
            key={short.id}
            onClick={() => onSelectShort(short, index)}
            className="group relative flex-shrink-0 w-36 sm:w-44 aspect-[9/15] rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800/80 hover:border-neutral-600 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-black/80 hover:scale-[1.02]"
          >
            {/* Thumbnail */}
            <img
              src={short.thumbnailUrl}
              alt={short.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />

            {/* Play overlay on hover */}
            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
              <div className="p-2.5 rounded-full bg-black/60 text-[#ff9000] shadow-lg">
                <Play className="w-6 h-6 fill-[#ff9000]" />
              </div>
            </div>

            {/* Top Right Duration */}
            <div className="absolute top-2 right-2 bg-black/80 text-white font-mono text-[10px] px-1.5 py-0.5 rounded font-bold">
              {short.duration}
            </div>

            {/* Bottom Gradient & Info */}
            <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/95 via-black/60 to-transparent pt-8 space-y-1">
              <h4 className="text-xs font-bold text-white line-clamp-2 leading-snug group-hover:text-amber-400 transition-colors">
                {short.title}
              </h4>
              <div className="flex items-center justify-between text-[10px] text-neutral-400">
                <span className="truncate max-w-[80px]">{short.educatorName}</span>
                <span className="font-semibold text-neutral-300">
                  {short.views > 999999
                    ? `${(short.views / 1000000).toFixed(1)}M`
                    : short.views > 999
                    ? `${(short.views / 1000).toFixed(0)}K`
                    : short.views}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
