import React, { useState, useEffect, useRef } from 'react';
import { VideoItem } from './VideoCard.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useNotifications } from '../context/NotificationContext.tsx';
import { useLanguage } from '../context/LanguageContext.tsx';
import { ReportModal } from './ReportModal.tsx';
import {
  ThumbsUp,
  ThumbsDown,
  Flag,
  Share2,
  CheckCircle2,
  Clock,
  Send,
  Pin,
  MessageSquare,
  ArrowLeft,
  Bookmark,
} from 'lucide-react';

interface CommentItem {
  id: number;
  videoId: number;
  userId: string;
  userName: string;
  userAvatar?: string;
  userRole?: string;
  content: string;
  timestampSec: number;
  likes: number;
  isPinned: boolean;
  createdAt: string;
}

interface VideoPlayerViewProps {
  video: VideoItem;
  onBack: () => void;
  onSelectRelated: (video: VideoItem) => void;
  allVideos: VideoItem[];
}

export const VideoPlayerView: React.FC<VideoPlayerViewProps> = ({
  video,
  onBack,
  onSelectRelated,
  allVideos,
}) => {
  const { user } = useAuth();
  const { triggerRealtimeNotification } = useNotifications();
  const { t } = useLanguage();

  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);

  // Votes
  const [likes, setLikes] = useState(video.likes || 0);
  const [dislikes, setDislikes] = useState(video.dislikes || 0);
  const [userVote, setUserVote] = useState<'like' | 'dislike' | null>(null);

  // Subscribed state
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Comments
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [newComment, setNewComment] = useState('');
  const [attachTimestamp, setAttachTimestamp] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  // Modals
  const [showReportModal, setShowReportModal] = useState(false);

  // Load comments
  const loadComments = async () => {
    try {
      const res = await fetch(`/api/videos/${video.id}/comments`);
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setComments(data);
      }
    } catch (e) {
      console.warn('Failed to fetch comments:', e);
    }
  };

  useEffect(() => {
    loadComments();
    setLikes(video.likes || 0);
    setDislikes(video.dislikes || 0);
  }, [video.id]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTimeSec(Math.floor(videoRef.current.currentTime));
    }
  };

  const jumpToTime = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play();
    }
  };

  const handleVote = async (type: 'like' | 'dislike') => {
    if (!user) {
      alert('Please sign in to vote on videos.');
      return;
    }
    try {
      const res = await fetch(`/api/videos/${video.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, voteType: type }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setUserVote(data.voteType);
        if (data.likes !== undefined) setLikes(data.likes);
        if (data.dislikes !== undefined) setDislikes(data.dislikes);
      } else {
        setUserVote(type);
        if (type === 'like') setLikes((prev) => prev + 1);
        else setDislikes((prev) => prev + 1);
      }
    } catch (e) {
      console.warn('Vote failed:', e);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmittingComment(true);
    try {
      const res = await fetch(`/api/videos/${video.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.uid || 'user-default',
          userName: user?.displayName || 'User',
          userAvatar: user?.avatarUrl,
          userRole: user?.role || 'student',
          content: newComment,
          timestampSec: attachTimestamp ? currentTimeSec : 0,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        setNewComment('');
        setAttachTimestamp(false);
        loadComments();
      } else {
        const localCommentItem: CommentItem = {
          id: Date.now(),
          videoId: video.id,
          userId: user?.uid || 'user-default',
          userName: user?.displayName || 'User',
          userAvatar: user?.avatarUrl || undefined,
          userRole: user?.role || 'student',
          content: newComment,
          timestampSec: attachTimestamp ? currentTimeSec : 0,
          likes: 0,
          isPinned: false,
          createdAt: new Date().toISOString(),
        };
        setComments((prev) => [localCommentItem, ...prev]);
        setNewComment('');
        setAttachTimestamp(false);
      }

      triggerRealtimeNotification(
        'Comment Added',
        `Your comment was added to "${video.title}".`,
        'interaction',
        video.id
      );
    } catch (err) {
      console.warn('Post comment failed:', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const totalVotes = likes + dislikes;
  const likeRatio = totalVotes > 0 ? Math.round((likes / totalVotes) * 100) : 98;

  const related = allVideos.filter((v) => v.id !== video.id).slice(0, 8);

  return (
    <div className="max-w-7xl mx-auto px-4 py-4">
      {/* Back to Videos */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-xs font-semibold text-neutral-400 hover:text-amber-400 mb-3 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" /> {t.backToVideos}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Video & Comments */}
        <div className="lg:col-span-2 space-y-4">
          {/* Cinema Player */}
          <div className="relative aspect-video w-full bg-black rounded-xl overflow-hidden border border-neutral-800 shadow-2xl">
            <video
              ref={videoRef}
              src={video.videoUrl}
              poster={video.thumbnailUrl}
              controls
              autoPlay
              onTimeUpdate={handleTimeUpdate}
              className="w-full h-full object-contain"
            />
          </div>

          {/* Video Title & Actions */}
          <div className="p-4 bg-neutral-900/60 rounded-xl border border-neutral-800/80 space-y-4">
            <h1 className="text-lg sm:text-xl font-bold text-white leading-snug">{video.title}</h1>

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-neutral-400">
                <span className="font-semibold text-neutral-200">{video.views.toLocaleString()} {t.views}</span>
                <span aria-hidden="true">·</span>
                <span>{video.category}</span>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-400 font-semibold">{likeRatio}%</span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {/* Like / Dislike */}
                <div className="flex items-center bg-[#18181d] rounded-md p-0.5 border border-neutral-700/80">
                  <button
                    onClick={() => handleVote('like')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-medium text-xs transition-all duration-150 active:scale-95 cursor-pointer ${
                      userVote === 'like' ? 'bg-[#ff9000] text-black font-bold' : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
                    }`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>{likes.toLocaleString()}</span>
                  </button>
                  <div className="w-[1px] h-4 bg-neutral-700" />
                  <button
                    onClick={() => handleVote('dislike')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-medium text-xs transition-all duration-150 active:scale-95 cursor-pointer ${
                      userVote === 'dislike' ? 'bg-red-500 text-white font-bold' : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
                    }`}
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                    <span>{dislikes.toLocaleString()}</span>
                  </button>
                </div>

                {/* Save */}
                <button
                  onClick={() => {
                    setIsSaved(!isSaved);
                    triggerRealtimeNotification(
                      isSaved ? 'Removed from Saved' : 'Saved to Favorites',
                      isSaved ? 'Video removed from your saved list.' : 'Video added to your saved favorites list.',
                      'interaction'
                    );
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border font-medium transition-all duration-150 active:scale-[0.98] cursor-pointer ${
                    isSaved
                      ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                      : 'bg-[#18181d] hover:bg-[#22222a] border-neutral-700/80 text-neutral-300 hover:text-white'
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{isSaved ? t.saved : t.save}</span>
                </button>

                {/* Report */}
                <button
                  onClick={() => setShowReportModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#18181d] hover:bg-[#22222a] active:scale-[0.98] text-neutral-300 hover:text-white border border-neutral-700/80 font-medium transition-all duration-150 cursor-pointer"
                  title={t.report}
                >
                  <Flag className="w-3.5 h-3.5 text-red-400" />
                  <span className="hidden sm:inline">{t.report}</span>
                </button>
              </div>
            </div>

            {/* Channel Info Row */}
            <div className="pt-4 border-t border-neutral-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {video.educatorAvatar && (
                  <img
                    src={video.educatorAvatar}
                    alt={video.educatorName}
                    className="w-11 h-11 rounded-full object-cover border border-neutral-700"
                  />
                )}
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-white">{video.educatorName}</span>
                    <span title="Verified Channel" className="inline-flex items-center">
                      <CheckCircle2 className="w-4 h-4 text-amber-500" />
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400">142K subscribers</p>
                </div>
              </div>

              <button
                onClick={() => {
                  setIsSubscribed(!isSubscribed);
                  triggerRealtimeNotification(
                    isSubscribed ? 'Unsubscribed' : 'Subscribed to Channel',
                    isSubscribed ? `Unsubscribed from ${video.educatorName}.` : `Subscribed to ${video.educatorName}.`,
                    'interaction'
                  );
                }}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  isSubscribed
                    ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                    : 'bg-[#ff9000] hover:bg-amber-400 text-black'
                }`}
              >
                {isSubscribed ? t.subscribed : t.subscribe}
              </button>
            </div>

            {/* Description */}
            <div className="p-3.5 bg-neutral-950 rounded-lg border border-neutral-800/80 text-xs text-neutral-300 leading-relaxed space-y-2">
              <p>{video.description}</p>
              <div className="flex flex-wrap gap-2 pt-2 text-[11px] text-amber-400">
                {JSON.parse(video.tags || '[]').map((tagItem: string, i: number) => (
                  <span key={i} className="hover:underline cursor-pointer">
                    #{tagItem}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Comments Section */}
          <div className="p-4 bg-neutral-900/60 rounded-xl border border-neutral-800/80 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">{t.comments} ({comments.length})</h3>
              </div>
            </div>

            {/* Post Comment Input */}
            <form onSubmit={handlePostComment} className="space-y-3">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={t.addComment}
                rows={2}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setAttachTimestamp(!attachTimestamp)}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                    attachTimestamp
                      ? 'bg-amber-500/10 border-amber-500/50 text-amber-300 font-semibold'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{t.attachTimestamp} ({formatSeconds(currentTimeSec)})</span>
                </button>

                <button
                  type="submit"
                  disabled={submittingComment || !newComment.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#ff9000] hover:bg-amber-400 text-black font-bold text-xs disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{t.postComment}</span>
                </button>
              </div>
            </form>

            {/* Comments List */}
            <div className="space-y-3 pt-2">
              {comments.map((c) => (
                <div
                  key={c.id}
                  className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                    c.isPinned ? 'bg-amber-500/5 border-amber-500/30' : 'bg-neutral-950/60 border-neutral-800/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {c.userAvatar && (
                        <img
                          src={c.userAvatar}
                          alt={c.userName}
                          className="w-6 h-6 rounded-full object-cover border border-neutral-700"
                        />
                      )}
                      <span className="font-semibold text-neutral-100">{c.userName}</span>
                    </div>
                    {c.isPinned && (
                      <span className="flex items-center gap-1 text-[11px] text-amber-400 font-semibold">
                        <Pin className="w-3 h-3" /> {t.pinned}
                      </span>
                    )}
                  </div>

                  <p className="text-neutral-300 leading-relaxed">{c.content}</p>

                  <div className="flex items-center gap-3 text-[11px] text-neutral-400">
                    {c.timestampSec > 0 && (
                      <button
                        onClick={() => jumpToTime(c.timestampSec)}
                        className="text-amber-400 hover:underline flex items-center gap-1 font-mono cursor-pointer"
                      >
                        <Clock className="w-3 h-3" /> {formatSeconds(c.timestampSec)}
                      </button>
                    )}
                    <span>{c.likes} upvotes</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Related Videos Column */}
        <div className="space-y-4">
          <div className="p-4 bg-neutral-900/60 rounded-xl border border-neutral-800/80">
            <h3 className="text-sm font-bold text-white mb-3">{t.relatedVideos}</h3>
            <div className="space-y-3">
              {related.map((rel) => (
                <div
                  key={rel.id}
                  onClick={() => onSelectRelated(rel)}
                  className="group flex gap-3 p-1.5 rounded-lg hover:bg-neutral-800/60 transition-colors cursor-pointer"
                >
                  <div className="relative w-32 aspect-video rounded-lg overflow-hidden shrink-0 bg-neutral-950">
                    <img src={rel.thumbnailUrl} alt={rel.title} className="w-full h-full object-cover" />
                    <span className="absolute bottom-1 right-1 bg-black/90 text-white font-mono text-[9px] px-1 py-0.2 rounded font-semibold">
                      {rel.duration}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-neutral-200 group-hover:text-amber-400 line-clamp-2 leading-tight">
                      {rel.title}
                    </h4>
                    <p className="text-[11px] text-neutral-400 mt-1 truncate">{rel.educatorName}</p>
                    <p className="text-[10px] text-neutral-500">{rel.views.toLocaleString()} views</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        videoId={video.id}
        videoTitle={video.title}
        currentTimestampSec={currentTimeSec}
      />
    </div>
  );
};
