import React, { createContext, useContext, useState, useEffect } from 'react';
import { signInWithPopup, signOut as fbSignOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';

export type UserRole = 'student' | 'educator' | 'moderator' | 'admin';

export interface UserProfile {
  id: number;
  uid: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  institution: string;
  isVerifiedEducator: boolean;
  restrictedAccessPass: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  switchDemoRole: (role: UserRole) => Promise<void>;
  toggleRestrictedPass: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isEducator: boolean;
  isModerator: boolean;
  isAdmin: boolean;
  hasInstitutionalPass: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Preset demo identities for seamless evaluation
const DEMO_PROFILES: Record<UserRole, UserProfile> = {
  admin: {
    id: 1,
    uid: 'admin-master-uid',
    email: 'admin@eduhub.org',
    displayName: 'Chief Academic Officer',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    role: 'admin',
    institution: 'EduHub Academic Directorate',
    isVerifiedEducator: true,
    restrictedAccessPass: true,
  },
  moderator: {
    id: 2,
    uid: 'mod-academic-uid',
    email: 'moderator@eduhub.org',
    displayName: 'Senior Peer Reviewer',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    role: 'moderator',
    institution: 'Global Ethics & Guidelines Board',
    isVerifiedEducator: true,
    restrictedAccessPass: true,
  },
  educator: {
    id: 3,
    uid: 'edu-eleanor-uid',
    email: 'dr.vance@mit.edu',
    displayName: 'Dr. Eleanor Vance',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    role: 'educator',
    institution: 'MIT Physics Lab',
    isVerifiedEducator: true,
    restrictedAccessPass: true,
  },
  student: {
    id: 10,
    uid: 'student-demo-uid',
    email: 'learner@eduhub.org',
    displayName: 'Alex Rivers (Student)',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    role: 'student',
    institution: 'Global Open Academy',
    isVerifiedEducator: false,
    restrictedAccessPass: false,
  },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  // Default to Educator or Student for immediate interactive experience
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('eduhub_active_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEMO_PROFILES.student;
      }
    }
    return DEMO_PROFILES.student;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      localStorage.setItem('eduhub_active_user', JSON.stringify(user));
    }
  }, [user]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        try {
          const res = await fetch('/api/auth/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              uid: fbUser.uid,
              email: fbUser.email,
              displayName: fbUser.displayName,
              avatarUrl: fbUser.photoURL,
              role: fbUser.email?.includes('admin') ? 'admin' : 'student',
            }),
          });
          const contentType = res.headers.get('content-type') || '';
          if (res.ok && contentType.includes('application/json')) {
            const data = await res.json();
            setUser(data);
          }
        } catch (err) {
          console.error('Error syncing Firebase user with database:', err);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      const token = await result.user.getIdToken();
      const res = await fetch('/api/auth/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName,
          avatarUrl: result.user.photoURL,
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setUser(data);
      }
    } catch (err) {
      console.warn('Google Sign In popup bypassed or canceled; fallback remains available.', err);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await fbSignOut(auth);
    } catch {
      // Ignored
    }
    setUser(DEMO_PROFILES.student);
    localStorage.removeItem('eduhub_active_user');
  };

  const switchDemoRole = async (role: UserRole) => {
    const target = DEMO_PROFILES[role];
    setUser(target);
    localStorage.setItem('eduhub_active_user', JSON.stringify(target));
    // Also sync to backend so API checks recognize this user
    try {
      await fetch('/api/auth/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: target.uid,
          email: target.email,
          displayName: target.displayName,
          avatarUrl: target.avatarUrl,
          role: target.role,
        }),
      });
    } catch (e) {
      console.warn('Sync warning:', e);
    }
  };

  const toggleRestrictedPass = async () => {
    if (!user) return;
    const newPass = !user.restrictedAccessPass;
    const updated = { ...user, restrictedAccessPass: newPass };
    setUser(updated);
    localStorage.setItem('eduhub_active_user', JSON.stringify(updated));
    try {
      await fetch('/api/auth/role', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid,
          role: user.role,
          restrictedPass: newPass,
        }),
      });
    } catch (e) {
      console.warn('Role update warning:', e);
    }
  };

  const refreshProfile = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/auth/me?uid=${user.uid}`);
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
        }
      }
    } catch (e) {
      console.error('Failed to refresh user profile:', e);
    }
  };

  const isEducator = user?.role === 'educator' || user?.role === 'admin';
  const isModerator = user?.role === 'moderator' || user?.role === 'admin';
  const isAdmin = user?.role === 'admin';
  const hasInstitutionalPass = !!user?.restrictedAccessPass || (user?.email ? user.email.endsWith('.edu') : false);

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        signInWithGoogle,
        signOut,
        switchDemoRole,
        toggleRestrictedPass,
        refreshProfile,
        isEducator,
        isModerator,
        isAdmin,
        hasInstitutionalPass,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
