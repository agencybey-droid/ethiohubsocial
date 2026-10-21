import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useNotifications } from '../context/NotificationContext.tsx';
import { useLanguage } from '../context/LanguageContext.tsx';
import { X, Sparkles, AlertCircle, PlusCircle, Film } from 'lucide-react';

interface PostShortModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SHORT_PRESETS = [
  {
    name: 'Ethiopian Coffee Roasting Ceremony (35s)',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80',
    duration: '0:35',
    durationSec: 35,
    category: 'Culture',
  },
  {
    name: 'Ancient Lalibela Monolithic Rock Architecture (30s)',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop&q=80',
    duration: '0:30',
    durationSec: 30,
    category: 'History',
  },
  {
    name: 'Simien Mountains Gelada Baboon Playtime (28s)',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=600&auto=format&fit=crop&q=80',
    duration: '0:28',
    durationSec: 28,
    category: 'Nature & Wildlife',
  },
  {
    name: 'Python One-Liner Matrix Vectorization (45s)',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
    duration: '0:45',
    durationSec: 45,
    category: 'Technology',
  },
];

export const PostShortModal: React.FC<PostShortModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  const { triggerRealtimeNotification } = useNotifications();
  const { language } = useLanguage();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Culture');
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [customVideoUrl, setCustomVideoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isAmharic = language === 'am';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError(isAmharic ? 'እባክዎ የቪዲዮውን ርዕስ ያስገቡ' : 'Please provide a title for your short reel.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const preset = SHORT_PRESETS[selectedPreset];
    let finalVideoUrl = customVideoUrl.trim() || preset.videoUrl;
    let finalThumb = preset.thumbnailUrl;

    try {
      const res = await fetch('/api/videos/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: `Short reel: ${title.trim()}`,
          videoUrl: finalVideoUrl,
          thumbnailUrl: finalThumb,
          previewUrl: finalThumb,
          duration: preset.duration,
          durationSec: preset.durationSec,
          category,
          tags: JSON.stringify(['Shorts', category, 'Reel']),
          educatorId: user?.uid || 'user-creator-1',
          educatorName: user?.displayName || 'Creator',
          educatorAvatar: user?.avatarUrl,
          accessLevel: 'public',
          isEncrypted: false,
          isShort: true,
        }),
      });

      if (res.ok) {
        triggerRealtimeNotification(
          isAmharic ? 'አጭር ቪዲዮ በተሳካ ሁኔታ ተለጥፏል' : 'Short Reel Published!',
          `"${title}" ${isAmharic ? 'በአጫጭር ቪዲዮዎች ክፍል ውስጥ ተለጥፏል' : 'is now live in the Shorts section!'}`,
          'upload'
        );
        onSuccess();
        onClose();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to post reel');
      }
    } catch (err: any) {
      setError(err.message || 'Network error while posting reel');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
      <div className="bg-[#121216] border border-neutral-800 rounded-xl max-w-md w-full p-6 shadow-2xl relative text-neutral-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1 rounded transition-colors active:scale-95"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2.5 border-b border-neutral-800 pb-3 mb-4">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              {isAmharic ? 'አጭር ቪዲዮ ይለጥፉ' : 'Post a Short Reel'}
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#ff9000] text-black font-bold">
                REELS
              </span>
            </h3>
            <p className="text-xs text-neutral-400">
              {isAmharic ? 'ከ15 እስከ 60 ሰከንድ ርዝመት ያለው አጭር ቪዲዮ ያጋሩ' : 'Share a 15-60 second vertical video with the community'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-3 p-2.5 bg-red-950/60 border border-red-800/80 rounded-lg text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-neutral-300 font-semibold mb-1">
              {isAmharic ? 'የአጭር ቪዲዮው ርዕስ' : 'Reel Title'}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isAmharic ? 'ለምሳሌ፡ የቡና አፈላል በ30 ሰከንድ...' : 'e.g., Quick 30-second Ethiopian coffee tip...'}
              required
              className="w-full bg-[#18181d] border border-neutral-800 rounded-lg p-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-neutral-300 font-semibold mb-1">
              {isAmharic ? 'ምድብ' : 'Category'}
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-[#18181d] border border-neutral-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
            >
              <option value="Culture">Culture</option>
              <option value="History">History</option>
              <option value="Technology">Technology</option>
              <option value="Nature & Wildlife">Nature & Wildlife</option>
              <option value="Music & Arts">Music & Arts</option>
            </select>
          </div>

          {/* Preset Selection for quick instant testing */}
          <div>
            <label className="block text-neutral-300 font-semibold mb-1">
              {isAmharic ? 'ቪዲዮ ይምረጡ' : 'Select Clip Preset'}
            </label>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {SHORT_PRESETS.map((p, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setSelectedPreset(idx);
                    if (!title) setTitle(p.name);
                  }}
                  className={`p-2 rounded-lg border flex items-center justify-between cursor-pointer transition-all active:scale-[0.98] ${
                    selectedPreset === idx
                      ? 'bg-amber-500/10 border-amber-500 text-white'
                      : 'bg-[#18181d] border-neutral-800 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <img src={p.thumbnailUrl} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                    <span className="truncate text-xs font-medium">{p.name}</span>
                  </div>
                  <span className="text-[10px] font-mono text-amber-400 font-bold shrink-0 ml-2">
                    {p.duration}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 font-medium rounded-md bg-[#18181d] hover:bg-[#202026] text-neutral-400 hover:text-white transition-all active:scale-95"
            >
              {isAmharic ? 'ሰርዝ' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className="px-4 py-2 font-bold rounded-md bg-[#ff9000] hover:bg-[#ffa31a] active:bg-[#e68200] active:scale-[0.98] text-black disabled:opacity-40 transition-all cursor-pointer shadow-sm"
            >
              {submitting
                ? (isAmharic ? 'በመለጠፍ ላይ...' : 'Posting Reel...')
                : (isAmharic ? 'አሁን ለጥፍ' : 'Post Reel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
