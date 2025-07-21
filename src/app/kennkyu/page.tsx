"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  Users,
  FlaskConical,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

// 型定義 (本来は /types/index.ts などに配置)
//============================================
type Publication = {
  id: number;
  title: string;
  journal: string;
  year: number;
  url?: string;
};

type Research = {
  id: string;
  title: string;
  description: string;
  longDescription: string;
  imageUrl: string;
  publications: Publication[];
};

// モックデータ (本来は /data/researchData.ts などに配置)
//============================================
const researchData: Research[] = [
  {
    id: "first-step",
    title: "手の検出テスト",
    description:
      "web上でmediapipeを用いて手の検出を行い、スヌーズレンの基礎技術を構築する。",
    longDescription:
      "本ステップでは、Googleのmediapipeライブラリを使用して、ウェブカメラからの映像をリアルタイムで解析し、手の位置と動きを検出する技術を開発します。これにより、ユーザーはソフトをインストールすることなく、ブラウザ上で手の動きをトラッキングできるようになります。",
    imageUrl:
      "https://placehold.co/600x400/1a1a2e/e0e0e0?text=Hand+Detection+Test",
    publications: [
      {
        id: 1,
        title: "test1: 初期バージョン",
        journal: "昔作ったやつ",
        year: 2025,
        url: "test1",
      },
      {
        id: 2,
        title: "test2: ゲーム性の追加",
        journal: "両手を用いたボールキャッチゲーム",
        year: 2025,
        url: "test2",
      },
      {
        id: 3,
        title: "test3: 使用ライブラリの更新",
        journal: "ライブラリの実装を最新版に移行",
        year: 2025,
        url: "test3",
      },
    ],
  },
  {
    id: "second-step",
    title: "体の検出テスト",
    description:
      "mediapipeやtensorflow.jsを用いて体の検出を行い、スヌーズレンの基礎技術を構築する。",
    longDescription:
      "本ステップでは、mediapipeとtensorflow.jsを活用し、カメラ映像から体全体の動きを検出する技術を開発します。これにより、ユーザーはソフトをインストールすることなく、ブラウザ上で体の動きをトラッキングできるようになります。特に、体の各部位の位置や動きを高精度で検出し、スヌーズレン体験を向上させるための基盤技術を構築します。",
    imageUrl:
      "https://placehold.co/600x400/1a1a2e/e0e0e0?text=Body+Detection+Test",
    publications: [
      {
        id: 1,
        title: "test4: 初期バージョン",
        journal: "mediapipeを用いた体の検出",
        year: 2025,
        url: "test4",
      },
      {
        id: 2,
        title: "test5: 使用ライブラリをmediapipeからtensorflow.jsに変更",
        journal: "mediapipeでは複数人の検出が難しいため、tensorflow.jsへ変更",
        year: 2025,
        url: "test5",
      },
      {
        id: 3,
        title: "test6: モデル変更機能の追加",
        journal: "TensorFlow.jsを用いた体の検出モデルの変更機能",
        year: 2025,
        url: "test6",
      },
      {
        id: 4,
        title: "test7: 手の位置のみ別キャンバスへ描画",
        journal: "",
        year: 2025,
        url: "test7",
      },
    ],
  },
  {
    id: "third-step",
    title: "認識範囲指定やエフェクトなどの実装テスト",
    description:
      "mediapipeやtensorflow.jsを用いて、認識範囲の指定やエフェクトの実装を行い、スヌーズレンの基礎技術を構築する。",
    longDescription:
      "本ステップでは、mediapipeやtensorflow.jsを用いて、ユーザーが認識範囲を指定できる機能や、特定のエフェクトを適用できる機能を実装します。",
    imageUrl:
      "https://placehold.co/600x400/1a1a2e/e0e0e0?text=Recognition+and+Effects",
    publications: [
      {
        id: 1,
        title: "test8: 認識範囲指定機能の追加",
        journal:
          "プロジェクターで写した範囲のみ認識するための機能、またホモグラフィ変換を用いた手の位置のみを別キャンバスへ描画する機能",
        year: 2025,
        url: "test8",
      },
      {
        id: 2,
        title: "test9: エフェクト機能の追加",
        journal: "手の位置にエフェクトを適用する機能",
        year: 2025,
        url: "test9",
      },
      {
        id: 3,
        title: "test10: 音声の追加",
        journal: "手の動きに応じて音声を再生する機能",
        year: 2025,
        url: "test10",
      },
    ],
  },
];

// アニメーション設定
//============================================
const pageVariants = {
  initial: { opacity: 0 },
  in: { opacity: 1 },
  out: { opacity: 0 },
};

const pageTransition = {
  type: "tween" as const,
  ease: "easeInOut" as const,
  duration: 0.4,
};

const cardVariants = {
  hidden: { opacity: 0, y: 50 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const layoutTransition = {
  type: "spring" as const,
  stiffness: 250,
  damping: 25,
};

// UIコンポーネント
//============================================
const Header = ({
  onNavigate,
  currentPage,
}: {
  onNavigate: (page: string) => void;
  currentPage: string;
}) => (
  <header className="fixed top-0 left-0 right-0 bg-gray-900 bg-opacity-80 backdrop-blur-md z-50 border-b border-gray-700">
    <div className="container mx-auto px-6 py-4 flex justify-between items-center">
      <div
        className="text-2xl font-bold text-white cursor-pointer flex items-center gap-2"
        onClick={() => onNavigate("home")}
      >
        <FlaskConical className="text-cyan-400" />
        <span>粂野研究室</span>
      </div>
      <nav className="hidden md:flex items-center space-x-6">
        <button
          onClick={() => onNavigate("home")}
          className={`text-lg ${
            currentPage === "home" ? "text-cyan-400" : "text-gray-300"
          } hover:text-cyan-400 transition-colors`}
        >
          ホーム
        </button>
        <button
          onClick={() => onNavigate("research")}
          className={`text-lg ${
            currentPage.startsWith("research")
              ? "text-cyan-400"
              : "text-gray-300"
          } hover:text-cyan-400 transition-colors`}
        >
          進捗状況
        </button>
      </nav>
      <button className="md:hidden text-white">
        <Users />
      </button>
    </div>
  </header>
);

const ResearchCard = ({
  research,
  onClick,
}: {
  research: Research;
  onClick: () => void;
}) => (
  <motion.div
    variants={cardVariants}
    className="bg-gray-800 rounded-lg overflow-hidden shadow-lg shadow-cyan-500/10 cursor-pointer group"
    onClick={onClick}
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

// ページコンポーネント
//============================================
const HomePage = ({ onNavigate }: { onNavigate: (page: string) => void }) => (
  <motion.div
    initial="initial"
    animate="in"
    exit="out"
    variants={pageVariants}
    transition={pageTransition}
  >
    {/* ヒーローセクション */}
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
          onClick={() => onNavigate("research")}
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
                onClick={() =>
                  latestPublication.url &&
                  window.open(`/kennkyu/${latestPublication.url}`, "_blank")
                }
                whileHover={{
                  y: -10,
                  boxShadow:
                    "0 20px 25px -5px rgba(6, 182, 212, 0.2), 0 10px 10px -5px rgba(6, 182, 212, 0.1)",
                }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <div className="p-6">
                  <motion.h3
                    layoutId={`title-${research.id}`}
                    className="text-xl font-bold text-white mb-2"
                    transition={layoutTransition}
                  >
                    {latestPublication.title}
                  </motion.h3>
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
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>

    <section className="py-16 bg-gray-900">
      <div className="container mx-auto px-6">
        <h2 className="text-4xl font-bold text-center text-white mb-12">
          進行中のステップ
        </h2>
        <motion.div
          className=""
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          transition={{ staggerChildren: 0.2 }}
        >
          {researchData.slice(-1).map((research) => (
            <ResearchCard
              key={research.id}
              research={research}
              onClick={() => onNavigate(`research/${research.id}`)}
            />
          ))}
        </motion.div>
      </div>
    </section>

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
            <ResearchCard
              key={research.id}
              research={research}
              onClick={() => onNavigate(`research/${research.id}`)}
            />
          ))}
        </motion.div>
      </div>
    </section>
  </motion.div>
);

const ResearchListPage = ({
  onNavigate,
}: {
  onNavigate: (page: string) => void;
}) => (
  <motion.div
    className="container mx-auto px-6 pt-24"
    initial="initial"
    animate="in"
    exit="out"
    variants={pageVariants}
    transition={pageTransition}
  >
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
          <ResearchCard
            key={research.id}
            research={research}
            onClick={() => onNavigate(`research/${research.id}`)}
          />
        ))}
    </motion.div>
  </motion.div>
);

const ResearchDetailPage = ({
  researchId,
  onNavigate,
}: {
  researchId: string;
  onNavigate: (page: string) => void;
}) => {
  const research = researchData.find((r) => r.id === researchId);

  if (!research) {
    return (
      <div className="container mx-auto px-6 pt-24 text-white text-center">
        <h1 className="text-2xl">研究が見つかりませんでした。</h1>
        <button
          onClick={() => onNavigate("research")}
          className="text-cyan-400 mt-4"
        >
          研究一覧へ戻る
        </button>
      </div>
    );
  }

  return (
    <motion.div
      className="container mx-auto px-6 pt-24"
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
    >
      <motion.button
        onClick={() => onNavigate("research")}
        className="flex items-center text-cyan-400 hover:text-cyan-300 mb-8 transition-colors"
        whileHover={{ x: -5 }}
      >
        <ArrowLeft className="w-5 h-5 mr-2" />
        研究一覧へ戻る
      </motion.button>

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
              <h3 className="text-lg font-semibold text-white">{pub.title}</h3>

              <p className="text-gray-500 text-sm mt-2">
                <em>{pub.journal}</em>, {pub.year}
              </p>
              {pub.url && (
                <Link
                  href={`/kennkyu/${pub.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:underline mt-2 inline-block"
                >
                  成果を見る
                </Link>
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

interface PagePathHandler {
  (path: string): string;
}

const getPageFromPath: PagePathHandler = (path: string): string => {
  const cleanPath = path.substring(1); // 先頭の'/'を削除
  if (cleanPath === "" || cleanPath === "home") return "home";
  return cleanPath;
};
// メインのAppコンポーネント (Next.jsのルーティングをシミュレート)
//============================================
export default function App() {
  // 'home', 'research', 'research/id' のような形式でページを管理
  const [page, setPage] = useState(() =>
    getPageFromPath(window.location.pathname)
  );

  useEffect(() => {
    // ブラウザの戻る/進むボタンが押されたときの処理
    const handlePopState = () => {
      setPage(getPageFromPath(window.location.pathname));
    };

    window.addEventListener("popstate", handlePopState);

    // コンポーネントがアンマウントされるときにイベントリスナーを削除
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  interface NavigateHandler {
    (newPage: string): void;
  }

  const handleNavigate: NavigateHandler = (newPage: string) => {
    const path = newPage === "home" ? "/" : `/${newPage}`;
    // 現在のパスと同じ場合は何もしない
    if (window.location.pathname === path) return;

    // ブラウザの履歴に新しい状態を追加し、URLを更新
    window.history.pushState({}, "", path);
    setPage(newPage);
  };

  const renderPage = () => {
    const [pageName, pageId] = page.split("/");

    switch (pageName) {
      case "home":
        return <HomePage onNavigate={handleNavigate} />;
      case "research":
        if (pageId) {
          return (
            <ResearchDetailPage
              researchId={pageId}
              onNavigate={handleNavigate}
            />
          );
        }
        return <ResearchListPage onNavigate={handleNavigate} />;
      default:
        return <HomePage onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="bg-gray-900 min-h-screen font-sans text-gray-200">
      <Header onNavigate={handleNavigate} currentPage={page} />
      <main className="pt-24">
        {/* `mode="wait"` を削除し、レイアウトアニメーションを有効化 */}
        <AnimatePresence mode="wait">
          {/* keyを渡すことで、Reactにコンポーネントが変更されたことを伝え、再レンダリングとアニメーションをトリガーする */}
          {React.cloneElement(renderPage(), { key: page })}
        </AnimatePresence>
      </main>
    </div>
  );
}
