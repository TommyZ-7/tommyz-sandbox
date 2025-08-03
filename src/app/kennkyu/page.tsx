"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ChevronRight } from "lucide-react";
import {
  researchData,
  cardVariants,
  layoutTransition,
} from "../../components/data";
import { ResearchCard } from "../../components/ResearchCard";
import { use } from "react";
import { Header } from "../../components/header";

export default function HomePage() {
  const latestResearch = researchData[researchData.length - 1];
  const latestPublication =
    latestResearch.publications[latestResearch.publications.length - 1];
  const finishedResearch = researchData.slice(0, -1);
  const router = useRouter();

  return (
    <>
      <Header />
      <section className="h-screen flex items-center justify-center text-center bg-gray-900 -mt-24">
        <div className="z-10 relative">
          <motion.h1
            className="text-5xl md:text-7xl font-extrabold text-white mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            カメラを用いたスヌーズレンの開発
          </motion.h1>
          <motion.p
            className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            私たちは、mediapipeやtensorflow.jsを活用しカメラだけでスヌーズレンを実現します。
          </motion.p>
          <motion.p
            className="text-lg md:text-xl text-gray-700 max-w-2xl mx-auto mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            Developed by Katsuya I, Tomoya T
          </motion.p>
          <motion.button
            onClick={() => router.push("/kennkyu/research")}
            className="bg-cyan-500 text-white font-bold py-3 px-8 rounded-full text-lg hover:bg-cyan-400 transition-all transform hover:scale-105 shadow-lg shadow-cyan-500/30"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.6, type: "spring" }}
          >
            成果を見る
          </motion.button>
        </div>
        <div className="absolute inset-0 bg-grid-gray-700/20 [mask-image:linear-gradient(to_bottom,white_5%,transparent_90%)]"></div>
      </section>

      {/* 最新の進捗 */}
      <section className="py-16 bg-gray-900">
        <div className="container mx-auto px-6">
          <h2 className="text-4xl font-bold text-center text-white mb-12">
            最新の進捗
          </h2>
          <motion.div
            className=""
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            transition={{ staggerChildren: 0.2 }}
          >
            {researchData.slice(-1).map((research) => {
              const latestPublication =
                research.publications[research.publications.length - 1];
              return (
                <motion.div
                  key={research.id}
                  variants={cardVariants}
                  className="bg-gray-800 rounded-lg overflow-hidden shadow-lg shadow-cyan-500/10 cursor-pointer group"
                  whileHover={{
                    y: -10,
                    boxShadow:
                      "0 20px 25px -5px rgba(6, 182, 212, 0.2), 0 10px 10px -5px rgba(6, 182, 212, 0.1)",
                  }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <a
                    href={`/kennkyu/${latestPublication.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-white mb-2">
                        {latestPublication.title}
                      </h3>
                      <p className="text-gray-400 mb-2">
                        {latestPublication.journal}
                      </p>
                      <p className="text-gray-500 text-sm mb-4">
                        {latestPublication.year}
                      </p>
                      <div className="flex items-center text-cyan-400 group-hover:text-cyan-300 transition-colors">
                        <span>成果を見る</span>
                        <ChevronRight className="w-5 h-5 ml-1 transform group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </a>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* 進行中のステップ */}
      <section className="py-16 bg-gray-900">
        <div className="container mx-auto px-6">
          <h2 className="text-4xl font-bold text-center text-white mb-12">
            進行中のステップ
          </h2>
          <Link href={`/kennkyu/research/${latestResearch.id}`}>
            <ResearchCard research={latestResearch} />
          </Link>
        </div>
      </section>

      {/* 終了済みのステップ */}
      <section className="py-16 bg-gray-900">
        <div className="container mx-auto px-6">
          <h2 className="text-4xl font-bold text-center text-white mb-12">
            終了済みのステップ
          </h2>
          <motion.div
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            transition={{ staggerChildren: 0.2 }}
          >
            {researchData.slice(0, -1).map((research) => (
              <div
                key={research.id}
                onClick={() => router.push(`/kennkyu/research/${research.id}`)}
                className="cursor-pointer"
              >
                <ResearchCard research={research} />
              </div>
            ))}
          </motion.div>
        </div>
      </section>
    </>
  );
}
