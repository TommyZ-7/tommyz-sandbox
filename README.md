# TommyZ-Sandbox

研究用手・体検出 Web アプリケーションテストサイト

## 概要

このプロジェクトは、コンピュータビジョン技術を使用した手と体の検出を研究するためのテストサイトです。MediaPipe と TensorFlow を活用し、リアルタイムで手と体の動きを検出・解析できる複数のテストアプリケーションを提供しています。

## 技術スタック

- **フレームワーク**: Next.js 14, React 18
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS
- **コンピュータビジョン**:
  - MediaPipe (Hands, Tasks-Vision)
  - TensorFlow.js
  - TensorFlow Pose Detection
- **カメラ**: react-webcam
- **パッケージマネージャー**: Bun

## 機能一覧

### 手の検出テスト

#### テスト 1: 初期バージョン

- **パス**: `/kennkyu/test1`
- **技術**: MediaPipe Hands (旧バージョン)
- **機能**: 基本的な手の検出とランドマーク表示
- **最大検出数**: 2 手

#### テスト 2: ゲーム機能付き

- **パス**: `/kennkyu/test2`
- **技術**: MediaPipe Hands (旧バージョン)
- **機能**: テスト 1 にゲーム的要素を追加
- **最大検出数**: 2 手

#### テスト 3: 新バージョン MediaPipe

- **パス**: `/kennkyu/test3`
- **技術**: MediaPipe Tasks-Vision (新バージョン)
- **機能**: 最新の MediaPipe API を使用した手の検出
- **最大検出数**: 2 手
- **改善点**: GPU 加速、より高精度な検出

### 体の検出テスト

#### テスト 4: 初期バージョン

- **パス**: `/kennkyu/test4`
- **技術**: MediaPipe Pose Landmarker
- **機能**: 基本的な体のポーズ検出
- **検出数**: 1 人

#### テスト 5: TensorFlow 版

- **パス**: `/kennkyu/test5`
- **技術**: TensorFlow Pose Detection
- **機能**: 複数人の体検出が可能
- **特徴**: ライブラリを TensorFlow に変更

#### テスト 6: MoveNet 版

- **パス**: `/kennkyu/test6`
- **技術**: MoveNet (Thunder/Lightning)
- **機能**: 2 つのモデル（精度重視/速度重視）の切り替えが可能
- **特徴**: モデル選択による性能最適化

#### テスト 7: 手の位置のみ

- **パス**: `/kennkyu/test7`
- **技術**: MoveNet ベース
- **機能**: テスト 6 から手の位置のみをキャンバスに描画
- **特徴**: 手の追跡に特化した軽量版

## セットアップ

### 必要要件

- Node.js 18 以上
- Bun (推奨) または npm/yarn

### インストール

```bash
# リポジトリをクローン
git clone https://github.com/TommyZ-7/tommyz-sandbox.git
cd tommyz-sandbox

# 依存関係をインストール
bun install
# または
npm install
```

### 開発サーバーの起動

```bash
# 開発サーバーを起動
bun dev
# または
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてアプリケーションにアクセスできます。

### ビルド

```bash
# プロダクションビルド
bun run build
# または
npm run build

# プロダクションサーバーを起動
bun start
# または
npm start
```

## プロジェクト構成

```
src/
├── app/
│   ├── kennkyu/           # 研究用テストページ
│   │   ├── page.tsx       # メインページ（テスト一覧）
│   │   ├── test1/         # 手の検出テスト1
│   │   ├── test2/         # 手の検出テスト2
│   │   ├── test3/         # 手の検出テスト3（新MediaPipe）
│   │   ├── test4/         # 体の検出テスト1
│   │   ├── test5/         # 体の検出テスト2（TensorFlow）
│   │   ├── test6/         # 体の検出テスト3（MoveNet）
│   │   └── test7/         # 体の検出テスト4（手の位置のみ）
│   ├── layout.tsx
│   └── page.tsx
└── components/
    ├── test1/             # テスト1用コンポーネント
    ├── test2/             # テスト2用コンポーネント
    ├── test3/             # テスト3用コンポーネント
    ├── test4/             # テスト4用コンポーネント
    └── git/               # GitHubリポジトリカード
```

## 使用方法

1. メインページ (`/`) でプロジェクトの概要を確認
2. 研究ページ (`/kennkyu`) で利用可能なテストの一覧を表示
3. 各テストページで以下の機能をテスト:
   - Web カメラからのリアルタイム映像取得
   - 手または体の検出・追跡
   - 検出結果の可視化
   - パフォーマンス比較

## 研究用途

このプロジェクトは以下の研究目的で使用されます：

- 肢体不自由者向けのスヌーズレンソフトの開発

## ライセンス

このプロジェクトは研究目的で作成されています。

## 作者

**TommyZ-7**

- GitHub: [@TommyZ-7](https://github.com/TommyZ-7)
- Repository: [tommyz-sandbox](https://github.com/TommyZ-7/tommyz-sandbox)
