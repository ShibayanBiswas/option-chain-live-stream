"use client";

import { Moon, Sun } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { useTheme } from "@/lib/theme";

export function ThemeToggle() {
  const { theme, toggle, mounted } = useTheme();
  const reduce = useReducedMotion();
  if (!mounted) {
    return <div className="h-9 w-9 rounded-full border border-border" />;
  }

  return (
    <motion.button
      aria-label="Toggle theme"
      className="font-ui inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-ink transition hover:border-gold"
      onClick={toggle}
      type="button"
      whileTap={reduce ? undefined : { scale: 0.92 }}
    >
      {theme === "dark" ? <Sun className="h-4 w-4 text-gold" /> : <Moon className="h-4 w-4 text-maroon" />}
    </motion.button>
  );
}
