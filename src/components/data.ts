export type Publication = {
  id: number;
  title: string;
  journal: string;
  year: number;
  url?: string;
};

export type Research = {
  id: string;
  title: string;
  description: string;
  longDescription: string;
  imageUrl: string;
  publications: Publication[];
};

// モックデータ
export const researchData: Research[] = [
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
export const layoutTransition = {
  type: "spring" as const,
  stiffness: 250,
  damping: 25,
};

export const cardVariants = {
  hidden: { opacity: 0, y: 50 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};
