import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import { Button } from "./ui/button";

export function MatchBanner({ name, onOpen }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-[var(--radius-md)] border border-[hsl(var(--accent))]/30 bg-card p-4 shadow-[var(--shadow-sm)] flex items-center justify-between gap-3"
      data-testid="match-banner"
    >
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-[hsl(var(--accent))]/15 text-[hsl(var(--accent))]">
          <Heart className="h-4 w-4" />
        </div>
        <div>
          <div className="font-display text-lg leading-tight">It’s a match with {name}</div>
          <div className="text-sm text-[hsl(var(--muted-foreground))]">
            Say hi — chat is now unlocked.
          </div>
        </div>
      </div>
      <Button onClick={onOpen} data-testid="match-banner-say-hi-button">Say hi</Button>
    </motion.div>
  );
}
