import React from 'react';
import { useNotifications, ToastItem } from '../context/NotificationContext.tsx';
import { Bell, ShieldAlert, Video, MessageSquare, CheckCircle, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useNotifications();

  if (toasts.length === 0) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'moderation':
        return <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0" />;
      case 'upload':
        return <Video className="w-5 h-5 text-emerald-400 shrink-0" />;
      case 'interaction':
        return <MessageSquare className="w-5 h-5 text-sky-400 shrink-0" />;
      default:
        return <Bell className="w-5 h-5 text-amber-400 shrink-0" />;
    }
  };

  return (
    <aside aria-label="Notifications" className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast: ToastItem) => (
        <div
          key={toast.id}
          className="pointer-events-auto bg-neutral-900 border border-neutral-700/80 shadow-2xl rounded-xl p-3.5 flex items-start gap-3 backdrop-blur-md animate-in slide-in-from-bottom-3 duration-200"
        >
          {getIcon(toast.type)}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <h4 className="text-sm font-semibold text-neutral-100 truncate">{toast.title}</h4>
              <button
                onClick={() => dismissToast(toast.id)}
                className="text-neutral-400 hover:text-neutral-200 p-0.5 rounded transition-colors"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-neutral-300 mt-0.5 line-clamp-2 leading-relaxed">{toast.message}</p>
            <div className="flex items-center gap-2 mt-1.5 text-[10px] text-neutral-400">
              <span className="flex items-center gap-1">
                <CheckCircle className="w-2.5 h-2.5 text-emerald-400" /> Real-time push alert
              </span>
            </div>
          </div>
        </div>
      ))}
    </aside>
  );
};
