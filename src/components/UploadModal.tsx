import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useNotifications } from '../context/NotificationContext.tsx';
import { simulateEncryptMedia, EncryptionResult } from '../utils/crypto.ts';
import {
  uploadVideoFileToSupabase,
  insertVideoToSupabase,
} from '../lib/supabase.ts';
import { publishVideo } from '../services/videoService.ts';
import {
  Upload,
  Lock,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  FileVideo,
  HardDrive,
  Film,
} from 'lucide-react';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CATEGORIES = [
  'Quantum Physics',
  'Machine Learning',
  'Medicine & Surgery',
  'Organic Chemistry',
  'Biotechnology',
  'Mathematics',
  'Neuroscience',
  'Cyber Security',
  'Astrophysics',
  'History',
  'Culture',
];

const PRESET_SAMPLE_VIDEOS = [
  {
    name: 'High-Definition Academic Stream: Machine Learning Foundations',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
    duration: '18:42',
    durationSec: 1122,
  },
  {
    name: 'Advanced Neural Network Topologies & Distributed Training',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&auto=format&fit=crop&q=80',
    duration: '24:15',
    durationSec: 1455,
  },
  {
    name: 'Clinical Surgical Protocol & Laparoscopic Simulation',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&auto=format&fit=crop&q=80',
    duration: '31:08',
    durationSec: 1868,
  },
];

export const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  const { triggerRealtimeNotification } = useNotifications();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [accessLevel, setAccessLevel] = useState<'public' | 'institutional' | 'sensitive_academic'>('public');
  const [isPeerReviewed, setIsPeerReviewed] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState(0);

  // Upload file state
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState('');

  // Encryption state
  const [enableEncryption, setEnableEncryption] = useState(false);
  const [encrypting, setEncrypting] = useState(false);
  const [encryptionProgress, setEncryptionProgress] = useState(0);
  const [encryptionStatusText, setEncryptionStatusText] = useState('');
  const [encryptionResult, setEncryptionResult] = useState<EncryptionResult | null>(null);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedVideoFile(file);
      if (!title) {
        const autoTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
        setTitle(autoTitle.charAt(0).toUpperCase() + autoTitle.slice(1));
      }
    }
  };

  const handleStartEncryption = async () => {
    setEncrypting(true);
    setError(null);
    try {
      const payloadSample = `MEDIA_PAYLOAD_${Date.now()}_${title}_${user?.uid}`;
      const result = await simulateEncryptMedia(payloadSample, (percent, status) => {
        setEncryptionProgress(percent);
        setEncryptionStatusText(status);
      });
      setEncryptionResult(result);
    } catch (e: any) {
      setError(e.message || 'Encryption failed');
    } finally {
      setEncrypting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError('Please fill in lecture title and description.');
      return;
    }

    if (enableEncryption && !encryptionResult) {
      setError('Please run client-side media encryption before publishing.');
      return;
    }

    setUploading(true);
    setError(null);

    const preset = PRESET_SAMPLE_VIDEOS[selectedPreset];
    let finalVideoUrl = preset.videoUrl;
    let finalThumbnailUrl = preset.thumbnailUrl;
    let supabasePath = `uploads/preset_${Date.now()}.mp4`;
    let duration = preset.duration;
    let durationSec = preset.durationSec;
    let fileSize = 24500000;
    let mimeType = 'video/mp4';

    try {
      // If user uploaded a physical video file from their computer
      if (selectedVideoFile) {
        setUploadStatusText('Uploading video media...');
        const uploadResult = await uploadVideoFileToSupabase(
          selectedVideoFile,
          'videos',
          (percent) => {
            setUploadProgress(percent);
          }
        );

        finalVideoUrl = uploadResult.publicUrl;
        supabasePath = uploadResult.path;
        fileSize = uploadResult.fileSize;
        mimeType = uploadResult.mimeType;
        duration = '12:00';
        durationSec = 720;
      }

      const result = await publishVideo({
        title: title.trim(),
        description: description.trim(),
        videoUrl: finalVideoUrl,
        thumbnailUrl: finalThumbnailUrl,
        previewUrl: finalThumbnailUrl,
        duration,
        durationSec,
        category,
        tags: [category, 'ethiohub', isPeerReviewed ? 'Peer-Reviewed' : 'Academic'],
        educatorId: user?.uid || 'creator-default',
        educatorName: user?.displayName || 'Verified Creator',
        educatorAvatar: user?.avatarUrl,
        accessLevel,
        isEncrypted: enableEncryption,
        encryptionAlgorithm: encryptionResult?.algorithm || 'AES-256-GCM',
        encryptionKeyId: encryptionResult ? `key_${encryptionResult.keyFingerprint}` : undefined,
        encryptionHash: encryptionResult?.hash || undefined,
        isPeerReviewed,
        isSupabaseStored: Boolean(selectedVideoFile),
        supabasePath: selectedVideoFile ? supabasePath : undefined,
        supabaseBucket: selectedVideoFile ? 'videos' : undefined,
        supabaseUrl: selectedVideoFile ? finalVideoUrl : undefined,
        fileSize,
        mimeType,
      });

      if (result.success) {
        triggerRealtimeNotification(
          'Video Published',
          `"${title}" has been successfully published to the catalog.`,
          'upload'
        );
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Network error while publishing');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative text-neutral-200 my-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1 rounded transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 border-b border-neutral-800 pb-4 mb-5">
          <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/30">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              Upload Video
            </h3>
            <p className="text-xs text-neutral-400">
              Share high-quality lectures, demonstrations, and educational material with the community.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">

          {/* Video File Picker or Preset */}
          <div className="space-y-2">
            <label className="block text-neutral-300 font-semibold">Video Source</label>
            <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="video/mp4,video/webm,video/quicktime,video/m4v"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <FileVideo className="w-4 h-4 text-emerald-400" />
                  {selectedVideoFile ? 'Change File' : 'Choose Local Video (.mp4)'}
                </button>
                {selectedVideoFile ? (
                  <div className="truncate text-emerald-400 font-mono text-[11px] flex-1">
                    {selectedVideoFile.name} ({(selectedVideoFile.size / (1024 * 1024)).toFixed(1)} MB)
                  </div>
                ) : (
                  <span className="text-neutral-500 text-[11px]">Or select a preset stream below</span>
                )}
              </div>

              {!selectedVideoFile && (
                <div className="grid grid-cols-1 gap-2 pt-1">
                  {PRESET_SAMPLE_VIDEOS.map((preset, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedPreset(idx)}
                      className={`p-2 rounded-lg border flex items-center justify-between cursor-pointer transition-colors ${
                        selectedPreset === idx
                          ? 'bg-emerald-500/10 border-emerald-500/50 text-white'
                          : 'bg-neutral-900 border-neutral-800/80 text-neutral-400 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <img src={preset.thumbnailUrl} alt="" className="w-8 h-5 object-cover rounded shrink-0" />
                        <span className="truncate text-xs">{preset.name}</span>
                      </div>
                      <span className="text-[10px] font-mono shrink-0 ml-2 text-neutral-400">{preset.duration}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-neutral-300 font-semibold mb-1">Video Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Distributed Database Replication & Sharding"
              required
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-neutral-300 font-semibold mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-neutral-100 focus:outline-none focus:border-emerald-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-neutral-300 font-semibold mb-1">Access Tier</label>
              <select
                value={accessLevel}
                onChange={(e) => setAccessLevel(e.target.value as any)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-neutral-100 focus:outline-none focus:border-emerald-500"
              >
                <option value="public">Open Public</option>
                <option value="institutional">Institutional Only</option>
                <option value="sensitive_academic">Sensitive Academic (18+ Gate)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-neutral-300 font-semibold mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Video description, syllabus topics, and references..."
              rows={2}
              required
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Upload Progress Bar */}
          {uploading && (
            <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2">
              <div className="flex justify-between text-[11px] text-neutral-300">
                <span className="flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-[#ff9000] animate-spin" />
                  Publishing video to catalog...
                </span>
                <span className="font-mono text-[#ff9000]">{uploadProgress || 75}%</span>
              </div>
              <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#ff9000] h-full transition-all duration-200"
                  style={{ width: `${uploadProgress || 75}%` }}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="px-4 py-2 font-medium rounded-lg text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !title.trim()}
              className="px-5 py-2 font-bold rounded-lg bg-[#ff9000] hover:bg-amber-400 text-black disabled:opacity-40 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {uploading ? (
                <>
                  <Upload className="w-4 h-4 animate-spin" /> Publishing Video...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" /> Publish Video
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
