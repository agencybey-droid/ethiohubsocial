import React, { useState, useRef } from 'react';
import { CheckCircle2, ThumbsUp } from 'lucide-react';

export interface VideoItem {
  id: number;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  previewUrl?: string;
  duration: string;
  durationSec: number;
  category: string;
  tags: string;
  educatorId: string;
  educatorName: string;
  educatorAvatar?: string;
  views: number;
  likes: number;
  dislikes: number;
  accessLevel: string;
  isEncrypted: boolean;
  encryptionAlgorithm?: string;
  encryptionKeyId?: string;
  encryptionHash?: string;
  isPeerReviewed: boolean;
  isApproved: boolean;
  isRemoved: boolean;
  flaggedCount: number;
  isShort?: boolean;
  isSupabaseStored?: boolean;
  supabasePath?: string;
  supabaseBucket?: string;
  supabaseUrl?: string;
  videoData?: string;
  mimeType?: string;
  fileSize?: number;
  createdAt: string;
}

interface VideoCardProps {
  video: VideoItem;
  onSelect: (video: VideoItem) => void;
}

export const VideoCard: React.FC<VideoCardProps> = ({ video, onSelect }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [scrubPercent, setScrubPercent] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percent = Math.round((x / rect.width) * 100);
    setScrubPercent(percent);
  };

  const scrubSeconds = Math.round((video.durationSec * scrubPercent) / 100);
  const scrubMins = Math.floor(scrubSeconds / 60);
  const scrubSecs = scrubSeconds % 60;
  const scrubTimeFormatted = `${scrubMins.toString().padStart(2, '0')}:${scrubSecs.toString().padStart(2, '0')}`;

  const totalVotes = (video.likes || 0) + (video.dislikes || 0);
  const likeRatio = totalVotes > 0 ? Math.round((video.likes / totalVotes) * 100) : 98;

  const formatViews = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <div
      onClick={() => onSelect(video)}
      className="group flex flex-col bg-neutral-900/60 hover:bg-neutral-900 border border-neutral-800/80 hover:border-neutral-700/80 rounded-xl overflow-hidden transition-all duration-200 cursor-pointer hover:shadow-xl hover:shadow-black/70"
    >
      {/* Thumbnail with Hover Scrubber */}
      <div
        ref={containerRef}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          setScrubPercent(0);
        }}
        onMouseMove={handleMouseMove}
        className="relative aspect-video w-full bg-neutral-950 overflow-hidden"
      >
        <img
          src={isHovered && video.previewUrl ? video.previewUrl : video.thumbnailUrl}
          alt={video.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />

        {/* Hover Scrubber Line & Time Tooltip */}
        {isHovered && (
          <div className="absolute inset-0 bg-black/25 flex flex-col justify-between pointer-events-none">
            <div className="p-2 flex justify-between items-start">
              <span className="bg-black/90 text-amber-400 font-mono text-[11px] px-1.5 py-0.5 rounded font-bold">
                {scrubTimeFormatted}
              </span>
              <span className="bg-black/80 text-white font-mono text-[10px] px-1.5 py-0.5 rounded font-bold">
                HD
              </span>
            </div>

            {/* Bottom Scrubber Progress Bar */}
            <div className="w-full h-1 bg-neutral-800/80">
              <div
                className="h-full bg-[#ff9000] transition-all duration-75"
                style={{ width: `${scrubPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Duration Badge */}
        {!isHovered && (
          <>
            <div className="absolute top-2 right-2 bg-black/80 text-neutral-300 font-mono text-[10px] px-1.5 py-0.5 rounded font-bold">
              HD
            </div>
            <div className="absolute bottom-2 right-2 bg-black/90 text-white font-mono text-[11px] px-1.5 py-0.5 rounded font-semibold tracking-tight">
              {video.duration}
            </div>
          </>
        )}
      </div>

      {/* Video Metadata Content */}
      <div className="p-3 flex items-start gap-3 flex-1">
        {video.educatorAvatar && (
          <img
            src={video.educatorAvatar}
            alt={video.educatorName}
            className="w-8 h-8 rounded-full object-cover shrink-0 mt-0.5 border border-neutral-700"
          />
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-semibold text-neutral-100 group-hover:text-amber-400 line-clamp-2 leading-snug transition-colors">
            {video.title}
          </h3>

          <div className="flex items-center gap-1 text-[11px] text-neutral-400 mt-1 truncate">
            <span className="truncate hover:text-neutral-200">{video.educatorName}</span>
            <span title="Verified Creator" className="inline-flex items-center">
              <CheckCircle2 className="w-3 h-3 text-amber-500 shrink-0" />
            </span>
          </div>

          {/* Clean unboxed metadata with dot separators */}
          <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-1">
            <span>{formatViews(video.views)} views</span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <ThumbsUp className="w-2.5 h-2.5" /> {likeRatio}%
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-neutral-400 truncate">{video.category}</span>
          </div>

          {/* Discreet ratio bar */}
          <div className="mt-2 w-full bg-neutral-800 h-1 rounded-full overflow-hidden">
            <div className="bg-[#ff9000] h-full" style={{ width: `${likeRatio}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
};
