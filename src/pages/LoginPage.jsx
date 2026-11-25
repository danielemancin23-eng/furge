import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2, Lock, Mail, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Logo from "@/components/Logo";
import { useAuth, OWNER_EMAIL } from "@/lib/supabase";

export default function LoginPage() {
  const { ready, configured, session, isOwner, signIn, resetPassword } = useAuth();
  const loc = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (ready && session && isOwner) return <Navigate to={loc.state?.from || "/chat"} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) return setError("Inserisci email e password");
    setBusy(true);
    try { await signIn(email, password); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const forgot = async () => {
    if (email.trim().toLowerCase() !== OWNER_EMAIL) return setError("Scrivi prima la tua email");
    try { await resetPassword(email); toast.success("Ti ho inviato un'email per reimpostare la password"); }
    catch (err) { setError(err.message); }
  };

  return (
    <div className="relative min-h-[100dvh] grid place-items-center overflow-hidden p-5">
      <div className="absolute inset-0 forge-grid-bg pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-[420px] forge-hero-glow pointer-events-none" />
      <form onSubmit={submit} className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-7 shadow-[0_12px_40px_hsl(220_30%_2%/0.55)]" data-testid="login-form">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo size={40} withText />
          <p className="text-sm text-muted-foreground">Area privata. Accesso solo per il proprietario.</p>
        </div>
        {!configured && ready && <p className="mb-4 rounded-lg border border-[hsl(38_60%_30%)] bg-[hsl(38_40%_9%)] p-3 text-xs text-[hsl(38_60%_80%)]" data-testid="login-not-configured">Supabase non è ancora collegato: l'accesso è disattivato.</p>}
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</label>
        <div className="relative mb-4">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 pl-9 bg-background" data-testid="login-email-input" />
        </div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Password</label>
        <div className="relative mb-2">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 pl-9 pr-10 bg-background" data-testid="login-password-input" />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" data-testid="login-toggle-password">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
        </div>
        {error && <p className="mb-2 text-sm text-[hsl(0_72%_65%)]" data-testid="login-error">{error}</p>}
        <Button type="submit" className="mt-3 h-11 w-full" disabled={busy || !configured} data-testid="login-submit-button">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entra"}
        </Button>
        <button type="button" onClick={forgot} className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground" data-testid="login-forgot-button">Password dimenticata?</button>
        <p className="mt-5 text-center font-mono text-[10px] text-muted-foreground">Registrazione disattivata • noindex</p>
      </form>
    </div>
  );
}
