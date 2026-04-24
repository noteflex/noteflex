import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, Profile } from "@/hooks/useProfile";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;           // ← 추가
  profileLoading: boolean;            // ← 추가
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>; // ← 추가
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  profileLoading: true,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const user = session?.user ?? null;
  const { profile, loading: profileLoading, refresh: refreshProfile } = useProfile(user);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        profileLoading,
        loading,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}