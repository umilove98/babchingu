// 로그인 화면 등 빈 배경에 두는 떠다니는 음식 이모지 일러스트
"use client";

import { useEffect, useState } from "react";

const FOODS = ["🍱", "🍙", "🍣", "🍡", "🍓", "🥕", "🍎", "🌽", "🥐", "🍪", "🍩", "🥢", "🍜", "🥟", "🍵"];

type Floater = { emoji: string; left: number; top: number; size: number; delay: number; dur: number };

export function FoodConfetti({ density = 16 }: { density?: number }) {
  const [items, setItems] = useState<Floater[] | null>(null);

  useEffect(() => {
    const arr: Floater[] = Array.from({ length: density }, () => ({
      emoji: FOODS[Math.floor(Math.random() * FOODS.length)],
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: 18 + Math.random() * 28,
      delay: Math.random() * 4,
      dur: 5 + Math.random() * 4,
    }));
    setItems(arr);
  }, [density]);

  if (!items) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
      {items.map((f, i) => (
        <span
          key={i}
          className="absolute opacity-40 select-none"
          style={{
            left: `${f.left}%`,
            top: `${f.top}%`,
            fontSize: `${f.size}px`,
            animation: `float-bob ${f.dur}s ease-in-out ${f.delay}s infinite alternate`,
          }}
        >
          {f.emoji}
        </span>
      ))}
      <style jsx global>{`
        @keyframes float-bob {
          from { transform: translateY(0) rotate(-6deg); }
          to   { transform: translateY(-18px) rotate(6deg); }
        }
      `}</style>
    </div>
  );
}
