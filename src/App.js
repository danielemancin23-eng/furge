import { useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, SettingsProvider, useAuth } from "@/lib/supabase";
import AppShell from "@/components/AppShell";
import Logo from "@/components/Logo";
import LoginPage from "@/pages/LoginPage";
import ChatPage from "@/pages/ChatPage";
import RolePage from "@/pages/RolePage";
import ArchivePage from "@/pages/ArchivePage";
import SettingsPage from "@/pages/SettingsPage";
import HomePage from "@/pages/HomePage";
import WorkspacePage from "@/pages/WorkspacePage";

function Gate({ children }) {
  const { ready, configured, session, isOwner, signOut } = useAuth();
  const loc = useLocation();
  useEffect(() => { if (session && !isOwner) signOut(); }, [session, isOwner, signOut]);
  if (!ready) return <div className="h-screen grid place-items-center" data-testid="gate-loading"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!configured) {
    return (
      <div className="min-h-screen grid place-items-center p-6" data-testid="setup-needed">
        <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center">
          <div className="mb-4 flex justify-center"><Logo size={36} withText /></div>
          <ShieldAlert className="mx-auto h-6 w-6 text-[hsl(38_92%_55%)]" />
          <h1 className="mt-3 text-xl font-semibold">Collega Supabase</h1>
          <p className="mt-2 text-sm text-muted-foreground">Furge è bloccato finché non vengono inseriti l'URL e la chiave pubblica (anon) del tuo progetto Supabase.</p>
        </div>
      </div>
    );
  }
  if (!session || !isOwner) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <SettingsProvider>{children}</SettingsProvider>;
}

const shell = (el) => <Gate><AppShell>{el}</AppShell></Gate>;

function App() {
  useEffect(() => { document.documentElement.classList.add("dark"); document.title = "Furge"; }, []);
  return (
    <div className="App min-h-screen bg-background text-foreground">
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<Navigate to="/chat" replace />} />
            <Route path="/chat" element={shell(<ChatPage />)} />
            <Route path="/chat/:id" element={shell(<ChatPage />)} />
            <Route path="/progetti" element={shell(<HomePage />)} />
            <Route path="/ruolo" element={shell(<RolePage />)} />
            <Route path="/archivio" element={shell(<ArchivePage />)} />
            <Route path="/impostazioni" element={shell(<SettingsPage />)} />
            <Route path="/project/:id" element={<Gate><WorkspacePage /></Gate>} />
            <Route path="*" element={<Navigate to="/chat" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
      <Toaster theme="dark" position="top-center" richColors />
    </div>
  );
}

export default App;
