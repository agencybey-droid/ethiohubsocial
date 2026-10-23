import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider } from './context/AuthContext.tsx';
import { NotificationProvider } from './context/NotificationContext.tsx';
import { LanguageProvider, useLanguage } from './context/LanguageContext.tsx';
import { Header } from './components/Header.tsx';
import { VideoCard, VideoItem } from './components/VideoCard.tsx';
import { VideoPlayerView } from './components/VideoPlayerView.tsx';
import { ModerationDashboard } from './components/ModerationDashboard.tsx';
import { ToastContainer } from './components/ToastContainer.tsx';
import { Footer } from './components/Footer.tsx';
import { AgeGateModal } from './components/AgeGateModal.tsx';
import { ShortsSection } from './components/ShortsSection.tsx';
import { ReelPlayerModal } from './components/ReelPlayerModal.tsx';
import { RefreshCw, Search, Shield, ArrowLeft } from 'lucide-react';
import { getCatalogVideos, getShortsCatalog } from './services/videoService.ts';

const CATEGORIES_CONFIG = [
  { key: 'catAll', value: 'All' },
  { key: 'catHistory', value: 'History' },
  { key: 'catTechnology', value: 'Technology' },
  { key: 'catNature', value: 'Nature & Wildlife' },
  { key: 'catMusic', value: 'Music & Arts' },
  { key: 'catCulture', value: 'Culture' },
  { key: 'catMedical', value: 'Medical' },
];

const checkIsAdminRoute = () => {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.toLowerCase().replace(/\/+$/, '');
  return path === '/admin';
};

const MainContent: React.FC = () => {
  const { t } = useLanguage();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [shorts, setShorts] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);

  // Dedicated URL-based Admin route (/admin)
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(() => checkIsAdminRoute());

  // Shorts / Reels states
  const [selectedShortIndex, setSelectedShortIndex] = useState<number | null>(null);

  // Filters & Navigation
  const [activeNav, setActiveNav] = useState('home');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'trending' | 'top_rated' | 'newest'>('trending');

  // Stats & Reports count
  const [pendingReportsCount, setPendingReportsCount] = useState(0);

  // Listen to browser URL changes (e.g. user types /admin or hits back/forward)
  useEffect(() => {
    const handleUrlChange = () => {
      setIsAdminRoute(checkIsAdminRoute());
    };
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);

  const navigateToHome = () => {
    window.history.pushState({}, '', '/');
    setIsAdminRoute(false);
    setSelectedVideo(null);
    setActiveNav('home');
  };

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCatalogVideos({
        category: selectedCategory,
        search: searchQuery,
        sort: sortBy,
      });
      setVideos(data as any);
    } catch (e) {
      console.warn('Failed to load videos:', e);
    } finally {
      setLoading(false);
    }
  }, [sortBy, selectedCategory, searchQuery]);

  const fetchShorts = useCallback(async () => {
    try {
      const data = await getShortsCatalog();
      setShorts(data as any);
    } catch (e) {
      console.warn('Failed to load shorts:', e);
    }
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
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

  // Dedicated Admin Page (accessible only by going to /admin in URL)
  if (isAdminRoute) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-[#ff9000] selection:text-black">
        {/* Dedicated Admin Header */}
        <header className="sticky top-0 z-40 bg-[#0c0c10] border-b border-neutral-800/90 backdrop-blur-md px-4 py-3 shadow-lg">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={navigateToHome}
                className="flex items-center gap-1 cursor-pointer select-none group"
                title="Return to Public Hub"
              >
                <span className="text-xl font-black tracking-tight text-white group-hover:text-amber-400 transition-colors">
                  ethio
                </span>
                <span className="bg-[#ff9000] text-black font-black text-xl px-1.5 py-0.5 rounded tracking-tight shadow-sm">
                  hub
                </span>
              </button>
              <span className="text-neutral-700 font-mono text-sm hidden sm:inline">/</span>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#ff9000]/15 border border-[#ff9000]/40 text-[#ff9000] text-xs font-mono font-bold">
                <Shield className="w-3.5 h-3.5" />
                <span>ADMIN CONSOLE (/admin)</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={navigateToHome}
                className="px-3.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer active:scale-95 shadow-sm"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Public Site</span>
              </button>
            </div>
          </div>
        </header>

        {/* Dedicated Admin Dashboard */}
        <main className="flex-1 py-4">
          <ModerationDashboard
            onInspectVideo={(vId) => {
              const target = videos.find((v) => v.id === vId);
              if (target) {
                setSelectedVideo(target);
                setIsAdminRoute(false);
              }
            }}
            onVideoUploaded={() => {
              fetchVideos();
              fetchShorts();
              fetchStats();
            }}
          />
        </main>
      </div>
    );
  }

  // Split regular videos so shorts section is placed in the middle
  const firstBatch = videos.slice(0, 3);
  const secondBatch = videos.slice(3);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-[#ff9000] selection:text-black">
      {/* 18+ Age Verification Entrance Modal */}
      <AgeGateModal />

      {/* Top Header without Upload or Member icons */}
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeNav={activeNav}
        onNavChange={handleNavChange}
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
      <Footer onNavChange={handleNavChange} onOpenPermissions={() => {}} />

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
