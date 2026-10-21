import React from 'react';
import { useAuth, UserRole } from '../context/AuthContext.tsx';
import { useNotifications } from '../context/NotificationContext.tsx';
import { Shield, Check, UserCheck, GraduationCap, Award, Lock, Sparkles, X } from 'lucide-react';

interface AdminPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminPermissionsModal: React.FC<AdminPermissionsModalProps> = ({ isOpen, onClose }) => {
  const { user, switchDemoRole, toggleRestrictedPass } = useAuth();
  const { triggerRealtimeNotification } = useNotifications();

  if (!isOpen) return null;

  const roles: { role: UserRole; title: string; subtitle: string; icon: any }[] = [
    {
      role: 'student',
      title: 'Academic Student / Learner',
      subtitle: 'Standard access to public peer-reviewed lectures, notes, and discussions.',
      icon: GraduationCap,
    },
    {
      role: 'educator',
      title: 'Verified Faculty & Educator',
      subtitle: 'Permission to upload, encrypt media with AES-256-GCM, and manage course discussions.',
      icon: Award,
    },
    {
      role: 'moderator',
      title: 'Academic Ethics & Moderator',
      subtitle: 'Permission to triage flagged lectures, inspect violation timestamps, and enforce guidelines.',
      icon: UserCheck,
    },
    {
      role: 'admin',
      title: 'Chief Academic Officer (Admin)',
      subtitle: 'Full superuser privileges: manage system roles, audit encrypted media, execute takedowns.',
      icon: Shield,
    },
  ];

  const handleSelectRole = (r: UserRole) => {
    switchDemoRole(r);
    triggerRealtimeNotification(
      'Role Switched',
      `Switched active role identity to ${r.toUpperCase()} with updated granular permissions.`,
      'system'
    );
  };

  const handleTogglePass = () => {
    toggleRestrictedPass();
    triggerRealtimeNotification(
      'Access Pass Updated',
      user?.restrictedAccessPass
        ? 'Restricted & Institutional access pass deactivated.'
        : 'Restricted & Institutional access pass granted (Accredited University Domain verified).',
      'access'
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative text-neutral-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 border-b border-neutral-800 pb-4 mb-4">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Granular Permissions & Role Switcher</h3>
            <p className="text-xs text-neutral-400">
              Test multi-role access control, institutional barriers, and moderation rights.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
              Select Active Identity & Role
            </label>
            <div className="grid grid-cols-1 gap-2">
              {roles.map((item) => {
                const Icon = item.icon;
                const isSelected = user?.role === item.role;
                return (
                  <button
                    key={item.role}
                    onClick={() => handleSelectRole(item.role)}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500/60 shadow-lg shadow-amber-500/5'
                        : 'bg-neutral-950/70 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg mt-0.5 ${
                        isSelected ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-300'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${isSelected ? 'text-amber-400' : 'text-neutral-100'}`}>
                          {item.title}
                        </span>
                        {isSelected && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                      </div>
                      <p className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">{item.subtitle}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Institutional / 18+ Sensitive Pass */}
          <div className="p-3.5 bg-neutral-950 rounded-xl border border-neutral-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-semibold text-neutral-200">
                  Institutional & 18+ Medical Sensitive Pass
                </span>
              </div>
              <button
                onClick={handleTogglePass}
                className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors cursor-pointer ${
                  user?.restrictedAccessPass ? 'bg-emerald-500' : 'bg-neutral-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    user?.restrictedAccessPass ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              When enabled, simulates verified student/faculty credentials from accredited university partner domains
              (.edu), unlocking sensitive anatomical surgery and proprietary research.
            </p>
          </div>

          {/* Permission Matrix */}
          <div className="text-[11px] bg-neutral-950/80 p-3 rounded-xl border border-neutral-800/80 space-y-1.5 text-neutral-400">
            <div className="font-semibold text-neutral-300 mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Active Capabilities Matrix
            </div>
            <div className="flex justify-between py-0.5 border-b border-neutral-800/50">
              <span>Public Video Streaming</span>
              <span className="text-emerald-400 font-mono">YES</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-neutral-800/50">
              <span>Institutional & Sensitive Video Access</span>
              <span
                className={`font-mono ${
                  user?.restrictedAccessPass || user?.role !== 'student' ? 'text-emerald-400' : 'text-neutral-500'
                }`}
              >
                {user?.restrictedAccessPass || user?.role !== 'student' ? 'UNLOCKED' : 'LOCKED'}
              </span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-neutral-800/50">
              <span>Upload & Encrypt Lectures (AES-256)</span>
              <span
                className={`font-mono ${
                  user?.role === 'educator' || user?.role === 'admin' ? 'text-emerald-400' : 'text-neutral-500'
                }`}
              >
                {user?.role === 'educator' || user?.role === 'admin' ? 'AUTHORIZED' : 'RESTRICTED'}
              </span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-neutral-800/50">
              <span>Academic Moderation & Violation Queue</span>
              <span
                className={`font-mono ${
                  user?.role === 'moderator' || user?.role === 'admin' ? 'text-emerald-400' : 'text-neutral-500'
                }`}
              >
                {user?.role === 'moderator' || user?.role === 'admin' ? 'AUTHORIZED' : 'RESTRICTED'}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-black transition-colors cursor-pointer"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
};
