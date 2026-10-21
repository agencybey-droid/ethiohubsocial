import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useNotifications } from '../context/NotificationContext.tsx';
import { Flag, AlertTriangle, CheckCircle2, X } from 'lucide-react';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoId: number;
  videoTitle: string;
  currentTimestampSec?: number;
}

const REPORT_CATEGORIES = [
  { id: 'academic_dishonesty', label: 'Academic Dishonesty / Plagiarism' },
  { id: 'misleading_facts', label: 'Factually Inaccurate / Unverified Claims' },
  { id: 'copyright_infringement', label: 'Copyright or IP Infringement' },
  { id: 'inappropriate_content', label: 'Inappropriate or Uncensored Graphic Content' },
  { id: 'harassment', label: 'Harassment or Defamatory Language' },
  { id: 'guidelines_violation', label: 'Breach of Community Teaching Standards' },
];

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  videoId,
  videoTitle,
  currentTimestampSec = 0,
}) => {
  const { user } = useAuth();
  const { triggerRealtimeNotification } = useNotifications();
  const [category, setCategory] = useState(REPORT_CATEGORIES[0].id);
  const [details, setDetails] = useState('');
  const [includeTimestamp, setIncludeTimestamp] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const timestampStr = formatTime(currentTimestampSec);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!details.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          videoTitle,
          reportedByUserId: user?.uid || 'anonymous-reporter',
          reportedByEmail: user?.email || 'visitor@eduhub.org',
          category,
          details,
          timestampMark: includeTimestamp ? timestampStr : null,
        }),
      });

      if (res.ok) {
        setSuccess(true);
        triggerRealtimeNotification(
          'Moderation Report Filed',
          `Your report on "${videoTitle}" has been logged for academic review.`,
          'moderation',
          videoId
        );
        setTimeout(() => {
          setSuccess(false);
          setDetails('');
          onClose();
        }, 1800);
      }
    } catch (err) {
      console.error('Failed to submit report:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative text-neutral-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {success ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white">Report Successfully Submitted</h3>
            <p className="text-xs text-neutral-400 mt-1 max-w-xs mx-auto">
              Our Academic Moderation Board will inspect the flagged timestamp and review the video against community guidelines.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center gap-3 border-b border-neutral-800 pb-3">
              <div className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
                <Flag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Report Educational Content</h3>
                <p className="text-xs text-neutral-400 truncate max-w-xs">{videoTitle}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                Community Guideline Violation Category
              </label>
              <div className="space-y-1.5">
                {REPORT_CATEGORIES.map((cat) => (
                  <label
                    key={cat.id}
                    className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                      category === cat.id
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                        : 'bg-neutral-950/60 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="report_cat"
                      value={cat.id}
                      checked={category === cat.id}
                      onChange={(e) => setCategory(e.target.value)}
                      className="accent-amber-500"
                    />
                    <span>{cat.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 p-2.5 bg-neutral-950 rounded-lg border border-neutral-800 text-xs">
              <input
                type="checkbox"
                id="include_timestamp"
                checked={includeTimestamp}
                onChange={(e) => setIncludeTimestamp(e.target.checked)}
                className="accent-amber-500"
              />
              <label htmlFor="include_timestamp" className="text-neutral-300 cursor-pointer">
                Pin current playback timestamp (<span className="text-amber-400 font-mono font-semibold">{timestampStr}</span>) for moderators
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Detailed Description & Academic Context
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Specify the exact issue, timestamp references, or missing academic citations..."
                rows={3}
                required
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium rounded-lg text-neutral-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !details.trim()}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-black disabled:opacity-50 transition-colors cursor-pointer"
              >
                {submitting ? 'Submitting...' : 'Submit Report for Review'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
