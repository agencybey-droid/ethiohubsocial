import React, { useState, useRef, useEffect } from 'react';
import { VideoItem } from './VideoCard.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useNotifications } from '../context/NotificationContext.tsx';
import { useLanguage } from '../context/LanguageContext.tsx';
import {
  X,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Share2,
  Volume2,
  VolumeX,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  Send,
  Play,
  Pause,
} from 'lucide-react';

interface ReelPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  shorts: VideoItem[];
  initialIndex: number;
  onVote: (shortId: number, type: 'like' | 'dislike') => void;
}

export const ReelPlayerModal: React.FC<ReelPlayerModalProps> = ({
  isOpen,
  onClose,
  shorts,
  initialIndex,
  onVote,
}) => {
  const { user } = useAuth();
  const { triggerRealtimeNotification } = useNotifications();
  const { language } = useLanguage();

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentsList, setCommentsList] = useState<{ id: number; userName: string; content: string }[]>([]);
  const [newComment, setNewComment] = useState('');
  const [likesMap, setLikesMap] = useState<{ [id: number]: number }>({});
  const [userVoteMap, setUserVoteMap] = useState<{ [id: number]: 'like' | 'dislike' | null }>({});

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  const currentShort = shorts[currentIndex];

  useEffect(() => {
    if (currentShort && !likesMap[currentShort.id]) {
      setLikesMap((prev) => ({ ...prev, [currentShort.id]: currentShort.likes || 1200 }));
    }
  }, [currentShort]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [currentIndex]);

  // Keyboard navigation (Escape, Up, Down)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowUp') handlePrev();
      if (e.key === 'ArrowDown') handleNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, shorts.length]);

  if (!isOpen || !currentShort) return null;

  const handleNext = () => {
    if (currentIndex < shorts.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setCurrentIndex(0); // loop
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    } else {
      setCurrentIndex(shorts.length - 1);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const handleLike = () => {
    if (!user) {
      alert('Please sign in to like reels.');
      return;
    }
    const curVote = userVoteMap[currentShort.id];
    const curLikes = likesMap[currentShort.id] || currentShort.likes || 0;

    if (curVote === 'like') {
      setUserVoteMap((prev) => ({ ...prev, [currentShort.id]: null }));
      setLikesMap((prev) => ({ ...prev, [currentShort.id]: curLikes - 1 }));
    } else {
      setUserVoteMap((prev) => ({ ...prev, [currentShort.id]: 'like' }));
      setLikesMap((prev) => ({ ...prev, [currentShort.id]: curLikes + 1 }));
      onVote(currentShort.id, 'like');
    }
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const added = {
      id: Date.now(),
      userName: user?.displayName || 'User',
      content: newComment,
    };
    setCommentsList((prev) => [added, ...prev]);
    setNewComment('');
    triggerRealtimeNotification('Comment Added', `Added to Reel "${currentShort.title}"`, 'interaction');
  };

  const isAmharic = language === 'am';
  const currentLikes = likesMap[currentShort.id] || currentShort.likes || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-2 sm:p-4">
      {/* Close button top right */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 p-2.5 rounded-full bg-neutral-900/80 hover:bg-neutral-800 text-white transition-colors cursor-pointer"
        title="Close (Esc)"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Main Container */}
      <div className="relative flex items-center justify-center max-w-sm sm:max-w-md w-full h-[90vh] sm:h-[85vh]">
        {/* Navigation arrows (desktop) */}
        <div className="hidden sm:flex flex-col gap-3 absolute -right-16 top-1/2 -translate-y-1/2 z-40">
          <button
            onClick={handlePrev}
            className="p-3 rounded-full bg-[#18181d] hover:bg-[#25252e] active:scale-90 text-white border border-neutral-700/80 transition-all cursor-pointer shadow-lg"
            title="Previous (Arrow Up)"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
          <button
            onClick={handleNext}
            className="p-3 rounded-full bg-[#18181d] hover:bg-[#25252e] active:scale-90 text-white border border-neutral-700/80 transition-all cursor-pointer shadow-lg"
            title="Next (Arrow Down)"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>

        {/* Video Card (9:16) */}
        <div className="relative w-full h-full bg-black rounded-2xl overflow-hidden border border-neutral-800 shadow-2xl flex items-center justify-center select-none">
          <video
            ref={videoRef}
            src={currentShort.videoUrl}
            poster={currentShort.thumbnailUrl}
            loop
            muted={isMuted}
            playsInline
            onClick={togglePlay}
            className="w-full h-full object-cover cursor-pointer"
          />

          {/* Pause overlay icon */}
          {!isPlaying && (
            <div
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer pointer-events-auto"
            >
              <div className="p-4 rounded-full bg-black/60 text-white">
                <Play className="w-10 h-10 fill-white" />
              </div>
            </div>
          )}

          {/* Right Action Rail (TikTok/Reels style) */}
          <div className="absolute right-3 bottom-16 flex flex-col items-center gap-4 z-30">
            {/* Like */}
            <div className="flex flex-col items-center">
              <button
                onClick={handleLike}
                className={`p-3 rounded-full transition-all active:scale-90 cursor-pointer shadow-md ${
                  userVoteMap[currentShort.id] === 'like'
                    ? 'bg-[#ff9000] text-black font-bold'
                    : 'bg-black/60 hover:bg-black/80 text-white'
                }`}
              >
                <ThumbsUp className="w-5 h-5" />
              </button>
              <span className="text-[11px] font-bold text-white mt-1 shadow-black drop-shadow">
                {currentLikes > 999 ? `${(currentLikes / 1000).toFixed(1)}k` : currentLikes}
              </span>
            </div>

            {/* Comments Toggle */}
            <div className="flex flex-col items-center">
              <button
                onClick={() => setShowComments(!showComments)}
                className={`p-3 rounded-full transition-all active:scale-90 cursor-pointer shadow-md ${
                  showComments ? 'bg-[#ff9000] text-black font-bold' : 'bg-black/60 hover:bg-black/80 text-white'
                }`}
              >
                <MessageSquare className="w-5 h-5" />
              </button>
              <span className="text-[11px] font-bold text-white mt-1 shadow-black drop-shadow">
                {commentsList.length}
              </span>
            </div>

            {/* Mute / Unmute */}
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-3 rounded-full bg-black/60 hover:bg-black/80 text-white transition-all active:scale-90 cursor-pointer shadow-md"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5 text-white" />}
            </button>
          </div>

          {/* Bottom Gradient & Info Overlay */}
          <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-16 z-20 pointer-events-none">
            <div className="pointer-events-auto space-y-2">
              <div className="flex items-center gap-2">
                {currentShort.educatorAvatar && (
                  <img
                    src={currentShort.educatorAvatar}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover border border-amber-500/80"
                  />
                )}
                <span className="text-xs font-bold text-white flex items-center gap-1">
                  {currentShort.educatorName}
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" />
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#ff9000] text-black font-bold">
                  SHORT
                </span>
              </div>

              <h3 className="text-xs sm:text-sm font-semibold text-white line-clamp-2 leading-snug drop-shadow">
                {currentShort.title}
              </h3>

              <div className="flex items-center gap-2 text-[11px] text-neutral-300">
                <span>{currentShort.views.toLocaleString()} {isAmharic ? 'እይታዎች' : 'views'}</span>
                <span>·</span>
                <span className="text-amber-400 font-mono">#{currentShort.category}</span>
              </div>
            </div>
          </div>

          {/* Comments Drawer Overlay */}
          {showComments && (
            <div className="absolute inset-x-0 bottom-0 h-3/5 bg-[#121216]/95 border-t border-neutral-800 rounded-t-2xl p-4 z-40 flex flex-col justify-between backdrop-blur-md animate-in slide-in-from-bottom duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                <span className="text-xs font-bold text-white">
                  {isAmharic ? 'አስተያየቶች' : 'Reel Comments'} ({commentsList.length})
                </span>
                <button
                  onClick={() => setShowComments(false)}
                  className="text-neutral-400 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Comments list */}
              <div className="flex-1 overflow-y-auto py-2 space-y-2 text-xs">
                {commentsList.length === 0 ? (
                  <p className="text-center text-neutral-500 py-6">
                    {isAmharic ? 'የመጀመሪያው አስተያየት ሰጪ ይሁኑ!' : 'No comments yet. Be the first to comment!'}
                  </p>
                ) : (
                  commentsList.map((c) => (
                    <div key={c.id} className="p-2 bg-neutral-900/60 rounded-lg border border-neutral-800">
                      <p className="font-semibold text-white text-[11px]">{c.userName}</p>
                      <p className="text-neutral-300 text-xs mt-0.5">{c.content}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Form */}
              <form onSubmit={handlePostComment} className="flex gap-2 pt-2 border-t border-neutral-800">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={isAmharic ? 'አስተያየት ይጻፉ...' : 'Add comment...'}
                  className="flex-1 bg-neutral-900 border border-neutral-700/80 rounded-md px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  disabled={!newComment.trim()}
                  className="px-3 py-1.5 rounded-md bg-[#ff9000] text-black font-bold text-xs disabled:opacity-40 active:scale-95 transition-all cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
