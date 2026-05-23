import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/LanguageContext";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, LayoutDashboard, LogOut, UserCog, Sparkles } from "lucide-react";

export default function UserMenu() {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const t = useT();

  if (loading || !user) return null;

  const nickname = profile?.nickname ?? "";
  const email = profile?.email ?? user.email ?? "";
  const isAutoNickname = nickname.startsWith("user_");
  const displayName = (!nickname || isAutoNickname) ? (email.split("@")[0] || "user") : nickname;
  const isPremium = !!profile?.is_premium;

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 max-w-[40vw] rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="truncate">{displayName}</span>
          <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {isPremium && (
          <>
            <DropdownMenuLabel className="flex items-center gap-1.5 text-amber-600">
              <Sparkles className="w-4 h-4" aria-hidden="true" /> {t.userMenu.premiumActive}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem asChild>
          <Link to="/profile" className="cursor-pointer">
            <UserCog className="w-4 h-4 mr-2" aria-hidden="true" /> {t.userMenu.profile}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/dashboard" className="cursor-pointer">
            <LayoutDashboard className="w-4 h-4 mr-2" aria-hidden="true" /> {t.userMenu.dashboard}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="w-4 h-4 mr-2" aria-hidden="true" /> {t.userMenu.logout}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
