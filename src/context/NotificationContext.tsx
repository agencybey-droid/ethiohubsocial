import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext.tsx';

export interface AppNotification {
  id: number;
  userId: string;
  title: string;
  message: string;
  type: 'interaction' | 'system' | 'moderation' | 'upload' | 'access';
  videoId?: number;
  isRead: boolean;
  createdAt: string;
}

export interface ToastItem {
  id: string;
  title: string;
  message: string;
  type: string;
  timestamp: number;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  toasts: ToastItem[];
  pushEnabled: boolean;
  enablePushNotifications: () => Promise<boolean>;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => void;
  triggerRealtimeNotification: (title: string, message: string, type?: string, videoId?: number) => Promise<void>;
  dismissToast: (id: string) => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Web Audio API chime generator (zero external asset dependency)
function playNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.36);
  } catch {
    // Audio might be blocked until user gesture, ignore gracefully
  }
}

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [pushEnabled, setPushEnabled] = useState<boolean>(() => {
    return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';
  });
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Fetch notifications for active user
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/notifications?userId=${user.uid}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (e) {
      console.warn('Could not load notifications:', e);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000); // Polling for updates
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const triggerRealtimeNotification = async (
    title: string,
    message: string,
    type: string = 'interaction',
    videoId?: number
  ) => {
    // 1. Play synthesized audio chime
    if (soundEnabled) {
      playNotificationChime();
    }

    // 2. Add floating UI toast
    const toastId = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id: toastId, title, message, type, timestamp: Date.now() }]);

    // Auto dismiss toast after 6 seconds
    setTimeout(() => {
      dismissToast(toastId);
    }, 6000);

    // 3. Trigger Browser Web Notification if permitted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body: message,
          icon: '/favicon.ico',
        });
      } catch (err) {
        console.warn('System push notification failed:', err);
      }
    }

    // 4. Persist to backend database if user logged in
    if (user) {
      try {
        const res = await fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.uid,
            title,
            message,
            type,
            videoId,
          }),
        });
        if (res.ok) {
          const created = await res.json();
          setNotifications((prev) => [created, ...prev]);
        }
      } catch (err) {
        console.warn('Failed to save notification:', err);
      }
    }
  };

  const enablePushNotifications = async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('Desktop push notifications are not supported in this browser.');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setPushEnabled(true);
        triggerRealtimeNotification(
          'Push Notifications Activated',
          'You will now receive real-time updates for peer reviews, moderation responses, and lecture questions.',
          'system'
        );
        return true;
      } else {
        setPushEnabled(false);
        return false;
      }
    } catch {
      return false;
    }
  };

  const markAsRead = async (id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
    } catch (e) {
      console.warn('Failed to mark read:', e);
    }
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    notifications.forEach((n) => {
      if (!n.isRead) markAsRead(n.id);
    });
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        toasts,
        pushEnabled,
        enablePushNotifications,
        markAsRead,
        markAllAsRead,
        triggerRealtimeNotification,
        dismissToast,
        soundEnabled,
        setSoundEnabled,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
