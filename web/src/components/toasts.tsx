"use client";

import { AnimatePresence, motion } from "framer-motion";

export function Toasts({ messages }: { messages: string[] }) {
  return (
    <div className="toasts" aria-live="polite">
      <AnimatePresence>
        {messages.map((message) => (
          <motion.p
            key={message}
            className="toast"
            role="status"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
          >
            {message}
          </motion.p>
        ))}
      </AnimatePresence>
    </div>
  );
}
