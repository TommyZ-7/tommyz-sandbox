"use client";

import { useState, useEffect, useRef } from "react";

interface ScrollProgress {
  scrollY: number;
  scrollProgress: number;
  maxScroll: number;
  // 慣性のかかった値
  smoothScrollY: number;
  smoothScrollProgress: number;
}

// 線形補間関数
const lerp = (start: number, end: number, factor: number): number => {
  return start + (end - start) * factor;
};

export const useScrollProgress = (): ScrollProgress => {
  const [scrollData, setScrollData] = useState<ScrollProgress>({
    scrollY: 0,
    scrollProgress: 0,
    maxScroll: 0,
    smoothScrollY: 0,
    smoothScrollProgress: 0,
  });

  const animationFrameRef = useRef<number>();
  const smoothValuesRef = useRef({
    smoothScrollY: 0,
    smoothScrollProgress: 0,
  });

  useEffect(() => {
    const updateScrollData = () => {
      const scrollY = window.scrollY;
      const documentHeight = document.documentElement.scrollHeight;
      const windowHeight = window.innerHeight;
      const maxScroll = documentHeight - windowHeight;
      const scrollProgress = maxScroll > 0 ? scrollY / maxScroll : 0;

      setScrollData((prev) => ({
        scrollY,
        scrollProgress: Math.min(Math.max(scrollProgress, 0), 1),
        maxScroll,
        smoothScrollY: prev.smoothScrollY,
        smoothScrollProgress: prev.smoothScrollProgress,
      }));
    };

    // 慣性を適用するアニメーションループ
    const animateSmooth = () => {
      setScrollData((prev) => {
        const lerpFactor = 0.05; // 慣性の強さ（0-1、小さいほど慣性が強い）

        // 目標値に向かって徐々に近づく
        const newSmoothScrollY = lerp(
          smoothValuesRef.current.smoothScrollY,
          prev.scrollY,
          lerpFactor
        );
        const newSmoothScrollProgress = lerp(
          smoothValuesRef.current.smoothScrollProgress,
          prev.scrollProgress,
          lerpFactor
        );

        // 参照を更新
        smoothValuesRef.current = {
          smoothScrollY: newSmoothScrollY,
          smoothScrollProgress: newSmoothScrollProgress,
        };

        return {
          ...prev,
          smoothScrollY: newSmoothScrollY,
          smoothScrollProgress: newSmoothScrollProgress,
        };
      });

      animationFrameRef.current = requestAnimationFrame(animateSmooth);
    };

    // 初回実行
    updateScrollData();
    animateSmooth();

    // スクロールイベントリスナーを追加
    const handleScroll = () => {
      requestAnimationFrame(updateScrollData);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", updateScrollData);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", updateScrollData);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return scrollData;
};
