"use client";

import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import type { Research } from "./data";
import { cardVariants, layoutTransition } from "./data";

interface ResearchCardProps {
  research: Research;
}

export const ResearchCard = ({ research }: ResearchCardProps) => (
  <motion.div
    variants={cardVariants}
    className="bg-gray-800 rounded-lg overflow-hidden shadow-lg shadow-cyan-500/10 h-full group"
    whileHover={{
      y: -10,
      boxShadow:
        "0 20px 25px -5px rgba(6, 182, 212, 0.2), 0 10px 10px -5px rgba(6, 182, 212, 0.1)",
    }}
    transition={{ type: "spring", stiffness: 300 }}
  >
    <motion.img
      layoutId={`image-${research.id}`}
      src={research.imageUrl}
      alt={research.title}
      className="w-full h-48 object-cover"
      transition={layoutTransition}
    />
    <div className="p-6">
      <motion.h3
        layoutId={`title-${research.id}`}
        className="text-xl font-bold text-white mb-2"
        transition={layoutTransition}
      >
        {research.title}
      </motion.h3>
      <p className="text-gray-400 mb-4">{research.description}</p>
      <div className="flex items-center text-cyan-400 group-hover:text-cyan-300 transition-colors">
        <span>詳しく見る</span>
        <ChevronRight className="w-5 h-5 ml-1 transform group-hover:translate-x-1 transition-transform" />
      </div>
    </div>
  </motion.div>
);
