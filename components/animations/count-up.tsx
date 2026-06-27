"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";

gsap.registerPlugin(useGSAP);

interface CountUpProps {
  to: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}

export function CountUp({
  to,
  duration = 1.5,
  suffix = "",
  prefix = "",
  className,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const counter = useRef({ val: 0 });

  useGSAP(
    () => {
      counter.current.val = 0;
      gsap.to(counter.current, {
        val: to,
        duration,
        ease: "power2.out",
        onUpdate: () => {
          if (ref.current) {
            ref.current.textContent =
              prefix + Math.round(counter.current.val).toLocaleString() + suffix;
          }
        },
      });
    },
    { scope: ref, dependencies: [to] }
  );

  return (
    <span ref={ref} className={className}>
      {prefix}0{suffix}
    </span>
  );
}
