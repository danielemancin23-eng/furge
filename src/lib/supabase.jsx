import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const BACKEND = process.env.REACT_APP_BACKEND_URL;
export const OWNER_EMAIL = "danielemancin23@gmail.com";

let client = null;
export const sb = () => client;

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ ready: false, configured: true, session: null });

  useEffect(() => {
    let sub;
    (async () => {
      try {
        const cfg = await (await fetch(`${BACKEND}/api/config`)).json();
        if (!cfg.enabled) { setState({ ready: true, configured: false, session: null }); return; }
        client = createClient(cfg.supabase_url, cfg.supabase_anon_key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "furge-auth" } });
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

  const email = (state.session?.user?.email || "").toLowerCase();
  return (
    <AuthCtx.Provider value={{ ...state, user: state.session?.user || null, email, isOwner: email === OWNER_EMAIL, signIn, signOut, resetPassword, getToken }}>
      {children}
    </AuthCtx.Provider>
  );
}

// ---------- Private profile (role + AI settings), protected by RLS ----------
const SettingsCtx = createContext(null);
export const useSettings = () => useContext(SettingsCtx);

export const DEFAULT_SETTINGS = {
  system_prompt: "", endpoint_url: "", model_name: "", api_key: "", tavily_key: "",
  connection_mode: "browser", max_tokens: 8192, temperature: 0.7,
};

export function SettingsProvider({ children }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data, error: e } = await client.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
    if (e) { setError(e.message); setSettings(DEFAULT_SETTINGS); return; }
    if (!data) {
      const { data: created, error: e2 } = await client.from("profiles").insert({ user_id: user.id }).select("*").single();
      if (e2) { setError(e2.message); setSettings(DEFAULT_SETTINGS); return; }
      setSettings(created);
    } else setSettings(data);
    setError(null);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (patch) => {
    const { data, error: e } = await client.from("profiles").update({ ...patch, updated_at: new Date().toISOString() }).eq("user_id", user.id).select("*").single();
    if (e) throw new Error(e.message);
    setSettings(data);
    return data;
  }, [user]);

  const configured = !!(settings?.endpoint_url && settings?.model_name);
  return <SettingsCtx.Provider value={{ settings, save, reload: load, configured, error }}>{children}</SettingsCtx.Provider>;
}
