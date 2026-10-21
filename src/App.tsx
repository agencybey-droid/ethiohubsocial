import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider } from './context/AuthContext.tsx';
import { NotificationProvider } from './context/NotificationContext.tsx';
import { LanguageProvider, useLanguage } from './context/LanguageContext.tsx';
import { Header } from './components/Header.tsx';
import { VideoCard, VideoItem } from './components/VideoCard.tsx';
import { VideoPlayerView } from './components/VideoPlayerView.tsx';
import { ModerationDashboard } from './components/ModerationDashboard.tsx';
import { UploadModal } from './components/UploadModal.tsx';
import { AdminPermissionsModal } from './components/AdminPermissionsModal.tsx';
import { ToastContainer } from './components/ToastContainer.tsx';
import { Footer } from './components/Footer.tsx';
import { AgeGateModal } from './components/AgeGateModal.tsx';
import { ShortsSection } from './components/ShortsSection.tsx';
import { ReelPlayerModal } from './components/ReelPlayerModal.tsx';
import { PostShortModal } from './components/PostShortModal.tsx';
import { RefreshCw, Search } from 'lucide-react';

const CATEGORIES_CONFIG = [
  { key: 'catAll', value: 'All' },
  { key: 'catHistory', value: 'History' },
  { key: 'catTechnology', value: 'Technology' },
  { key: 'catNature', value: 'Nature & Wildlife' },
  { key: 'catMusic', value: 'Music & Arts' },
  { key: 'catCulture', value: 'Culture' },
  { key: 'catMedical', value: 'Medical' },
];

const MainContent: React.FC = () => {
  const { t } = useLanguage();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [shorts, setShorts] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);

  // Shorts / Reels states
  const [selectedShortIndex, setSelectedShortIndex] = useState<number | null>(null);
  const [showPostShortModal, setShowPostShortModal] = useState(false);

  // Filters & Navigation
  const [activeNav, setActiveNav] = useState('home');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'trending' | 'top_rated' | 'newest'>('trending');
  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);

  // Stats & Reports count
  const [pendingReportsCount, setPendingReportsCount] = useState(0);

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/videos?sort=${sortBy}`;
      if (selectedCategory !== 'All') {
        url += `&category=${encodeURIComponent(selectedCategory)}`;
      }
      if (searchQuery.trim()) {
        url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setVideos(data);
      }
    } catch (e) {
      console.warn('Failed to load videos:', e);
    } finally {
      setLoading(false);
    }
  }, [sortBy, selectedCategory, searchQuery]);

  const fetchShorts = useCallback(async () => {
    try {
      const res = await fetch('/api/shorts');
      if (res.ok) {
        const data = await res.json();
        setShorts(data);
      }
    } catch (e) {
      console.warn('Failed to load shorts:', e);
    }
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setPendingReportsCount(data.openReportsCount || 0);
      }
    } catch (e) {
      console.warn('Failed to fetch stats:', e);
    }
  };

  useEffect(() => {
    fetchVideos();
    fetchShorts();
    fetchStats();
  }, [fetchVideos, fetchShorts]);

  const handleNavChange = (nav: string) => {
    setActiveNav(nav);
    setSelectedVideo(null);
    if (nav === 'trending') {
      setSortBy('trending');
    } else if (nav === 'top_rated') {
      setSortBy('top_rated');
    }
  };

  // Split regular videos so shorts section is placed in the middle
  const firstBatch = videos.slice(0, 3);
  const secondBatch = videos.slice(3);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-[#ff9000] selection:text-black">
      {/* 18+ Age Verification Entrance Modal */}
      <AgeGateModal />

      {/* Top Header */}
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeNav={activeNav}
        onNavChange={handleNavChange}
        onOpenUpload={() => setShowUploadModal(true)}
        onOpenPermissions={() => setShowPermissionsModal(true)}
        pendingReportsCount={pendingReportsCount}
      />

      {/* Main View Router */}
      <main className="flex-1">
        {selectedVideo ? (
          <VideoPlayerView
            video={selectedVideo}
            onBack={() => setSelectedVideo(null)}
            onSelectRelated={(v) => setSelectedVideo(v)}
            allVideos={videos}
          />
        ) : activeNav === 'moderation' ? (
          <ModerationDashboard
            onInspectVideo={(vId) => {
              const target = videos.find((v) => v.id === vId);
              if (target) setSelectedVideo(target);
            }}
            onVideoUploaded={() => {
              fetchVideos();
              fetchShorts();
              fetchStats();
            }}
          />
        ) : (
          /* Catalog Browse View */
          <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
            {/* Category Segmented Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {CATEGORIES_CONFIG.map((cat) => {
                const label = (t as any)[cat.key] || cat.value;
                return (
                  <button
                    key={cat.value}
                    onClick={() => setSelectedCategory(cat.value)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all duration-150 active:scale-[0.97] cursor-pointer ${
                      selectedCategory === cat.value
                        ? 'bg-[#ff9000] text-black font-bold shadow-sm'
                        : 'bg-[#16161b] border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Sub-header with video count and sort */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs border-b border-neutral-800/80 pb-3">
              <div className="flex items-center gap-2 text-neutral-400">
                <span className="font-semibold text-neutral-200">
                  {loading ? t.loadingVideos : `${videos.length} ${t.videosCount}`}
                </span>
                {selectedCategory !== 'All' && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#ff9000] font-medium">{selectedCategory}</span>
                  </>
                )}
                {searchQuery && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-neutral-300">"{searchQuery}"</span>
                  </>
                )}
              </div>

              {/* Sort By Controls */}
              <div className="flex items-center gap-1.5">
                <span className="text-neutral-500">{t.sortBy}</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="trending">{t.sortMostViewed}</option>
                  <option value="top_rated">{t.sortTopRated}</option>
                  <option value="newest">{t.sortNewest}</option>
                </select>
                <button
                  onClick={() => {
                    fetchVideos();
                    fetchShorts();
                  }}
                  className="p-1 text-neutral-400 hover:text-white rounded cursor-pointer active:scale-90 transition-transform"
                  title="Refresh"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Video Cards Grid with Shorts in the Middle */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div
                    key={n}
                    className="bg-neutral-900/40 rounded-xl aspect-video animate-pulse border border-neutral-800/60"
                  />
                ))}
              </div>
            ) : videos.length === 0 ? (
              <div className="p-16 text-center bg-neutral-900/30 rounded-2xl border border-neutral-800/60 text-neutral-400 space-y-3">
                <Search className="w-10 h-10 text-neutral-600 mx-auto" />
                <h3 className="text-base font-semibold text-neutral-200">{t.noVideosFound}</h3>
                <p className="text-xs max-w-sm mx-auto">
                  Try selecting another category or searching with different keywords.
                </p>
                <button
                  onClick={() => {
                    setSelectedCategory('All');
                    setSearchQuery('');
                    setActiveNav('home');
                  }}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#ff9000] text-black hover:bg-amber-400 cursor-pointer"
                >
                  {t.resetFilters}
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* First Batch of Videos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {firstBatch.map((video) => (
                    <VideoCard key={video.id} video={video} onSelect={(v) => setSelectedVideo(v)} />
                  ))}
                </div>

                {/* Shorts Section in the Middle */}
                <ShortsSection
                  shorts={shorts}
                  onSelectShort={(_, index) => setSelectedShortIndex(index)}
                  onOpenPostShort={() => setShowPostShortModal(true)}
                />

                {/* Remaining Batch of Videos */}
                {secondBatch.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {secondBatch.map((video) => (
                      <VideoCard key={video.id} video={video} onSelect={(v) => setSelectedVideo(v)} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Professional Multi-Column Footer */}
      <Footer onNavChange={handleNavChange} onOpenPermissions={() => setShowPermissionsModal(true)} />

      {/* Modals & Toasts */}
      <ToastContainer />

      {/* Vertical Fullscreen Reel Player Modal */}
      {selectedShortIndex !== null && (
        <ReelPlayerModal
          isOpen={selectedShortIndex !== null}
          onClose={() => setSelectedShortIndex(null)}
          shorts={shorts}
          initialIndex={selectedShortIndex}
          onVote={async (id, type) => {
            try {
              await fetch(`/api/videos/${id}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: 'user-voter', voteType: type }),
              });
            } catch (e) {
              console.warn(e);
            }
          }}
        />
      )}

      {/* Post Short Reel Modal */}
      <PostShortModal
        isOpen={showPostShortModal}
        onClose={() => setShowPostShortModal(false)}
        onSuccess={() => {
          fetchShorts();
          fetchStats();
        }}
      />

      {/* Upload Regular Lecture Modal */}
      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSuccess={() => {
          fetchVideos();
          fetchStats();
        }}
      />

      <AdminPermissionsModal
        isOpen={showPermissionsModal}
        onClose={() => setShowPermissionsModal(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <NotificationProvider>
          <MainContent />
        </NotificationProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
