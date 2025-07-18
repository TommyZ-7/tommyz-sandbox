import Link from "next/link";
import GitHubRepoCard from "@/components/git/GitHubRepoCard";

export default function Home() {
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        <h1 className="text-3xl font-bold text-center sm:text-left">
          手の検出アプリテスト
        </h1>
        <p className="text-lg text-gray-700 text-center sm:text-left">
          手の検出を行うWebアプリケーションです。カメラを使用して手の動きをリアルタイムで検出します。
        </p>
        <div className="flex flex-col gap-4">
          <Link href="/kennkyu/test1" className="text-blue-600 hover:underline">
            テスト1:　初期バージョン（昔作ったやつ）
          </Link>
          <Link href="/kennkyu/test2" className="text-blue-600 hover:underline">
            テスト2: テスト1にゲーム的なものをつけたやつ
          </Link>
          <Link href="/kennkyu/test3" className="text-blue-600 hover:underline">
            テスト3: mediapipeの新しいバージョンを使用したやつ
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-center sm:text-left">
          体の検出アプリテスト
        </h1>
        <p className="text-lg text-gray-700 text-center sm:text-left">
          体の検出を行うWebアプリケーションです。カメラを使用して体の動きをリアルタイムで検出します。
        </p>
        <div className="flex flex-col gap-4">
          <Link href="/kennkyu/test4" className="text-blue-600 hover:underline">
            テスト4: 初期バージョン
          </Link>
          <Link href="/kennkyu/test5" className="text-blue-600 hover:underline">
            テスト5: 使用ライブラリをtensorflowに変更したやつ(複数人検出可能)
          </Link>
          <Link href="/kennkyu/test6" className="text-blue-600 hover:underline">
            テスト6:
            MoveNetを使用し、thunderとlightning、multiposeの3つのモデルを切り替え可能にしたやつ
          </Link>
          <Link href="/kennkyu/test7" className="text-blue-600 hover:underline">
            テスト7: テスト6から手の位置のみをキャンバスに描画するようにしたやつ
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-center sm:text-left">
          認識範囲指定やエフェクトの実装テスト
        </h1>
        <p className="text-lg text-gray-700 text-center sm:text-left">
          手の検出や体の検出において、認識範囲の指定やエフェクトの実装を行うテストです。
        </p>
        <div className="flex flex-col gap-4">
          <Link href="/kennkyu/test8" className="text-blue-600 hover:underline">
            テスト8: 手の認識範囲を指定できるようにしたやつ
          </Link>
          <Link href="/kennkyu/test9" className="text-blue-600 hover:underline">
            テスト9: テスト9に光がほとばしるようなエフェクトを追加したやつ
          </Link>
        </div>
        <GitHubRepoCard owner="TommyZ-7" repo="tommyz-sandbox" />
      </main>
    </div>
  );
}
