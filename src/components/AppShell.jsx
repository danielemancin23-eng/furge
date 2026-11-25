import { NavLink, useNavigate } from "react-router-dom";
import { MessageSquare, FolderKanban, UserCog, Archive, Settings, LogOut, Circle } from "lucide-react";
import Logo from "@/components/Logo";
import { useAuth, useSettings } from "@/lib/supabase";

export const NAV = [
  { to: "/chat", label: "Chat", icon: MessageSquare },
  { to: "/progetti", label: "Progetti", icon: FolderKanban },
  { to: "/ruolo", label: "Ruolo", icon: UserCog },
  { to: "/archivio", label: "Archivio", icon: Archive },
  { to: "/impostazioni", label: "Impostazioni", short: "Opzioni", icon: Settings },
];

function ModelStatus() {
  const { settings, configured } = useSettings();
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate("/impostazioni")} className="flex w-full items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-left hover:border-primary/50" data-testid="sidebar-model-status">
      <Circle className={`h-2.5 w-2.5 shrink-0 ${configured ? "fill-[hsl(155_70%_42%)] text-[hsl(155_70%_42%)]" : "fill-[hsl(38_92%_55%)] text-[hsl(38_92%_55%)]"}`} />
      <span className="min-w-0">
        <span className="block truncate font-mono text-[11px]">{configured ? settings.model_name : "Modello non configurato"}</span>
        <span className="block text-[10px] text-muted-foreground">{configured ? (settings.connection_mode === "server" ? "via server" : "dal dispositivo") : "Apri Impostazioni"}</span>
      </span>
    </button>
  );
}

export default function AppShell({ children }) {
  const { email, signOut } = useAuth();
  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-[hsl(var(--panel))]" data-testid="desktop-sidebar">
        <div className="flex h-16 items-center px-5"><Logo size={30} withText /></div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} data-testid={`sidebar-nav-${label.toLowerCase()}`}
              className={({ isActive }) => `relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"}`}>
              {({ isActive }) => (<>
                {isActive && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-primary shadow-[0_0_10px_hsl(190_90%_45%/0.6)]" />}
                <Icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />{label}
              </>)}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-2 border-t border-border p-3">
          <ModelStatus />
          <div className="flex items-center gap-2 px-1">
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" data-testid="sidebar-email">{email}</span>
            <button onClick={signOut} title="Esci" className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" data-testid="sidebar-logout-button"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="lg:hidden flex h-12 shrink-0 items-center justify-between border-b border-border bg-background px-4">
          <Logo size={24} withText />
          <button onClick={signOut} className="rounded-md p-1.5 text-muted-foreground" title="Esci" data-testid="mobile-logout-button"><LogOut className="h-4 w-4" /></button>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto forge-scroll pb-[calc(64px+env(safe-area-inset-bottom))] lg:pb-0" data-testid="app-main">{children}</main>
      </div>

      <nav className="lg:hidden fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-border bg-[hsl(220_14%_6%)] pb-[env(safe-area-inset-bottom)]" data-testid="mobile-bottom-nav">
        {NAV.map(({ to, label, short, icon: Icon }) => (
          <NavLink key={to} to={to} data-testid={`bottom-nav-${label.toLowerCase()}`}
            className={({ isActive }) => `flex h-16 flex-col items-center justify-center gap-1 text-[11px] transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`}>
            <Icon className="h-5 w-5" />{short || label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
