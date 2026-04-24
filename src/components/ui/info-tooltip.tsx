import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface InfoTooltipProps {
  content: string;
  label?: string;
}

export default function InfoTooltip({
  content,
  label = "설명 보기",
}: InfoTooltipProps) {
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            className="inline-flex items-center ml-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-[260px] text-xs leading-relaxed"
        >
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
