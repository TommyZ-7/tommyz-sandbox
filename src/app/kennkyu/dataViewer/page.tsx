"use client";

import { useState, useRef } from "react";

// ポーズデータの型定義
interface PoseData {
  startTime: number;
  memo?: string;
  poses: Array<{
    timestamp: number;
    keypoints: Array<{
      x: number;
      y: number;
      score: number;
      name: string;
    }>;
  }>;
}

// 手のランドマークデータの型定義
interface HandData {
  startTime: number;
  memo?: string;
  hands: Array<{
    timestamp: number;
    landmarks: Array<{
      x: number;
      y: number;
      z: number;
      handedness: string;
      index: number;
    }>;
  }>;
}

// 統合されたデータ型
type DetectionData = PoseData | HandData;

// 動きの強度計算（ポーズデータ用）
const calculateMovementIntensity = (
  currentPose: PoseData["poses"][0],
  previousPose: PoseData["poses"][0] | null
): number => {
  if (!previousPose) return 0;

  let totalMovement = 0;
  let validPoints = 0;

  currentPose.keypoints.forEach((currentKp, index) => {
    const prevKp = previousPose.keypoints[index];
    if (currentKp && prevKp && currentKp.score > 0.5 && prevKp.score > 0.5) {
      const distance = Math.sqrt(
        Math.pow(currentKp.x - prevKp.x, 2) +
          Math.pow(currentKp.y - prevKp.y, 2)
      );
      totalMovement += distance;
      validPoints++;
    }
  });

  return validPoints > 0 ? totalMovement / validPoints : 0;
};

// 動きの強度計算（手のデータ用）
const calculateHandMovementIntensity = (
  currentHand: HandData["hands"][0],
  previousHand: HandData["hands"][0] | null
): number => {
  if (!previousHand) return 0;

  let totalMovement = 0;
  let validPoints = 0;

  // 手首（インデックス0）と指先のランドマークを重視
  const importantLandmarks = [0, 4, 8, 12, 16, 20]; // 手首と各指の先端

  currentHand.landmarks.forEach((currentLm) => {
    const prevLm = previousHand.landmarks.find(
      (p) =>
        p.index === currentLm.index && p.handedness === currentLm.handedness
    );
    if (prevLm) {
      const distance = Math.sqrt(
        Math.pow(currentLm.x - prevLm.x, 2) +
          Math.pow(currentLm.y - prevLm.y, 2) +
          Math.pow(currentLm.z - prevLm.z, 2) * 0.5 // Z軸の重みを軽くする
      );

      // 重要なランドマークの動きを重視
      const weight = importantLandmarks.includes(currentLm.index) ? 2 : 1;
      totalMovement += distance * weight;
      validPoints += weight;
    }
  });

  return validPoints > 0 ? totalMovement / validPoints : 0;
};

// データタイプの判定
const isHandData = (data: DetectionData): data is HandData => {
  return "hands" in data;
};

const isPoseData = (data: DetectionData): data is PoseData => {
  return "poses" in data;
};

// 色の計算（動きの強度に応じて青→緑→黄→赤）
const getIntensityColor = (intensity: number, maxIntensity: number): string => {
  if (maxIntensity === 0) return "rgb(0, 100, 200)"; // デフォルトの青

  const normalizedIntensity = Math.min(intensity / maxIntensity, 1);

  if (normalizedIntensity < 0.33) {
    // 青から緑へ
    const ratio = normalizedIntensity / 0.33;
    const r = Math.round(0 * (1 - ratio) + 0 * ratio);
    const g = Math.round(100 * (1 - ratio) + 255 * ratio);
    const b = Math.round(200 * (1 - ratio) + 0 * ratio);
    return `rgb(${r}, ${g}, ${b})`;
  } else if (normalizedIntensity < 0.66) {
    // 緑から黄へ
    const ratio = (normalizedIntensity - 0.33) / 0.33;
    const r = Math.round(0 * (1 - ratio) + 255 * ratio);
    const g = Math.round(255 * (1 - ratio) + 255 * ratio);
    const b = Math.round(0 * (1 - ratio) + 0 * ratio);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // 黄から赤へ
    const ratio = (normalizedIntensity - 0.66) / 0.34;
    const r = Math.round(255 * (1 - ratio) + 255 * ratio);
    const g = Math.round(255 * (1 - ratio) + 0 * ratio);
    const b = Math.round(0 * (1 - ratio) + 0 * ratio);
    return `rgb(${r}, ${g}, ${b})`;
  }
};

const DataViewer = (): JSX.Element => {
  const [detectionData, setDetectionData] = useState<DetectionData | null>(
    null
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ファイル読み込み
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as DetectionData;
        setDetectionData(data);
      } catch (error) {
        alert("JSONファイルの読み込みに失敗しました。");
        console.error("JSON parse error:", error);
      }
    };
    reader.readAsText(file);
  };

  // タイムライン用のデータ処理
  const processTimelineData = (data: DetectionData) => {
    const intensities: number[] = [];

    if (isPoseData(data)) {
      for (let i = 0; i < data.poses.length; i++) {
        const currentPose = data.poses[i];
        const previousPose = i > 0 ? data.poses[i - 1] : null;
        const intensity = calculateMovementIntensity(currentPose, previousPose);
        intensities.push(intensity);
      }
    } else if (isHandData(data)) {
      for (let i = 0; i < data.hands.length; i++) {
        const currentHand = data.hands[i];
        const previousHand = i > 0 ? data.hands[i - 1] : null;
        const intensity = calculateHandMovementIntensity(
          currentHand,
          previousHand
        );
        intensities.push(intensity);
      }
    }

    const maxIntensity = Math.max(...intensities);
    return { intensities, maxIntensity };
  };

  // データの統計情報
  const getDataStats = (data: DetectionData) => {
    let duration = 0;
    let totalCount = 0;
    let dataType = "";

    if (isPoseData(data)) {
      duration =
        data.poses.length > 0
          ? data.poses[data.poses.length - 1].timestamp / 1000
          : 0;
      totalCount = data.poses.length;
      dataType = "ポーズ";
    } else if (isHandData(data)) {
      duration =
        data.hands.length > 0
          ? data.hands[data.hands.length - 1].timestamp / 1000
          : 0;
      totalCount = data.hands.length;
      dataType = "手";
    }

    const { intensities } = processTimelineData(data);
    const avgIntensity =
      intensities.length > 0
        ? intensities.reduce((sum, val) => sum + val, 0) / intensities.length
        : 0;
    const maxIntensity = intensities.length > 0 ? Math.max(...intensities) : 0;

    return {
      totalCount,
      dataType,
      duration: duration.toFixed(1),
      avgIntensity: avgIntensity.toFixed(2),
      maxIntensity: maxIntensity.toFixed(2),
      startTime: new Date(data.startTime).toLocaleString("ja-JP"),
      hasMemo: !!data.memo,
    };
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">
          データビューアー
        </h1>

        {/* ファイルアップロードエリア */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            データの読み込み
          </h2>
          <div className="flex items-center space-x-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
            >
              JSONファイルを選択
            </button>
            {selectedFile && (
              <span className="text-gray-600">
                選択されたファイル: {selectedFile.name}
              </span>
            )}
          </div>
        </div>

        {/* データが読み込まれた場合の表示 */}
        {detectionData && (
          <>
            {/* メモ表示 */}
            {detectionData.memo && (
              <div className="bg-blue-50 rounded-lg shadow-md p-6 mb-6 border-l-4 border-blue-500">
                <h2 className="text-xl font-semibold text-blue-800 mb-3 flex items-center">
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  メモ
                </h2>
                <div className="bg-white rounded-md p-4 shadow-sm">
                  <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {detectionData.memo}
                  </p>
                </div>
              </div>
            )}

            {/* 統計情報 */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-700 mb-4">
                データ統計
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {(() => {
                  const stats = getDataStats(detectionData);
                  return (
                    <>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {stats.totalCount}
                        </div>
                        <div className="text-sm text-gray-600">
                          {stats.dataType}データ数
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {stats.duration}s
                        </div>
                        <div className="text-sm text-gray-600">記録時間</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-600">
                          {stats.avgIntensity}
                        </div>
                        <div className="text-sm text-gray-600">平均動き</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">
                          {stats.maxIntensity}
                        </div>
                        <div className="text-sm text-gray-600">最大動き</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-gray-700">
                          {stats.startTime.split(" ")[1]}
                        </div>
                        <div className="text-sm text-gray-600">開始時刻</div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* タイムライン表示 */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-700 mb-4">
                動きの強度タイムライン
              </h2>
              <p className="text-gray-600 mb-4">
                動きが激しいほど赤く表示されます。青：静止 → 緑：軽い動き →
                黄：中程度の動き → 赤：激しい動き
              </p>

              {(() => {
                const { intensities, maxIntensity } =
                  processTimelineData(detectionData);

                let totalDuration = 0;
                if (isPoseData(detectionData)) {
                  totalDuration =
                    detectionData.poses.length > 0
                      ? detectionData.poses[detectionData.poses.length - 1]
                          .timestamp
                      : 0;
                } else if (isHandData(detectionData)) {
                  totalDuration =
                    detectionData.hands.length > 0
                      ? detectionData.hands[detectionData.hands.length - 1]
                          .timestamp
                      : 0;
                }

                return (
                  <div className="space-y-4">
                    {/* タイムラインバー */}
                    <div className="relative">
                      <div className="h-12 bg-gray-200 rounded-lg overflow-hidden flex">
                        {intensities.map((intensity, index) => {
                          const color = getIntensityColor(
                            intensity,
                            maxIntensity
                          );
                          const width = 100 / intensities.length;

                          let timestamp = 0;
                          if (isPoseData(detectionData)) {
                            timestamp =
                              detectionData.poses[index]?.timestamp || 0;
                          } else if (isHandData(detectionData)) {
                            timestamp =
                              detectionData.hands[index]?.timestamp || 0;
                          }

                          return (
                            <div
                              key={index}
                              className="h-full transition-all duration-200 hover:brightness-110 cursor-pointer group relative"
                              style={{
                                backgroundColor: color,
                                width: `${width}%`,
                              }}
                              title={`時刻: ${(timestamp / 1000).toFixed(
                                1
                              )}s, 動き強度: ${intensity.toFixed(2)}`}
                            >
                              {/* ホバー時の詳細情報 */}
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                {(timestamp / 1000).toFixed(1)}s
                                <br />
                                強度: {intensity.toFixed(2)}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* 時間軸のラベル */}
                      <div className="flex justify-between mt-2 text-sm text-gray-600">
                        <span>0s</span>
                        <span>{(totalDuration / 1000).toFixed(1)}s</span>
                      </div>
                    </div>

                    {/* 凡例 */}
                    <div className="flex items-center justify-center space-x-6 text-sm">
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 bg-blue-500 rounded"></div>
                        <span>静止</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 bg-green-500 rounded"></div>
                        <span>軽い動き</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                        <span>中程度の動き</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 bg-red-500 rounded"></div>
                        <span>激しい動き</span>
                      </div>
                    </div>

                    {/* グラフ表示 */}
                    <div className="mt-8">
                      <h3 className="text-lg font-semibold text-gray-700 mb-4">
                        動き強度グラフ
                      </h3>
                      <div className="h-64 bg-gray-100 rounded-lg p-4 relative overflow-hidden">
                        <svg
                          width="100%"
                          height="100%"
                          viewBox="0 0 800 200"
                          className="absolute top-0 left-0"
                        >
                          {/* グリッドライン */}
                          {[0, 50, 100, 150, 200].map((y) => (
                            <line
                              key={y}
                              x1="0"
                              y1={y}
                              x2="800"
                              y2={y}
                              stroke="#e5e7eb"
                              strokeWidth="1"
                            />
                          ))}

                          {/* データライン */}
                          <polyline
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth="2"
                            points={intensities
                              .map((intensity, index) => {
                                const x =
                                  (index / (intensities.length - 1)) * 800;
                                const y =
                                  200 - (intensity / maxIntensity) * 180;
                                return `${x},${y}`;
                              })
                              .join(" ")}
                          />

                          {/* データポイント */}
                          {intensities.map((intensity, index) => {
                            const x = (index / (intensities.length - 1)) * 800;
                            const y = 200 - (intensity / maxIntensity) * 180;
                            const color = getIntensityColor(
                              intensity,
                              maxIntensity
                            );
                            return (
                              <circle
                                key={index}
                                cx={x}
                                cy={y}
                                r="3"
                                fill={color}
                                stroke="white"
                                strokeWidth="1"
                              />
                            );
                          })}
                        </svg>

                        {/* Y軸ラベル */}
                        <div className="absolute left-2 top-2 text-xs text-gray-600">
                          {maxIntensity.toFixed(0)}
                        </div>
                        <div className="absolute left-2 bottom-2 text-xs text-gray-600">
                          0
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </>
        )}

        {/* データが読み込まれていない場合の表示 */}
        {!detectionData && (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="text-gray-400 mb-4">
              <svg
                className="mx-auto h-16 w-16"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-700 mb-2">
              データが読み込まれていません
            </h3>
            <p className="text-gray-600">
              上記のボタンからJSONファイルを選択してください。
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataViewer;
