"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { researchData, layoutTransition } from "../../../../components/data";
import { ArrowLeft, BookOpen } from "lucide-react";
import { Header } from "../../../../components/header";

interface DetailPageProps {
  params: {
    id: string;
  };
}

export default function ResearchDetailPage({ params }: DetailPageProps) {
  const research = researchData.find((r) => r.id === params.id);

  if (!research) {
    return (
      <div className="container mx-auto px-6 text-white text-center">
        <h1 className="text-2xl">研究が見つかりませんでした。</h1>
        <Link href="/research" className="text-cyan-400 mt-4 inline-block">
          研究一覧へ戻る
        </Link>
      </div>
    );
  }

  return (
    <>
      <Header />
      <div className="container mx-auto px-6 mt-24">
        <motion.div
          className="flex items-center text-cyan-400 hover:text-cyan-300 mb-8 transition-colors cursor-pointer"
          whileHover={{ x: -5 }}
          onClick={() => window.history.back()}
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          戻る
        </motion.div>

        <div className="lg:grid lg:grid-cols-3 lg:gap-12">
          <div className="lg:col-span-2">
            <motion.h1
              layoutId={`title-${research.id}`}
              className="text-4xl font-bold text-white mb-4"
              transition={layoutTransition}
            >
              {research.title}
            </motion.h1>
            <motion.p
              className="text-gray-300 leading-relaxed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              {research.longDescription}
            </motion.p>
          </div>
          <div className="mt-8 lg:mt-0">
            <motion.img
              layoutId={`image-${research.id}`}
              src={research.imageUrl}
              alt={research.title}
              className="rounded-lg shadow-lg w-full"
              transition={layoutTransition}
            />
          </div>
        </div>

        <motion.div
          className="mt-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <h2 className="text-3xl font-bold text-white mb-6 flex items-center">
            <BookOpen className="w-7 h-7 mr-3 text-cyan-400" />
            関連成果
          </h2>
          <div className="space-y-6">
            {research.publications.map((pub, index) => (
              <motion.div
                key={pub.id}
                className="bg-gray-800 p-6 rounded-lg border border-gray-700 hover:border-cyan-500 transition-colors"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 + index * 0.1 }}
              >
                <h3 className="text-lg font-semibold text-white">
                  {pub.title}
                </h3>

                <p className="text-gray-500 text-sm mt-2">
                  <em>{pub.journal}</em>, {pub.year}
                </p>
                {pub.url && (
                  <a
                    href={`/kennkyu/${pub.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:underline mt-2 inline-block"
                  >
                    実行
                  </a>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </>
  );
}
