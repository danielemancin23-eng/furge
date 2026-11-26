import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

export const OWNER_EMAIL = "danielemancin23@gmail.com";

const SUPABASE_URL = "https://supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_PnNSTj1sdSKwzPIiJ9EE7Q_la0HLx6f";

let client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "furge-auth" },
});
export const sb = () => client;

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ ready: false, configured: true, session: null });

  useEffect(() => {
    let sub;
    (async () => {
      try {
        const { data } = await client.auth.getSession();
        setState({ ready: true, configured: true, session: data.session });
        sub = client.auth.onAuthStateChange((_e, session) => setState((s) => ({ ...s, session })));
      } catch {
        setState({ ready: true, configured: false, session: null, error: true });
      }
    })();
    return () => sub?.data?.subscription?.unsubscribe();
  }, []);

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) throw new Error(error.message === "Invalid login credentials" ? "Email o password errati" : error.message);
    if ((data.user?.email || "").toLowerCase() !== OWNER_EMAIL) { await client.auth.signOut(); throw new Error("Accesso riservato al proprietario"); }
    return data;
  }, []);

  const signOut = useCallback(async () => { await client?.auth.signOut(); }, []);

  const resetPassword = useCallback(async (email) => {
    const { error } = await client.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${window.location.origin}/login?reset=1` });
    if (error) throw new Error(error.message);
  }, []);

  const getToken = useCallback(async () => (await client.auth.getSession()).data.session?.access_token, []);

  return (
    <AuthCtx.Provider value={{ ...state, client, signIn, signOut, resetPassword, getToken }}>
      {children}
    </AuthCtx.Provider>
  );
}
