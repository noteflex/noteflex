import { Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getUserTier } from "@/lib/subscriptionTier";

export function PremiumBadge() {
  const { user, profile } = useAuth();
  if (getUserTier(user, profile) !== "pro") return null;
  return (
    <span className="flex items-center gap-0.5 text-[10px] font-semibold bg-gradient-to-r from-amber-400 to-orange-400 text-white px-1.5 py-0.5 rounded-full">
      <Sparkles className="h-2.5 w-2.5" /> Premium
    </span>
  );
}
