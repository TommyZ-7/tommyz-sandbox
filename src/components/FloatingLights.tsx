"use client";

import React, { useMemo } from "react";
import { motion, useTransform, useMotionValue } from "framer-motion";
import { useScrollProgress } from "./useScrollProgress";

interface LightParticle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
  color: string;
  scrollMultiplier: number;
  rotationDirection: number;
}

interface FloatingLightsProps {
  count?: number;
  colors?: string[];
}

export const FloatingLights: React.FC<FloatingLightsProps> = ({
  count = 30,
  colors = ["#06b6d4", "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b"],
}) => {
  const { scrollProgress, scrollY, smoothScrollProgress, smoothScrollY } =
    useScrollProgress();

  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 6 + 1,
      duration: Math.random() * 25 + 20,
      delay: Math.random() * 8,
      opacity: Math.random() * 0.8 + 0.2,
      color: colors[Math.floor(Math.random() * colors.length)],
      scrollMultiplier: Math.random() * 0.5 + 0.5, // スクロール感度
      rotationDirection: Math.random() > 0.5 ? 1 : -1, // 回転方向
    }));
  }, [count, colors]);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {particles.map((particle) => {
        // 慣性のかかったスクロールに基づく動的な値の計算
        const scrollOffsetX =
          smoothScrollProgress *
          particle.scrollMultiplier *
          80 *
          particle.rotationDirection;
        const scrollOffsetY =
          smoothScrollProgress * particle.scrollMultiplier * 40;
        const scrollOpacity = Math.max(
          particle.opacity * (1 - smoothScrollProgress * 0.2),
          0.1
        );
        const scrollScale = 1 + smoothScrollProgress * 0.3;

        // 慣性のかかったスクロール進行度に基づく色の明度変化
        const brightnessFactor = 1 + smoothScrollProgress * 0.5;

        return (
          <motion.div
            key={particle.id}
            className="absolute rounded-full"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              background: `radial-gradient(circle, ${particle.color}, transparent)`,
              boxShadow: `0 0 ${particle.size * (2 + smoothScrollProgress)}px ${
                particle.color
              }`,
              filter: `brightness(${brightnessFactor})`,
            }}
            animate={{
              x: [
                scrollOffsetX,
                scrollOffsetX + Math.random() * 200 - 100,
                scrollOffsetX + Math.random() * 200 - 100,
                scrollOffsetX,
              ],
              y: [
                scrollOffsetY,
                scrollOffsetY + Math.random() * 200 - 100,
                scrollOffsetY + Math.random() * 200 - 100,
                scrollOffsetY,
              ],
              scale: [
                scrollScale,
                scrollScale * 1.5,
                scrollScale * 0.7,
                scrollScale * 1.1,
                scrollScale,
              ],
              opacity: [
                scrollOpacity,
                scrollOpacity * 0.3,
                scrollOpacity * 0.8,
                scrollOpacity * 0.5,
                scrollOpacity,
              ],
              rotate: [
                0,
                180 * particle.rotationDirection,
                360 * particle.rotationDirection,
              ],
            }}
            transition={{
              duration: particle.duration,
              delay: particle.delay,
              repeat: Infinity,
              ease: "easeOut", // より滑らかなイージング
              repeatType: "mirror",
            }}
          />
        );
      })}

      {/* 追加のグローエフェクト - 慣性のかかったスクロール連動 */}
      {particles.slice(0, 6).map((particle) => {
        const scrollGlowOffset =
          smoothScrollProgress * 150 * particle.rotationDirection;
        const glowOpacity =
          particle.opacity * 0.25 * (1 - smoothScrollProgress * 0.4);

        return (
          <motion.div
            key={`glow-${particle.id}`}
            className="absolute rounded-full blur-lg"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.size * 4}px`,
              height: `${particle.size * 4}px`,
              background: `radial-gradient(circle, ${particle.color}15, transparent)`,
            }}
            animate={{
              x: [
                scrollGlowOffset,
                scrollGlowOffset + Math.random() * 100 - 50,
                scrollGlowOffset + Math.random() * 100 - 50,
                scrollGlowOffset,
              ],
              y: [
                smoothScrollProgress * 30,
                smoothScrollProgress * 30 + Math.random() * 100 - 50,
                smoothScrollProgress * 30 + Math.random() * 100 - 50,
                smoothScrollProgress * 30,
              ],
              scale: [
                1 + smoothScrollProgress * 0.5,
                1.8 + smoothScrollProgress * 0.5,
                1.2 + smoothScrollProgress * 0.5,
                1 + smoothScrollProgress * 0.5,
              ],
              opacity: [
                glowOpacity,
                glowOpacity * 0.2,
                glowOpacity * 0.6,
                glowOpacity,
              ],
            }}
            transition={{
              duration: particle.duration * 1.3,
              delay: particle.delay + 1,
              repeat: Infinity,
              ease: "easeOut",
              repeatType: "mirror",
            }}
          />
        );
      })}

      {/* 慣性のかかったスクロールに応じた追加エフェクト */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 50% ${
            50 + smoothScrollProgress * 20
          }%, rgba(59, 130, 246, ${
            smoothScrollProgress * 0.08
          }), transparent 60%)`,
          transform: `translateY(${smoothScrollProgress * -10}px)`,
        }}
        animate={{
          opacity: [0.4, 0.7, 0.4],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeOut",
          repeatType: "mirror",
        }}
      />
    </div>
  );
};
