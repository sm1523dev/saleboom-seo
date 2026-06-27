"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

interface StaggerChildrenProps {
  children: React.ReactNode;
  stagger?: number;
  y?: number;
  className?: string;
}

export function StaggerChildren({
  children,
  stagger = 0.08,
  y = 24,
  className,
}: StaggerChildrenProps) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;

      gsap.fromTo(
        Array.from(el.children),
        { opacity: 0, y },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          stagger,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 85%", once: true },
        }
      );
    },
    { scope: ref }
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
