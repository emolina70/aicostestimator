import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyRole } from "@/lib/analysis.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Gauge, History, FolderKanban, Settings, LogOut, Menu, X, Sparkles, ShieldCheck, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Painel", icon: Gauge },
  { to: "/analyze", label: "Analisar prompt", icon: Sparkles },
  { to: "/optimize", label: "Otimizar prompt", icon: Wand2 },
  { to: "/history", label: "Histórico", icon: History },

  { to: "/projects", label: "Projetos", icon: FolderKanban },
  { to: "/settings", label: "Conta", icon: Settings },
] as const;

const ADMIN_NAV = { to: "/admin", label: "Admin", icon: ShieldCheck } as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const fetchRole = useServerFn(getMyRole);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setHasSession(Boolean(data.session));
    });
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      setHasSession(Boolean(session));
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const { data: role } = useQuery({
    queryKey: ["my-role"],
    queryFn: async () => {
      try {
        return await fetchRole({});
      } catch {
        return { isAdmin: false };
      }
    },
    enabled: hasSession,
    retry: false,
  });
  const nav = role?.isAdmin ? [...NAV, ADMIN_NAV] : [...NAV];

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Gauge className="size-4" />
            </span>
            <span className="font-display text-sm font-semibold sm:text-base">
              AI Dev Cost Optimizer
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {nav.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                  pathname.startsWith(to) && "bg-secondary text-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="hidden lg:inline-flex" onClick={signOut}>
              <LogOut className="size-4" /> Sair
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Abrir menu"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
          </div>
        </div>

        {open && (
          <nav className="border-t border-border px-4 pb-4 pt-2 lg:hidden">
            {nav.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground",
                  pathname.startsWith(to) && "bg-secondary text-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            ))}
            <Button variant="ghost" className="mt-1 w-full justify-start" onClick={signOut}>
              <LogOut className="size-4" /> Sair
            </Button>
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
