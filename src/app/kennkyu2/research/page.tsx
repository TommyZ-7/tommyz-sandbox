"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { researchData } from "../../../components/data";
import { ResearchCard } from "../../../components/ResearchCard";
import { Header } from "../../../components/header";
import { ArrowLeft } from "lucide-react";

export default function ResearchListPage() {
  return (
    <>
      <Header />
      <div className="container mx-auto px-6 mt-24">
        <Link href="/kennkyu2">
          <motion.div
            className="flex items-center text-cyan-400 hover:text-cyan-300 mb-8 transition-colors cursor-pointer"
            whileHover={{ x: -5 }}
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            ホームに戻る
          </motion.div>
        </Link>
        <h1 className="text-4xl font-bold text-white mb-2">研究進捗</h1>
        <p className="text-gray-400 mb-12">
          研究に関する進捗状況です。左上のものが最新の研究です。
        </p>
        <motion.div
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
          initial="hidden"
          animate="visible"
          transition={{ staggerChildren: 0.15 }}
        >
          {researchData
            .slice()
            .reverse()
            .map((research) => (
              <Link
                href={`/kennkyu2/research/${research.id}`}
                key={research.id}
              >
                <ResearchCard research={research} />
              </Link>
            ))}
        </motion.div>
      </div>
    </>
  );
}
