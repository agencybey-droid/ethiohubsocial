import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useNotifications } from '../context/NotificationContext.tsx';
import { useLanguage } from '../context/LanguageContext.tsx';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Clock,
  BookOpen,
  Filter,
  RefreshCw,
  Eye,
  Shield,
  Upload,
  Film,
  FileVideo,
  Trash2,
  Plus,
  Layers,
  Search,
  Check,
  Sparkles,
  Database,
  Copy,
  ExternalLink,
  Info,
  FolderSearch,
} from 'lucide-react';
import {
  publishVideo,
  getAdminVideosCatalog,
  removeVideoItem,
  clearAllPlaceholders,
  safeFetchJson,
} from '../services/videoService.ts';
import {
  uploadVideoFileToSupabase,
  insertVideoToSupabase,
  UNIVERSAL_VIDEO_BUCKET,
  SUPABASE_SETUP_SQL,
} from '../lib/supabase.ts';

interface ReportItem {
  id: number;
  videoId: number;
  videoTitle: string;
  reportedByUserId: string;
  reportedByEmail?: string;
  category: string;
  details: string;
  timestampMark?: string;
  status: 'pending' | 'under_review' | 'resolved_action_taken' | 'dismissed';
  resolutionNotes?: string;
  resolvedBy?: string;
  createdAt: string;
}

interface AdminVideoItem {
  id: number;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration: string;
  durationSec: number;
  views: number;
  likes: number;
  dislikes: number;
  category: string;
  educatorName: string;
  educatorAvatar?: string;
  accessLevel: string;
  isShort?: boolean;
  isApproved?: boolean;
  isRemoved?: boolean;
  createdAt: string;
}

interface ModerationDashboardProps {
  onInspectVideo?: (videoId: number) => void;
  onVideoUploaded?: () => void;
}

const CATEGORIES = [
  'History',
  'Technology',
  'Nature & Wildlife',
  'Music & Arts',
  'Culture',
  'Medical',
  'Science',
  'General',
];



export const ModerationDashboard: React.FC<ModerationDashboardProps> = ({
  onInspectVideo,
  onVideoUploaded,
}) => {
  const { user } = useAuth();
  const { triggerRealtimeNotification } = useNotifications();
  const { language } = useLanguage();
  const isAmharic = language === 'am';

  // Navigation tab inside Admin Portal
  const [activeTab, setActiveTab] = useState<'upload' | 'manage' | 'queue' | 'guidelines' | 'supabase'>('upload');

  // Supabase Diagnostics & Settings state
  const [customScanBucket, setCustomScanBucket] = useState('');
  const [syncingSupabase, setSyncingSupabase] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [supabaseDiag, setSupabaseDiag] = useState<{
    connected?: boolean;
    url?: string;
    projectRef?: string;
    bucketsFound?: string[];
    filesInVideosBucket?: number;
    error?: string;
  } | null>(null);

  const fetchSupabaseDiag = async () => {
    try {
      const res = await fetch('/api/supabase/status');
      const data = await res.json();
      setSupabaseDiag(data);
    } catch (e: any) {
      setSupabaseDiag({ connected: false, error: e.message });
    }
  };

  useEffect(() => {
    fetchSupabaseDiag();
  }, []);

  // Reports state
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'resolved_action_taken' | 'dismissed'>('all');
  const [resolutionInput, setResolutionInput] = useState<{ [reportId: number]: string }>({});

  // Manage catalog state
  const [adminVideos, setAdminVideos] = useState<AdminVideoItem[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [searchCatalogQuery, setSearchCatalogQuery] = useState('');
  const [catalogTypeFilter, setCatalogTypeFilter] = useState<'all' | 'videos' | 'shorts'>('all');

  // Admin Upload form state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const thumbInputRef = useRef<HTMLInputElement | null>(null);

  const [uploadMode, setUploadMode] = useState<'standard' | 'short'>('standard');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [accessLevel, setAccessLevel] = useState<'public' | 'institutional' | 'sensitive_academic'>('public');
  const [tags, setTags] = useState('ethiohub, video, education');
  const [educatorName, setEducatorName] = useState('Alex Rivers (Student)');
  const [duration, setDuration] = useState('10:00');
  const [isPeerReviewed, setIsPeerReviewed] = useState(true);
  const [autoApprove, setAutoApprove] = useState(true);

  // Video source - Defaults to real local file upload
  const [videoSourceType, setVideoSourceType] = useState<'file' | 'url'>('file');
  const [customVideoUrl, setCustomVideoUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [generatedThumbnail, setGeneratedThumbnail] = useState<string>('');

  // Helper to extract a real video frame snapshot as thumbnail
  const captureVideoThumbnail = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      try {
        const url = URL.createObjectURL(file);
        const video = document.createElement('video');
        video.src = url;
        video.muted = true;
        video.crossOrigin = 'anonymous';
        video.currentTime = 0.5;
        video.onloadeddata = () => {
          video.currentTime = Math.min(1.0, (video.duration || 2) / 2);
        };
        video.onseeked = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 360;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
              URL.revokeObjectURL(url);
              resolve(dataUrl);
              return;
            }
          } catch {}
          URL.revokeObjectURL(url);
          resolve('');
        };
        video.onerror = () => {
          URL.revokeObjectURL(url);
          resolve('');
        };
      } catch {
        resolve('');
      }
    });
  };

  // Thumbnail source
  const [customThumbnailUrl, setCustomThumbnailUrl] = useState('');

  // Uploading status
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(null);

  // Fetch reports
  const fetchReports = async () => {
    setLoadingReports(true);
    try {
      const url = statusFilter === 'all' ? '/api/reports' : `/api/reports?status=${statusFilter}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setReports(data);
      }
    } catch (e) {
      console.warn('Failed to load reports:', e);
    } finally {
      setLoadingReports(false);
    }
  };

  // Fetch catalog for admin management
  const fetchAdminVideos = async () => {
    setLoadingVideos(true);
    try {
      const data = await getAdminVideosCatalog();
      setAdminVideos(data as any);
    } catch (e) {
      console.warn('Failed to fetch admin catalog:', e);
    } finally {
      setLoadingVideos(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'queue') {
      fetchReports();
    } else if (activeTab === 'manage') {
      fetchAdminVideos();
    }
  }, [activeTab, statusFilter]);

  // Handle report moderation
  const handleAction = async (
    reportId: number,
    newStatus: string,
    action: 'keep' | 'takedown' | 'restrict_institutional'
  ) => {
    const notes = resolutionInput[reportId] || `Action: ${action} executed by ${user?.displayName || 'Admin'}`;
    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          resolutionNotes: notes,
          resolvedBy: user?.displayName || 'Admin',
          videoAction: action,
        }),
      });

      if (res.ok) {
        triggerRealtimeNotification(
          'Moderation Action Executed',
          `Report #${reportId} updated to ${newStatus.toUpperCase()}. Action: ${action}`,
          'moderation'
        );
        fetchReports();
        onVideoUploaded?.();
      }
    } catch (e) {
      console.warn('Failed to update report action:', e);
    }
  };

  // Handle deleting video from admin catalog
  const handleDeleteVideo = async (videoId: number, videoTitle: string) => {
    if (!window.confirm(`Are you sure you want to remove "${videoTitle}" from the platform?`)) {
      return;
    }
    try {
      await removeVideoItem(videoId);
      triggerRealtimeNotification(
        'Video Removed',
        `"${videoTitle}" has been removed from the platform by Admin.`,
        'moderation'
      );
      setAdminVideos((prev) => prev.filter((v) => v.id !== videoId));
      onVideoUploaded?.();
    } catch (e) {
      console.warn('Failed to delete video:', e);
    }
  };

  // Handle Admin direct video upload
  const handleAdminUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setUploadErrorMessage(isAmharic ? 'እባክዎ የቪዲዮውን ርዕስ ያስገቡ' : 'Please provide a title for the video.');
      return;
    }

    setUploading(true);
    setUploadProgress(15);
    setUploadErrorMessage(null);
    setUploadSuccessMessage(null);

    try {
      const isShort = uploadMode === 'short';

      if (videoSourceType === 'file' && !selectedFile) {
        setUploadErrorMessage(
          isAmharic
            ? 'እባክዎ ከመሳሪያዎ ላይ የቪዲዮ ፋይል ይምረጡ (.mp4, .webm, .mov)'
            : 'Please choose a video file (.mp4, .webm, .mov) from your device to upload.'
        );
        setUploading(false);
        return;
      }

      if (videoSourceType === 'url' && !customVideoUrl.trim()) {
        setUploadErrorMessage(
          isAmharic ? 'እባክዎ ትክክለኛ የቪዲዮ አድራሻ (URL) ያስገቡ' : 'Please provide a valid video URL.'
        );
        setUploading(false);
        return;
      }

      let finalVideoUrl = customVideoUrl.trim();
      let finalThumbUrl = customThumbnailUrl.trim() || generatedThumbnail || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80';
      let finalDuration = duration || (isShort ? '0:45' : '10:00');
      let finalDurationSec = isShort ? 45 : 600;

      let supabasePath: string | undefined;
      let supabaseBucket = UNIVERSAL_VIDEO_BUCKET;
      let supabaseUrl: string | undefined;

      if (videoSourceType === 'file' && selectedFile) {
        setUploadProgress(25);
        if (generatedThumbnail) {
          finalThumbUrl = generatedThumbnail;
        } else if (!customThumbnailUrl.trim()) {
          finalThumbUrl = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80';
        }

        // Upload directly to the single shared universal Supabase 'videos' bucket
        try {
          const supabaseResult = await uploadVideoFileToSupabase(
            selectedFile,
            UNIVERSAL_VIDEO_BUCKET,
            (percent) => {
              setUploadProgress(Math.round(25 + percent * 0.45));
            }
          );
          finalVideoUrl = supabaseResult.publicUrl;
          supabasePath = supabaseResult.path;
          supabaseBucket = UNIVERSAL_VIDEO_BUCKET;
          supabaseUrl = supabaseResult.publicUrl;

          // Insert into Supabase 'videos' database table
          try {
            await insertVideoToSupabase({
              title: title.trim(),
              description: description.trim() || `Uploaded via Admin Studio: ${title.trim()}`,
              video_url: finalVideoUrl,
              thumbnail_url: finalThumbUrl,
              duration: finalDuration,
              duration_sec: finalDurationSec,
              category,
              educator_id: 'student-demo-uid',
              educator_name: educatorName.trim() || 'Alex Rivers (Student)',
              is_short: isShort,
              is_supabase_stored: true,
              supabase_path: supabasePath,
              supabase_bucket: UNIVERSAL_VIDEO_BUCKET,
            });
          } catch {}
        } catch (e: any) {
          console.error('Supabase upload exception:', e);
          setUploadErrorMessage(e?.message || 'Failed to upload video to Supabase Storage. Please verify connection.');
          setUploading(false);
          return;
        }
      } else if (videoSourceType === 'url' && customVideoUrl.trim()) {
        finalVideoUrl = customVideoUrl.trim();
      }

      if (customThumbnailUrl.trim()) {
        finalThumbUrl = customThumbnailUrl.trim();
      }

      setUploadProgress(75);

      const parsedTags = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const result = await publishVideo({
        title: title.trim(),
        description: description.trim() || `Uploaded via Admin Studio: ${title.trim()}`,
        videoUrl: finalVideoUrl,
        thumbnailUrl: finalThumbUrl,
        previewUrl: finalThumbUrl,
        duration: finalDuration,
        durationSec: finalDurationSec,
        category,
        tags: parsedTags,
        educatorId: 'student-demo-uid',
        educatorName: educatorName.trim() || 'Alex Rivers (Student)',
        educatorAvatar: user?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
        accessLevel,
        isShort,
        isApproved: autoApprove,
        isPeerReviewed,
        isSupabaseStored: Boolean(supabasePath),
        supabasePath,
        supabaseBucket,
        supabaseUrl,
        videoFile: selectedFile || undefined,
      });

      setUploadProgress(100);

      if (result.success) {
        setUploadSuccessMessage(
          isAmharic
            ? `"${title}" በቪዲዮ ካታሎግ ውስጥ በተሳካ ሁኔታ ተለጥፏል!`
            : `"${title}" has been successfully published to the platform!`
        );
        triggerRealtimeNotification(
          isAmharic ? 'ቪዲዮ በተሳካ ሁኔታ ተለጥፏል' : 'Admin Video Published',
          `"${title}" is now live and accessible in the catalog.`,
          'upload'
        );

        // Reset form
        setTitle('');
        setDescription('');
        setSelectedFile(null);
        setCustomVideoUrl('');
        setCustomThumbnailUrl('');
        setGeneratedThumbnail('');

        // Notify parent to refresh catalogs
        onVideoUploaded?.();
        if (activeTab === 'manage') {
          fetchAdminVideos();
        }
      }
    } catch (err: any) {
      setUploadErrorMessage(err.message || 'An error occurred during video upload');
    } finally {
      setUploading(false);
    }
  };

  const pendingCount = reports.filter((r) => r.status === 'pending').length;

  // Filtered admin catalog
  const filteredCatalog = adminVideos.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchCatalogQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchCatalogQuery.toLowerCase()) ||
      item.educatorName.toLowerCase().includes(searchCatalogQuery.toLowerCase());
    const matchesType =
      catalogTypeFilter === 'all'
        ? true
        : catalogTypeFilter === 'shorts'
        ? item.isShort
        : !item.isShort;
    return matchesSearch && matchesType;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Admin Portal Header Banner */}
      <div className="p-6 bg-gradient-to-r from-neutral-900 via-[#18181f] to-neutral-900 rounded-2xl border border-neutral-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-[#ff9000]/15 border border-[#ff9000]/30 text-[#ff9000] rounded-xl shadow-inner">
            <Shield className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">
                {isAmharic ? 'የአስተዳዳሪ እና ልከኝነት መድረክ' : 'Admin & Moderation Portal'}
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#ff9000] text-black font-extrabold uppercase">
                ADMIN ACCESS
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              {isAmharic
                ? 'ቪዲዮዎችን በቀጥታ ይስቀሉ፣ ካታሎጉን ያስተዳድሩ እና ሪፖርቶችን ይገምግሙ።'
                : 'Upload videos and shorts directly, manage platform content, and review flagged reports.'}
            </p>
          </div>
        </div>

        {/* Top Tab Switcher */}
        <div className="flex items-center gap-1 p-1 bg-neutral-950 rounded-xl border border-neutral-800 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-3.5 py-1.5 rounded-lg transition-all duration-150 active:scale-[0.98] cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'upload'
                ? 'bg-[#ff9000] text-black font-bold shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isAmharic ? 'ቪዲዮ ስቀል' : 'Upload Video'}</span>
          </button>

          <button
            onClick={() => setActiveTab('manage')}
            className={`px-3.5 py-1.5 rounded-lg transition-all duration-150 active:scale-[0.98] cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'manage'
                ? 'bg-[#ff9000] text-black font-bold shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{isAmharic ? 'ካታሎግ አስተዳድር' : 'Manage Videos'}</span>
          </button>

          <button
            onClick={() => setActiveTab('queue')}
            className={`px-3.5 py-1.5 rounded-lg transition-all duration-150 active:scale-[0.98] cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'queue'
                ? 'bg-[#ff9000] text-black font-bold shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{isAmharic ? 'ሪፖርቶች' : 'Review Queue'}</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 bg-red-600 text-white rounded-full text-[10px] font-mono">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('guidelines')}
            className={`px-3.5 py-1.5 rounded-lg transition-all duration-150 active:scale-[0.98] cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'guidelines'
                ? 'bg-[#ff9000] text-black font-bold shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{isAmharic ? 'መመሪያዎች' : 'Guidelines'}</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('supabase');
              fetchSupabaseDiag();
            }}
            className={`px-3.5 py-1.5 rounded-lg transition-all duration-150 active:scale-[0.98] cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'supabase'
                ? 'bg-[#ff9000] text-black font-bold shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Supabase Sync & Settings</span>
          </button>
        </div>
      </div>

      {/* TAB 1: UPLOAD VIDEOS DIRECTLY FROM ADMIN PAGE */}
      {activeTab === 'upload' && (
        <div className="bg-neutral-900/70 rounded-2xl border border-neutral-800 p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-[#ff9000]" />
                <span>{isAmharic ? 'የአስተዳዳሪ ቪዲዮ መጫኛ ስቱዲዮ' : 'Admin Video Studio & Direct Uploader'}</span>
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                {isAmharic
                  ? 'ቪዲዮዎችን እና አጫጭር ሪሎችን በቀጥታ ወደ ዳታቤዝ ይስቀሉ እና ወዲያውኑ ለተጠቃሚዎች ያጋሩ።'
                  : 'Directly publish lectures, documentaries, or vertical short reels to the platform catalog.'}
              </p>
            </div>

            {/* Video vs Short toggle */}
            <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-xs">
              <button
                type="button"
                onClick={() => {
                  setUploadMode('standard');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-150 active:scale-95 cursor-pointer font-semibold ${
                  uploadMode === 'standard'
                    ? 'bg-[#ff9000] text-black font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                <span>{isAmharic ? 'መደበኛ ቪዲዮ (16:9)' : 'Standard Video (16:9)'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setUploadMode('short');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-150 active:scale-95 cursor-pointer font-semibold ${
                  uploadMode === 'short'
                    ? 'bg-[#ff9000] text-black font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isAmharic ? 'አጭር ሪል (9:16)' : 'Short Reel (9:16)'}</span>
              </button>
            </div>
          </div>

          {/* Universal Video Bucket Banner */}
          <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-neutral-300 font-semibold">Universal Video Bucket:</span>
              <span className="font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/80 text-[11px]">
                videos
              </span>
              <span className="text-neutral-400 text-[11px] hidden sm:inline">
                • Unified public bucket: all uploads from any account are stored in one single library and visible to every visitor.
              </span>
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  await fetch('/api/supabase/sync', { method: 'POST' });
                  fetchAdminVideos();
                  onVideoUploaded?.();
                } catch {}
              }}
              className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white rounded-lg border border-neutral-700 cursor-pointer text-[11px] font-semibold flex items-center gap-1 transition-colors"
            >
              <RefreshCw className="w-3 h-3 text-[#ff9000]" />
              <span>Sync Bucket</span>
            </button>
          </div>

          {/* Success Banner */}
          {uploadSuccessMessage && (
            <div className="p-4 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="font-semibold">{uploadSuccessMessage}</span>
              </div>
              <button
                onClick={() => setActiveTab('manage')}
                className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-md font-bold transition-colors cursor-pointer"
              >
                {isAmharic ? 'በካታሎግ ውስጥ ይመልከቱ' : 'View in Catalog'}
              </button>
            </div>
          )}

          {/* Error Banner */}
          {uploadErrorMessage && (
            <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-red-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{uploadErrorMessage}</span>
            </div>
          )}

          {/* Upload Form */}
          <form onSubmit={handleAdminUpload} className="space-y-5 text-xs">
            {/* 1. Video Source Section */}
            <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-neutral-200 font-bold flex items-center gap-1.5 text-xs">
                  <FileVideo className="w-4 h-4 text-[#ff9000]" />
                  <span>{isAmharic ? 'የቪዲዮ ምንጭ' : 'Video Media Source'}</span>
                </label>
                <div className="flex items-center gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setVideoSourceType('file')}
                    className={`px-3 py-1 rounded transition-colors cursor-pointer font-semibold ${
                      videoSourceType === 'file'
                        ? 'bg-[#ff9000] text-black font-bold'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    {isAmharic ? 'ፋይል ምረጥ' : 'Upload Video File'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setVideoSourceType('url')}
                    className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                      videoSourceType === 'url'
                        ? 'bg-[#ff9000] text-black font-bold'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    {isAmharic ? 'ቀጥታ አድራሻ (URL)' : 'Direct URL'}
                  </button>
                </div>
              </div>

              {videoSourceType === 'file' && (
                <div className="space-y-3 pt-1">
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="video/mp4,video/webm,video/quicktime,video/m4v"
                      onChange={async (e) => {
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0];
                          setSelectedFile(file);
                          if (!title) {
                            const name = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
                            setTitle(name.charAt(0).toUpperCase() + name.slice(1));
                          }
                          const thumb = await captureVideoThumbnail(file);
                          if (thumb) {
                            setGeneratedThumbnail(thumb);
                          }
                        }
                      }}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full sm:w-auto px-4 py-2.5 bg-[#ff9000] hover:bg-[#ffa31a] active:bg-[#e68200] text-black rounded-lg font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md"
                    >
                      <Upload className="w-4 h-4 text-black" />
                      <span>{selectedFile ? 'Change Selected Video' : 'Choose Video File from Device (.mp4, .webm, .mov)'}</span>
                    </button>
                    {selectedFile ? (
                      <div className="text-emerald-400 font-mono text-[11px] truncate flex-1">
                        Selected: {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(1)} MB)
                      </div>
                    ) : (
                      <span className="text-neutral-500 text-[11px]">
                        Select any video file directly from your device. It will be uploaded directly to Supabase storage.
                      </span>
                    )}
                  </div>

                  {generatedThumbnail && (
                    <div className="flex items-center gap-3 p-2 bg-neutral-900/80 rounded-lg border border-neutral-800">
                      <img
                        src={generatedThumbnail}
                        alt="Extracted video frame"
                        className="w-20 h-12 object-cover rounded border border-neutral-700 shadow-sm"
                      />
                      <div className="text-[11px] text-neutral-300">
                        <span className="text-emerald-400 font-semibold block">Automatic Video Poster Frame Generated</span>
                        <span className="text-neutral-500 text-[10px]">Captured directly from your uploaded video.</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {videoSourceType === 'url' && (
                <div className="pt-1">
                  <input
                    type="url"
                    value={customVideoUrl}
                    onChange={(e) => setCustomVideoUrl(e.target.value)}
                    placeholder="https://example.com/video.mp4"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff9000]"
                  />
                </div>
              )}
            </div>

            {/* 2. Metadata: Title & Description */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-neutral-300 font-semibold">
                  {isAmharic ? 'የቪዲዮ ርዕስ *' : 'Video Title *'}
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={isAmharic ? 'ርዕስ ያስገቡ...' : 'Enter video title...'}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff9000]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-neutral-300 font-semibold">
                  {isAmharic ? 'ምድብ' : 'Category'}
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-[#ff9000] cursor-pointer"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-neutral-300 font-semibold">
                {isAmharic ? 'መግለጫ' : 'Description'}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder={isAmharic ? 'የቪዲዮውን አጠቃላይ መግለጫ እዚህ ያስገቡ...' : 'Comprehensive video description and context...'}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff9000] resize-none"
              />
            </div>

            {/* 3. Additional Metadata: Tags, Access, Educator Name, Duration */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="block text-neutral-400 text-[11px] font-semibold">
                  {isAmharic ? 'የፈጣሪ / መምህር ስም' : 'Creator / Educator'}
                </label>
                <input
                  type="text"
                  value={educatorName}
                  onChange={(e) => setEducatorName(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-[#ff9000]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-neutral-400 text-[11px] font-semibold">
                  {isAmharic ? 'ርዝመት' : 'Duration (e.g. 14:20)'}
                </label>
                <input
                  type="text"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-[#ff9000]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-neutral-400 text-[11px] font-semibold">
                  {isAmharic ? 'የተደራሽነት ደረጃ' : 'Access Level'}
                </label>
                <select
                  value={accessLevel}
                  onChange={(e) => setAccessLevel(e.target.value as any)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-[#ff9000] cursor-pointer"
                >
                  <option value="public">Public (Open)</option>
                  <option value="institutional">Institutional Only</option>
                  <option value="sensitive_academic">Sensitive Academic (18+)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-neutral-400 text-[11px] font-semibold">
                  {isAmharic ? 'መለያ ቃላት (Tags)' : 'Tags (comma separated)'}
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-[#ff9000]"
                />
              </div>
            </div>

            {/* Custom Thumbnail URL (Optional) */}
            <div className="space-y-1">
              <label className="block text-neutral-400 text-[11px] font-semibold">
                {isAmharic ? 'ብጁ ምስል አድራሻ (አማራጭ)' : 'Custom Thumbnail URL (Optional)'}
              </label>
              <input
                type="url"
                value={customThumbnailUrl}
                onChange={(e) => setCustomThumbnailUrl(e.target.value)}
                placeholder="https://images.unsplash.com/... or leave blank to use preset"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff9000]"
              />
            </div>

            {/* Admin Permissions & Badges Checklist */}
            <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800/80 flex flex-wrap items-center justify-between gap-4">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoApprove}
                  onChange={(e) => setAutoApprove(e.target.checked)}
                  className="accent-[#ff9000] w-4 h-4 rounded cursor-pointer"
                />
                <span className="text-neutral-300 font-semibold text-xs">
                  {isAmharic ? 'ወዲያውኑ አጽድቅ (Auto-Approve for catalog)' : 'Auto-Approve immediately for public catalog'}
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isPeerReviewed}
                  onChange={(e) => setIsPeerReviewed(e.target.checked)}
                  className="accent-[#ff9000] w-4 h-4 rounded cursor-pointer"
                />
                <span className="text-neutral-300 font-semibold text-xs">
                  {isAmharic ? 'የተረጋገጠ ባጅ (Peer-Reviewed / Verified)' : 'Mark with Verified / Peer-Reviewed Badge'}
                </span>
              </label>
            </div>

            {/* Upload Progress Bar */}
            {uploading && (
              <div className="space-y-1.5 p-3 bg-neutral-950 rounded-xl border border-neutral-800">
                <div className="flex justify-between text-[11px] text-neutral-400">
                  <span>Publishing video record to database...</span>
                  <span className="font-mono text-[#ff9000]">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-[#ff9000] h-full transition-all duration-300 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={uploading}
                className="px-6 py-2.5 bg-[#ff9000] hover:bg-[#ffa31a] active:bg-[#e68200] active:scale-[0.98] text-black font-black text-xs rounded-xl shadow-md transition-all duration-150 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{isAmharic ? 'በመጫን ላይ...' : 'Publishing to Database...'}</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>{isAmharic ? 'ቪዲዮውን ወደ መድረክ ስቀል' : 'Publish Video as Admin'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: MANAGE VIDEOS & REELS */}
      {activeTab === 'manage' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-900/60 p-4 rounded-xl border border-neutral-800">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <input
                  type="text"
                  value={searchCatalogQuery}
                  onChange={(e) => setSearchCatalogQuery(e.target.value)}
                  placeholder="Filter by title, category, or educator..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff9000]"
                />
                <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              {(['all', 'videos', 'shorts'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setCatalogTypeFilter(type)}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer capitalize font-semibold ${
                    catalogTypeFilter === type
                      ? 'bg-[#ff9000] text-black'
                      : 'bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  {type === 'all' ? 'All Content' : type === 'videos' ? 'Full Videos' : 'Short Reels'}
                </button>
              ))}

              <button
                onClick={fetchAdminVideos}
                className="p-1.5 text-neutral-400 hover:text-white rounded bg-neutral-950 border border-neutral-800 cursor-pointer active:scale-95 transition-transform"
                title="Refresh catalog"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingVideos ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={async () => {
                  setLoadingVideos(true);
                  try {
                    await safeFetchJson('/api/supabase/sync', { method: 'POST' });
                    await fetchAdminVideos();
                    onVideoUploaded?.();
                  } catch (e) {
                    console.warn('Sync failed:', e);
                  } finally {
                    setLoadingVideos(false);
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-700/80 text-emerald-300 text-xs font-semibold cursor-pointer transition-all flex items-center gap-1 active:scale-95 shadow-sm"
                title="Scan and display all videos from the single shared Supabase bucket 'videos'"
              >
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span>Sync Supabase Bucket</span>
              </button>

              <button
                onClick={async () => {
                  if (window.confirm('Do you want to clear all sample demo placeholders from the catalog? Only your real uploaded videos will remain.')) {
                    await clearAllPlaceholders();
                    fetchAdminVideos();
                    onVideoUploaded?.();
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-red-950/60 hover:bg-red-900 border border-red-800/80 text-red-300 text-xs font-semibold cursor-pointer transition-all flex items-center gap-1 active:scale-95"
                title="Remove default sample placeholders"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Demo Placeholders</span>
              </button>


            </div>
          </div>

          {loadingVideos ? (
            <div className="p-12 text-center text-neutral-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#ff9000]" />
              <p className="text-xs">Loading video catalog...</p>
            </div>
          ) : filteredCatalog.length === 0 ? (
            <div className="p-12 text-center bg-neutral-900/40 rounded-2xl border border-neutral-800 text-neutral-400">
              <Film className="w-10 h-10 text-neutral-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-neutral-200">No videos found</p>
              <p className="text-xs mt-1">Try another search query or upload a new video.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCatalog.map((item) => (
                <div
                  key={item.id}
                  className={`bg-neutral-900/80 border rounded-xl overflow-hidden flex flex-col justify-between transition-all ${
                    item.isRemoved
                      ? 'border-red-900/50 opacity-60'
                      : 'border-neutral-800/80 hover:border-neutral-700'
                  }`}
                >
                  <div>
                    <div className="relative aspect-video bg-neutral-950">
                      <img
                        src={item.thumbnailUrl}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-2 right-2 bg-black/80 text-white font-mono text-[10px] px-1.5 py-0.5 rounded font-bold">
                        {item.duration}
                      </div>
                      {item.isShort && (
                        <div className="absolute top-2 left-2 bg-[#ff9000] text-black font-bold text-[9px] px-1.5 py-0.5 rounded font-mono uppercase">
                          Short Reel
                        </div>
                      )}
                      {item.isRemoved && (
                        <div className="absolute inset-0 bg-red-950/80 flex items-center justify-center font-bold text-red-300 text-xs">
                          Takedown / Removed
                        </div>
                      )}
                    </div>

                    <div className="p-3 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] text-neutral-400">
                        <span className="font-semibold text-neutral-300">{item.category}</span>
                        <span>{item.views.toLocaleString()} views</span>
                      </div>
                      <h4 className="font-bold text-white text-xs line-clamp-1" title={item.title}>
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-neutral-400 line-clamp-2">
                        {item.description}
                      </p>
                      <div className="text-[10px] text-neutral-500 font-mono pt-1">
                        Creator: <span className="text-neutral-300">{item.educatorName}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-neutral-950/60 border-t border-neutral-800/60 flex items-center justify-between gap-2 text-xs">
                    <button
                      onClick={() => onInspectVideo?.(item.id)}
                      className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect</span>
                    </button>

                    {!item.isRemoved && (
                      <button
                        onClick={() => handleDeleteVideo(item.id, item.title)}
                        className="px-2.5 py-1 rounded bg-red-950/80 hover:bg-red-900 border border-red-800/60 text-red-300 font-semibold transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: REVIEW QUEUE (MODERATION REPORTS) */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-neutral-400 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Status:
              </span>
              {(['all', 'pending', 'resolved_action_taken', 'dismissed'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-lg border transition-colors cursor-pointer ${
                    statusFilter === st
                      ? 'bg-[#ff9000]/15 border-[#ff9000] text-[#ff9000] font-semibold'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  {st === 'all'
                    ? 'All Reports'
                    : st === 'pending'
                    ? 'Pending Review'
                    : st === 'resolved_action_taken'
                    ? 'Action Taken'
                    : 'Dismissed'}
                </button>
              ))}
            </div>

            <button
              onClick={fetchReports}
              className="flex items-center gap-1 text-neutral-400 hover:text-white p-1 rounded transition-colors cursor-pointer"
              title="Refresh queue"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingReports ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Reports Grid / Cards */}
          {reports.length === 0 ? (
            <div className="p-12 text-center bg-neutral-900/40 rounded-2xl border border-neutral-800 text-neutral-400">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-neutral-200">Moderation Queue is Clear</h3>
              <p className="text-xs mt-1">No active reports matching the selected filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="p-5 bg-neutral-900/70 border border-neutral-800 rounded-2xl space-y-4 transition-all"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold ${
                          report.status === 'pending'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                            : report.status === 'resolved_action_taken'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                        }`}
                      >
                        {report.status.replace(/_/g, ' ')}
                      </span>
                      <h3 className="text-sm font-bold text-white truncate max-w-md">{report.videoTitle}</h3>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-neutral-400">
                      {report.timestampMark && (
                        <span className="flex items-center gap-1 text-amber-400 font-mono bg-neutral-950 px-2 py-0.5 rounded border border-neutral-800">
                          <Clock className="w-3 h-3" /> Flagged at {report.timestampMark}
                        </span>
                      )}
                      <span>{new Date(report.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800/80 space-y-1.5 text-xs">
                    <div className="flex items-center gap-2 text-neutral-300 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      <span>Category: <strong className="text-white">{report.category}</strong></span>
                    </div>
                    <p className="text-neutral-300 leading-relaxed pl-5">{report.details}</p>
                    {report.reportedByEmail && (
                      <p className="text-[11px] text-neutral-500 pl-5">
                        Reported by: {report.reportedByEmail}
                      </p>
                    )}
                  </div>

                  {report.resolutionNotes && (
                    <div className="p-3 bg-neutral-950/80 rounded-xl border border-neutral-800 text-xs text-neutral-300">
                      <span className="text-[11px] font-mono text-emerald-400 font-bold block mb-1">
                        RESOLUTION NOTES ({report.resolvedBy || 'Moderator'}):
                      </span>
                      <p>{report.resolutionNotes}</p>
                    </div>
                  )}

                  {report.status === 'pending' && (
                    <div className="pt-2 border-t border-neutral-800/80 space-y-3">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Optional resolution notes..."
                          value={resolutionInput[report.id] || ''}
                          onChange={(e) =>
                            setResolutionInput({ ...resolutionInput, [report.id]: e.target.value })
                          }
                          className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-[#ff9000]"
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
                        <button
                          onClick={() => onInspectVideo?.(report.videoId)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect Content</span>
                        </button>
                        <button
                          onClick={() => handleAction(report.id, 'dismissed', 'keep')}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-neutral-400" />
                          <span>Dismiss Flag</span>
                        </button>
                        <button
                          onClick={() => handleAction(report.id, 'resolved_action_taken', 'keep')}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-900 border border-emerald-800/60 text-emerald-300 font-bold transition-colors cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Verify & Keep</span>
                        </button>
                        <button
                          onClick={() => handleAction(report.id, 'resolved_action_taken', 'takedown')}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-800/60 text-red-200 font-bold transition-colors cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5 text-red-400" />
                          <span>Takedown Content</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: COMMUNITY GUIDELINES REFERENCE */}
      {activeTab === 'guidelines' && (
        <div className="p-6 bg-neutral-900/60 rounded-2xl border border-neutral-800 space-y-6 text-xs text-neutral-300 leading-relaxed">
          <div className="space-y-2 border-b border-neutral-800 pb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#ff9000]" />
              <span>ethiohub Community Content & Integrity Guidelines</span>
            </h2>
            <p className="text-neutral-400">
              ethiohub provides a secure, respectful platform for cultural preservation, historical documentation,
              scientific learning, and community media sharing. All educators and creators agree to uphold these standards.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 space-y-1.5">
              <h4 className="font-bold text-[#ff9000] text-sm">1. Cultural & Historical Respect</h4>
              <p className="text-neutral-400">
                Media covering heritage sites, religious monuments, and indigenous traditions must be accurately
                represented with appropriate context and respect.
              </p>
            </div>

            <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 space-y-1.5">
              <h4 className="font-bold text-[#ff9000] text-sm">2. Sensitive & Clinical Protocols</h4>
              <p className="text-neutral-400">
                Medical procedures and mature scientific content must designate the video tier as{' '}
                <span className="text-red-400 font-medium">Sensitive Academic (18+)</span>. Explicit viewer consent
                gates are enforced to safeguard all audiences.
              </p>
            </div>

            <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 space-y-1.5">
              <h4 className="font-bold text-[#ff9000] text-sm">3. Verified Admin Uploads</h4>
              <p className="text-neutral-400">
                Content uploaded via the Admin Portal is directly published to the database with verified integrity
                badges for expedited delivery to the community.
              </p>
            </div>

            <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 space-y-1.5">
              <h4 className="font-bold text-[#ff9000] text-sm">4. Constructive Community Discourse</h4>
              <p className="text-neutral-400">
                Discussions must remain constructive and respectful. Slander, targeted harassment, or discriminatory
                remarks will result in immediate removal and moderation action.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: SUPABASE SETUP & DIAGNOSTICS */}
      {activeTab === 'supabase' && (
        <div className="space-y-6">
          {/* Status Header */}
          <div className="p-6 bg-gradient-to-r from-neutral-900 via-[#18181f] to-neutral-900 rounded-2xl border border-neutral-800 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-xl">
                  <Database className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Supabase Backend Integration & Diagnostics</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      LIVE
                    </span>
                  </h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Project Reference: <span className="font-mono text-white font-semibold">hyuutvivdhadmwzdhwwp</span> · Supabase URL:{' '}
                    <span className="font-mono text-neutral-300">https://hyuutvivdhadmwzdhwwp.supabase.co</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={syncingSupabase}
                  onClick={async () => {
                    setSyncingSupabase(true);
                    setSyncFeedback(null);
                    try {
                      const res = await safeFetchJson<{ success: boolean; syncedCount?: number; error?: string }>('/api/supabase/sync', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ bucketName: customScanBucket.trim() || undefined }),
                      });
                      if (res.ok && res.data) {
                        await fetchAdminVideos();
                        await fetchSupabaseDiag();
                        onVideoUploaded?.();
                        setSyncFeedback(`Sync complete! Discovered and synchronized ${res.data.syncedCount || 0} new video item(s).`);
                      } else {
                        setSyncFeedback(`Sync note: ${res.error || 'Server is busy, please try again shortly.'}`);
                      }
                    } catch (e: any) {
                      setSyncFeedback(`Sync error: ${e.message}`);
                    } finally {
                      setSyncingSupabase(false);
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-[#ff9000] hover:bg-[#ffa31a] active:scale-95 text-black font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingSupabase ? 'animate-spin' : ''}`} />
                  <span>{syncingSupabase ? 'Scanning Supabase...' : 'Run Deep Sync Now'}</span>
                </button>
              </div>
            </div>

            {syncFeedback && (
              <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{syncFeedback}</span>
              </div>
            )}
          </div>

          {/* Critical Supabase Settings Guide */}
          <div className="p-6 bg-neutral-900/60 rounded-2xl border border-neutral-800 space-y-5 text-xs text-neutral-300 leading-relaxed">
            <div className="space-y-1 border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Info className="w-4 h-4 text-[#ff9000]" />
                <span>Why Some Supabase Videos Are Not Displaying (Checklist)</span>
              </h3>
              <p className="text-neutral-400">
                If you stored videos directly in Supabase Dashboard and they do not appear on the website, check these 3 Supabase settings:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Check 1 */}
              <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800/80 space-y-2">
                <div className="flex items-center gap-2 text-white font-bold text-xs">
                  <span className="w-5 h-5 rounded-full bg-[#ff9000] text-black flex items-center justify-center text-[10px] font-black">
                    1
                  </span>
                  <span>Bucket "Public" Toggle</span>
                </div>
                <p className="text-neutral-400 text-[11px] leading-normal">
                  In Supabase, if a storage bucket is marked <span className="text-amber-400 font-medium">Private</span>, the public website cannot stream or list files.
                </p>
                <div className="p-2 bg-neutral-900 rounded border border-neutral-800 text-[10px] text-neutral-300 space-y-1">
                  <p className="font-semibold text-emerald-400">How to Fix in Supabase:</p>
                  <p>1. Open <span className="text-white font-mono">Storage → Buckets</span>.</p>
                  <p>2. Click <span className="text-white font-mono">...</span> next to your bucket → <span className="text-white font-mono">Edit Bucket</span>.</p>
                  <p>3. Toggle <span className="text-amber-400 font-bold">Public bucket: ON</span>.</p>
                </div>
              </div>

              {/* Check 2 */}
              <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800/80 space-y-2">
                <div className="flex items-center gap-2 text-white font-bold text-xs">
                  <span className="w-5 h-5 rounded-full bg-[#ff9000] text-black flex items-center justify-center text-[10px] font-black">
                    2
                  </span>
                  <span>Storage RLS (Read Policy)</span>
                </div>
                <p className="text-neutral-400 text-[11px] leading-normal">
                  If Row Level Security (RLS) is turned on for Storage, an RLS policy must permit <span className="text-amber-400 font-medium">SELECT</span> for public users.
                </p>
                <div className="p-2 bg-neutral-900 rounded border border-neutral-800 text-[10px] text-neutral-300 space-y-1">
                  <p className="font-semibold text-emerald-400">How to Fix in Supabase:</p>
                  <p>1. Open <span className="text-white font-mono">Storage → Policies</span>.</p>
                  <p>2. Click <span className="text-white font-mono">New Policy</span> for your bucket.</p>
                  <p>3. Allow operation <span className="text-white font-mono">SELECT</span> for role <span className="text-white font-mono">anon, authenticated</span> with <span className="text-white font-mono">USING (true)</span>.</p>
                </div>
              </div>

              {/* Check 3 */}
              <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800/80 space-y-2">
                <div className="flex items-center gap-2 text-white font-bold text-xs">
                  <span className="w-5 h-5 rounded-full bg-[#ff9000] text-black flex items-center justify-center text-[10px] font-black">
                    3
                  </span>
                  <span>Bucket Name Matching</span>
                </div>
                <p className="text-neutral-400 text-[11px] leading-normal">
                  Our system defaults to the <span className="text-white font-mono">videos</span> bucket. If you named your bucket differently (e.g., <span className="text-white font-mono">Videos</span> with a capital V, or <span className="text-white font-mono">media</span>), enter it below!
                </p>
                <div className="p-2 bg-neutral-900 rounded border border-neutral-800 text-[10px] text-neutral-300 space-y-1">
                  <p className="font-semibold text-emerald-400">Project Reference:</p>
                  <p className="font-mono text-white">hyuutvivdhadmwzdhwwp</p>
                  <p className="text-neutral-500">Ensure your files are in this project.</p>
                </div>
              </div>
            </div>

            {/* Custom Bucket Scanner Tool */}
            <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 space-y-3">
              <h4 className="font-bold text-white text-xs flex items-center gap-2">
                <FolderSearch className="w-4 h-4 text-[#ff9000]" />
                <span>Scan a Specific Bucket Name or Subfolder</span>
              </h4>
              <p className="text-[11px] text-neutral-400">
                Did you store your videos in a bucket other than "videos" (e.g. <span className="text-white font-mono">Videos</span>, <span className="text-white font-mono">my-videos</span>, <span className="text-white font-mono">media</span>, <span className="text-white font-mono">uploads</span>)? Enter it below and click scan:
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-2.5 max-w-xl">
                <input
                  type="text"
                  value={customScanBucket}
                  onChange={(e) => setCustomScanBucket(e.target.value)}
                  placeholder="e.g. Videos, media, my-videos"
                  className="w-full sm:flex-1 bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#ff9000]"
                />
                <button
                  type="button"
                  disabled={syncingSupabase || !customScanBucket.trim()}
                  onClick={async () => {
                    if (!customScanBucket.trim()) return;
                    setSyncingSupabase(true);
                    setSyncFeedback(null);
                    try {
                      const res = await safeFetchJson<{ success: boolean; syncedCount?: number; error?: string }>('/api/supabase/sync', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ bucketName: customScanBucket.trim() }),
                      });
                      if (res.ok && res.data) {
                        await fetchAdminVideos();
                        await fetchSupabaseDiag();
                        onVideoUploaded?.();
                        setSyncFeedback(`Bucket "${customScanBucket.trim()}" scan complete! Found ${res.data.syncedCount || 0} new item(s).`);
                      } else {
                        setSyncFeedback(`Bucket scan note: ${res.error || 'Check bucket name or permissions.'}`);
                      }
                    } catch (e: any) {
                      setSyncFeedback(`Error scanning bucket: ${e.message}`);
                    } finally {
                      setSyncingSupabase(false);
                    }
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-white font-bold rounded-lg text-xs cursor-pointer transition-all border border-neutral-700 whitespace-nowrap"
                >
                  Scan This Bucket
                </button>
              </div>
            </div>

            {/* 1-Click SQL Setup Script */}
            <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-white text-xs">Automated 1-Click Supabase SQL Script</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(SUPABASE_SETUP_SQL);
                    setCopiedSql(true);
                    setTimeout(() => setCopiedSql(false), 2500);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-700/80 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-emerald-400" />}
                  <span>{copiedSql ? 'Copied to Clipboard!' : 'Copy SQL Script'}</span>
                </button>
              </div>
              <p className="text-[11px] text-neutral-400 leading-normal">
                You can copy and run this script in your Supabase project's <span className="text-white font-semibold">SQL Editor</span>. It will automatically ensure your storage bucket is public, grant read and upload permissions, and configure database tables.
              </p>
              <pre className="p-3 bg-neutral-900/90 rounded-lg border border-neutral-800/80 text-[10px] text-neutral-300 font-mono overflow-x-auto max-h-44">
                {SUPABASE_SETUP_SQL}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
