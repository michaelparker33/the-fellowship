"use client";

import { useEffect, useState } from "react";

const WORDS = "One Fellowship to find them, one wizard to guide them.".split(" ");

export function LoadingScreen() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (visibleCount < WORDS.length) {
      const t = setTimeout(() => setVisibleCount((c) => c + 1), 120);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => setFading(true), 800);
      return () => clearTimeout(t);
    }
  }, [visibleCount]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-background transition-opacity duration-1000 ${fading ? "opacity-0 pointer-events-none" : "opacity-100"}`}
    >
      <p className="font-serif italic text-muted-foreground text-lg text-center max-w-sm px-6 leading-relaxed">
        {WORDS.map((word, i) => (
          <span
            key={i}
            className={`inline-block mr-1.5 transition-opacity duration-300 ${i < visibleCount ? "opacity-100" : "opacity-0"}`}
          >
            {word}
          </span>
        ))}
      </p>
    </div>
  );
}
