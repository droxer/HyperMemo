import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/services/supabaseClient';
import { loginWithChromeIdentity } from '@/services/auth/chromeIdentity';

export type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const value = useProvideAuth();
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}

function useProvideAuth(): AuthContextValue {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const attemptedAnonRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    const autoAnonEnabled = Boolean(
      import.meta.env.VITE_AUTO_ANON_LOGIN &&
        /^(true|1|yes|on)$/i.test(import.meta.env.VITE_AUTO_ANON_LOGIN)
    );
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) {
          return;
        }
        if (error) {
          console.warn('Failed to fetch Supabase session', error);
        }
        const nextUser = data.session?.user ?? null;
        setUser(nextUser);
        setLoading(false);
        if (!nextUser && autoAnonEnabled && !attemptedAnonRef.current) {
          attemptedAnonRef.current = true;
          void supabase.auth.signInAnonymously().catch((anonError) => {
            console.warn('Failed to sign in anonymously', anonError);
          });
        }
      })
      .catch((error) => {
        if (mounted) {
          console.warn('Unexpected Supabase auth error', error);
          setLoading(false);
        }
      });
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) {
        return;
      }
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async () => {
    try {
      const canUseChromeIdentity =
        typeof chrome !== 'undefined' && !!chrome.identity?.launchWebAuthFlow;
      if (canUseChromeIdentity) {
        await loginWithChromeIdentity();
        return;
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          queryParams: { prompt: 'select_account' }
        }
      });
      if (error) {
        throw error;
      }
    } catch (error) {
      console.warn('Supabase login failed', error);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
    } catch (error) {
      console.warn('Supabase logout failed', error);
    }
  }, []);

  return useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
}
