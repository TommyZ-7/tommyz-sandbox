"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import { Camera } from "@mediapipe/camera_utils";
import {
  HandLandmarker,
  FilesetResolver,
  HandLandmarkerResult,
} from "@mediapipe/tasks-vision";
import { drawCanvas } from "./util";
import { Sounds, SoundList, BackgroundImages } from "@/components/data";

// HandLandmarkerモデルへのパス
const HAND_LANDMARKER_MODEL_PATH =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

// 2D座標の型定義
type Point = { x: number; y: number };

/**
 * 行列計算のためのヘルパーオブジェクト
 * ホモグラフィ変換行列の計算に使用します
 */
const Matrix = {
  // ガウス・ジョルダン法による逆行列の計算
  inverse: (matrix: number[][]): number[][] | null => {
    const dim = matrix.length;
    const identity = Array(dim)
      .fill(0)
      .map((_, i) =>
        Array(dim)
          .fill(0)
          .map((__, j) => (i === j ? 1 : 0))
      );
    const augmented = matrix.map((row, i) => [...row, ...identity[i]]);

    for (let i = 0; i < dim; i++) {
      let pivot = i;
      while (pivot < dim && augmented[pivot][i] === 0) {
        pivot++;
      }
      if (pivot === dim) return null; // 逆行列なし
      [augmented[i], augmented[pivot]] = [augmented[pivot], augmented[i]];

      const divisor = augmented[i][i];
      for (let j = 0; j < 2 * dim; j++) {
        augmented[i][j] /= divisor;
      }

      for (let k = 0; k < dim; k++) {
        if (i !== k) {
          const factor = augmented[k][i];
          for (let j = 0; j < 2 * dim; j++) {
            augmented[k][j] -= factor * augmented[i][j];
          }
        }
      }
    }
    return augmented.map((row) => row.slice(dim));
  },

  // 行列とベクトルの乗算
  multiply: (matrix: number[][], vector: number[]): number[] => {
    return matrix.map((row) =>
      row.reduce((sum, val, i) => sum + val * vector[i], 0)
    );
  },
};

/**
 * パーティクルエフェクトのためのクラス
 */
class Particle {
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  life: number;
  initialLife: number;
  color: string;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.size = Math.random() * 5 + 2; // サイズ: 2pxから7px
    this.vx = (Math.random() - 0.5) * 4; // 水平方向の初速
    this.vy = (Math.random() - 0.5) * 4; // 垂直方向の初速
    this.life = Math.random() * 50 + 50; // 寿命: 50-100フレーム
    this.initialLife = this.life;
    this.color = `hsl(${Math.random() * 360}, 100%, 70%)`; // ランダムな鮮やかな色
  }

  // パーティクルの状態を更新
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0; // わずかな重力
    this.life -= 1;
    this.size *= 0.98; // 少しずつ小さくする
  }

  // パーティクルを描画
  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    // 寿命に応じてフェードアウト
    ctx.globalAlpha = Math.max(0, this.life / this.initialLife);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, Math.max(0, this.size), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export default function App() {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handCanvasRef = useRef<HTMLCanvasElement>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);
  const particlesRef = useRef<Particle[]>([]);
  const lastHandPositionsRef = useRef<{
    left: { [fingertipIndex: number]: Point | null };
    right: { [fingertipIndex: number]: Point | null };
  }>({
    left: { 4: null, 8: null, 12: null, 16: null, 20: null },
    right: { 4: null, 8: null, 12: null, 16: null, 20: null },
  });

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [videoDimensions, setVideoDimensions] = useState({
    width: 1280,
    height: 720,
  });
  const [handCanvasAspectRatio, setHandCanvasAspectRatio] = useState("4:3");
  const [handCanvasFullscreen, setHandCanvasFullscreen] = useState(false);

  // 背景画像管理用のState
  const [selectedBackground, setSelectedBackground] = useState<string>(
    BackgroundImages[0].path
  );
  const [backgroundImage, setBackgroundImage] =
    useState<HTMLImageElement | null>(null);

  // データ記録機能用のState
  const [isRecording, setIsRecording] = useState(false);
  const [recordedData, setRecordedData] = useState<{
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
  }>({ startTime: 0, hands: [] });
  const [memo, setMemo] = useState<string>("");
  const [showMemoDialog, setShowMemoDialog] = useState(false);
  const recordingStartTimeRef = useRef<number>(0);
  const lastRecordTimeRef = useRef<number>(0);

  const [selectedSound, setSelectedSound] = useState<SoundList | null>(null);

  // 音声再生用のRef
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // キャンバスサイズ計算
  const handCanvasDimensions = React.useMemo(() => {
    const baseWidth = 400;
    const ratio = handCanvasAspectRatio.split(":").map(Number);
    const height = (baseWidth * ratio[1]) / ratio[0];
    return { width: baseWidth, height };
  }, [handCanvasAspectRatio]);

  // --- Effect for loading background image ---
  useEffect(() => {
    if (selectedBackground) {
      const img = new Image();
      img.src = selectedBackground;
      img.onload = () => setBackgroundImage(img);
      img.onerror = () => {
        console.error("背景画像の読み込みに失敗しました:", selectedBackground);
        setBackgroundImage(null);
      };
    } else {
      setBackgroundImage(null);
    }
  }, [selectedBackground]);

  // HandLandmarkerの初期化
  useEffect(() => {
    async function initializeHandLandmarker() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );
        handLandmarkerRef.current = await HandLandmarker.createFromOptions(
          vision,
          {
            baseOptions: {
              modelAssetPath: HAND_LANDMARKER_MODEL_PATH,
              delegate: "GPU",
            },
            runningMode: "VIDEO",
            numHands: 2,
            minHandDetectionConfidence: 0.5,
            minHandPresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          }
        );
        setIsLoading(false);
        console.log("HandLandmarker initialized successfully.");
      } catch (error) {
        console.error("Failed to initialize HandLandmarker:", error);
        setErrorMessage(
          `HandLandmarkerの初期化に失敗しました: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        setIsLoading(false);
      }
    }
    initializeHandLandmarker();

    // クリーンアップ関数
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      if (handLandmarkerRef.current) {
        handLandmarkerRef.current.close();
      }
    };
  }, []);

  // カメラデバイスの取得
  const getCameraDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === "videoinput");
      setCameras(videoDevices);
      if (videoDevices.length > 0 && !selectedCameraId) {
        setSelectedCameraId(videoDevices[0].deviceId);
      }
    } catch (error) {
      console.error("カメラデバイスの取得に失敗しました:", error);
    }
  };

  // 初期化でカメラデバイスを取得
  useEffect(() => {
    getCameraDevices();
  }, []);

  // データ記録機能
  const startRecording = () => {
    const now = Date.now();
    recordingStartTimeRef.current = now;
    lastRecordTimeRef.current = now;
    setRecordedData({ startTime: now, hands: [] });
    setIsRecording(true);
    console.log("Recording started at:", new Date(now).toLocaleTimeString());
  };

  const stopRecording = () => {
    setIsRecording(false);
    console.log(
      "Recording stopped. Total hands recorded:",
      recordedData.hands.length
    );
  };

  const downloadData = () => {
    if (recordedData.hands.length === 0) {
      alert("記録されたデータがありません。");
      return;
    }
    setShowMemoDialog(true);
  };

  const confirmDownload = () => {
    const dataWithMemo = {
      ...recordedData,
      memo: memo.trim() || "メモなし",
    };

    const blob = new Blob([JSON.stringify(dataWithMemo, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hand_data_${new Date(recordedData.startTime)
      .toISOString()
      .replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowMemoDialog(false);
    setMemo("");
  };

  const recordHandData = (results: HandLandmarkerResult) => {
    if (!isRecording) return;

    const now = Date.now();
    // 0.25秒 = 250ms 間隔でデータを記録
    if (now - lastRecordTimeRef.current >= 250) {
      lastRecordTimeRef.current = now;

      if (results.landmarks && results.landmarks.length > 0) {
        const landmarks: Array<{
          x: number;
          y: number;
          z: number;
          handedness: string;
          index: number;
        }> = [];
        for (
          let handIndex = 0;
          handIndex < results.landmarks.length;
          handIndex++
        ) {
          const handLandmarks = results.landmarks[handIndex];
          const handedness =
            results.handednesses?.[handIndex]?.[0]?.categoryName || "Unknown";

          for (let i = 0; i < handLandmarks.length; i++) {
            const landmark = handLandmarks[i];
            landmarks.push({
              x: Math.round(landmark.x * 1000) / 1000,
              y: Math.round(landmark.y * 1000) / 1000,
              z: Math.round(landmark.z * 1000) / 1000,
              handedness: handedness,
              index: i,
            });
          }
        }

        setRecordedData((prev) => ({
          ...prev,
          hands: [
            ...prev.hands,
            {
              timestamp: now - recordingStartTimeRef.current,
              landmarks: landmarks,
            },
          ],
        }));
      }
    }
  };

  // 現在再生中かどうかを判定するヘルパー
  const isAudioPlaying = () => {
    const a = audioRef.current;
    return !!a && !a.paused && !a.ended && a.currentTime > 0;
  };

  const changeSound = (sound: SoundList) => {
    audioRef.current = new Audio(sound.dir + ".mp3");
    audioRef.current.load();
    setSelectedSound(sound);
    console.log("Changed sound to:", sound.dir + ".mp3");
  };

  // 描画ループ
  const predictWebcam = useCallback(async () => {
    if (
      !handLandmarkerRef.current ||
      !webcamRef.current ||
      !webcamRef.current.video ||
      !canvasRef.current
    ) {
      animationFrameIdRef.current = requestAnimationFrame(predictWebcam);
      return;
    }

    const video = webcamRef.current.video;
    const canvas = canvasRef.current;

    // ビデオの準備ができているか確認
    if (video.readyState < 2) {
      animationFrameIdRef.current = requestAnimationFrame(predictWebcam);
      return;
    }

    // 前回のフレームと同じタイムスタンプの場合は処理をスキップ
    if (video.currentTime === lastVideoTimeRef.current) {
      animationFrameIdRef.current = requestAnimationFrame(predictWebcam);
      return;
    }
    lastVideoTimeRef.current = video.currentTime;

    try {
      // HandLandmarkerで手の検出を実行
      const results: HandLandmarkerResult =
        handLandmarkerRef.current.detectForVideo(video, performance.now());

      // データ記録
      recordHandData(results);

      // 描画処理
      drawCanvas(
        canvas,
        video,
        results,
        handCanvasDimensions,
        handCanvasFullscreen,
        backgroundImage,
        particlesRef,
        lastHandPositionsRef,
        audioRef,
        isAudioPlaying,
        handCanvasRef
      );
    } catch (error) {
      console.error("Error during hand detection:", error);
      setErrorMessage(
        `手の検出中にエラーが発生しました: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    // 次のフレームをリクエスト
    animationFrameIdRef.current = requestAnimationFrame(predictWebcam);
  }, [
    handCanvasDimensions,
    handCanvasFullscreen,
    backgroundImage,
    isRecording,
  ]);

  // カメラの初期設定と描画ループの開始
  useEffect(() => {
    if (isLoading || errorMessage) return;

    if (webcamRef.current && webcamRef.current.video && selectedCameraId) {
      const video = webcamRef.current.video;

      navigator.mediaDevices
        .getUserMedia({
          video: {
            deviceId: { exact: selectedCameraId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        })
        .then((stream) => {
          video.srcObject = stream;
          video.onloadedmetadata = () => {
            video.play();
            setVideoDimensions({
              width: video.videoWidth,
              height: video.videoHeight,
            });
            console.log("Camera started. Starting prediction loop.");
            // 描画ループを開始
            animationFrameIdRef.current = requestAnimationFrame(predictWebcam);
          };
        })
        .catch((err) => {
          console.error("Failed to start camera:", err);
          setErrorMessage(
            `カメラの起動に失敗しました: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        });

      return () => {
        if (video.srcObject) {
          (video.srcObject as MediaStream)
            .getTracks()
            .forEach((track) => track.stop());
        }
        if (animationFrameIdRef.current) {
          cancelAnimationFrame(animationFrameIdRef.current);
        }
      };
    }
  }, [isLoading, errorMessage, predictWebcam, selectedCameraId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        読み込み中...
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="flex items-center justify-center h-screen text-red-500">
        {errorMessage}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center p-4 md:p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl md:text-3xl font-bold mb-4 text-gray-800">
        リアルタイム手の検出 (MediaPipe)
      </h1>

      {/* --- Controls --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 w-full max-w-5xl">
        {/* Camera selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            カメラ
          </label>
          <select
            value={selectedCameraId}
            onChange={(e) => setSelectedCameraId(e.target.value)}
            disabled={isLoading || cameras.length <= 1}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
          >
            {cameras.map((camera, index) => (
              <option key={camera.deviceId} value={camera.deviceId}>
                {camera.label || `カメラ ${index + 1}`}
              </option>
            ))}
          </select>
        </div>

        {/* Hand Canvas Aspect Ratio */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            手の位置キャンバス (アスペクト比)
          </label>
          <div className="flex space-x-1 rounded-md shadow-sm" role="group">
            {["4:3", "16:9", "1:1", "3:4"].map((ratio) => (
              <button
                key={ratio}
                onClick={() => setHandCanvasAspectRatio(ratio)}
                className={`px-4 py-2 text-sm font-medium border first:rounded-l-lg last:rounded-r-lg ${
                  handCanvasAspectRatio === ratio
                    ? "bg-teal-500 text-white"
                    : "bg-white"
                }`}
              >
                {ratio}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* --- Canvases --- */}
      <div className="flex flex-col lg:flex-row items-start justify-center gap-6 w-full max-w-7xl">
        <div className="flex-grow w-full lg:w-auto">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">手の検出</h3>
          <div className="relative border-2 border-gray-300 rounded-lg overflow-hidden max-w-full aspect-[16/9]">
            <Webcam
              audio={false}
              className="block w-full h-full object-cover"
              style={{ transform: "scaleX(-1)" }}
              width={1280}
              height={720}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={{
                width: 1280,
                height: 720,
                facingMode: "user",
                deviceId: selectedCameraId
                  ? { exact: selectedCameraId }
                  : undefined,
              }}
              onUserMediaError={(error) => {
                console.error("Webcam error:", error);
                setErrorMessage(
                  typeof error === "object" &&
                    error !== null &&
                    "name" in error &&
                    "message" in error
                    ? `Webcamエラー: ${(error as DOMException).name} - ${
                        (error as DOMException).message
                      }`
                    : `Webcamエラー: ${String(error)}`
                );
              }}
              onUserMedia={() => console.log("Webcam access granted.")}
            />
            <canvas
              ref={canvasRef}
              width={1280}
              height={720}
              className="absolute top-0 left-0 w-full h-full"
              style={{ transform: "scaleX(-1)" }}
            />
          </div>
        </div>

        <div className="flex-shrink-0 w-full lg:w-auto">
          <div className="flex items-center mb-3">
            <button
              onClick={() => setHandCanvasFullscreen(!handCanvasFullscreen)}
              className="ml-4 px-3 py-2 text-sm font-medium border rounded-lg shadow-sm bg-white hover:bg-gray-50 transition"
              aria-label={
                handCanvasFullscreen ? "通常表示に戻す" : "フルスクリーンで表示"
              }
            >
              {handCanvasFullscreen ? "戻す" : "最大化"}
            </button>
          </div>
          {/* 手のキャンバスのコンテナとスタイル */}
          <div
            className={
              handCanvasFullscreen
                ? "fixed top-0 left-0 w-screen h-screen bg-black flex justify-center items-center z-50 cursor-zoom-out"
                : "border-2 border-gray-300 rounded-lg overflow-hidden bg-gray-800 mx-auto"
            }
            style={
              !handCanvasFullscreen
                ? {
                    width: `${handCanvasDimensions.width}px`,
                    height: `${handCanvasDimensions.height}px`,
                  }
                : {}
            }
            onClick={() => {
              if (handCanvasFullscreen) setHandCanvasFullscreen(false);
            }}
          >
            <canvas
              ref={handCanvasRef}
              className={handCanvasFullscreen ? "cursor-default" : ""}
              style={
                handCanvasFullscreen
                  ? { height: "100%", width: "auto", transform: "scaleX(-1)" }
                  : { display: "block", transform: "scaleX(-1)" }
              }
              onClick={(e) => {
                if (handCanvasFullscreen) e.stopPropagation();
              }}
            />
          </div>
        </div>
      </div>

      {/* --- Sound and Background Settings --- */}
      <div className="mt-6 w-full max-w-5xl p-4 bg-white rounded-lg border">
        <h3 className="text-lg font-semibold text-gray-700 mb-3">
          エフェクト設定
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center space-x-2 text-sm">
              <span className="text-gray-700 font-medium">音声:</span>
              <select
                value={selectedSound?.name || ""}
                onChange={(e) => {
                  const foundSound = Sounds.find(
                    (sound) => sound.name === e.target.value
                  );
                  if (foundSound) {
                    changeSound(foundSound);
                  }
                }}
                className="border rounded-md text-gray-700 p-1 w-full"
              >
                <option value="" className="text-gray-700">
                  選択してください
                </option>
                {Sounds.map((sound) => (
                  <option
                    key={sound.name}
                    value={sound.name}
                    className="text-gray-700"
                  >
                    {sound.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <label className="flex items-center space-x-2 text-sm">
              <span className="text-gray-700 font-medium">背景画像:</span>
              <select
                value={selectedBackground}
                onChange={(e) => setSelectedBackground(e.target.value)}
                className="border rounded-md text-gray-700 p-1 w-full"
              >
                {BackgroundImages.map((img) => (
                  <option key={img.name} value={img.path}>
                    {img.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      {/* データ記録制御パネル */}
      <div className="mt-6 w-full max-w-5xl p-4 bg-white rounded-lg border">
        <h3 className="text-lg font-semibold text-gray-700 mb-3">データ記録</h3>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                isRecording
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-green-500 hover:bg-green-600 text-white"
              }`}
              disabled={!handLandmarkerRef.current}
            >
              {isRecording ? "記録停止" : "記録開始"}
            </button>
            <div
              className={`w-3 h-3 rounded-full ${
                isRecording ? "bg-red-500 animate-pulse" : "bg-gray-300"
              }`}
            />
            <span className="text-sm text-gray-600">
              {isRecording ? "記録中..." : "記録待機"}
            </span>
          </div>
          {recordedData.hands.length > 0 && !isRecording && (
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                記録された手のデータ数: {recordedData.hands.length}
              </span>
              <button
                onClick={downloadData}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
              >
                JSONダウンロード
              </button>
            </div>
          )}
        </div>
        {isRecording && (
          <div className="mt-3 text-sm text-gray-600">
            <p>• 0.25秒間隔で手のデータが記録されています</p>
            <p>• 現在の記録数: {recordedData.hands.length}</p>
            <p>
              • 記録開始時刻:{" "}
              {new Date(recordingStartTimeRef.current).toLocaleTimeString()}
            </p>
            <p>
              • 経過時間:{" "}
              {((Date.now() - recordingStartTimeRef.current) / 1000).toFixed(1)}
              秒
            </p>
          </div>
        )}
        {recordedData.hands.length > 0 && (
          <div className="mt-3 text-sm text-green-600">
            <p>
              ✓ 最新記録:{" "}
              {recordedData.hands.length > 0
                ? `${
                    recordedData.hands[recordedData.hands.length - 1].landmarks
                      .length
                  }個のランドマーク`
                : "なし"}
            </p>
          </div>
        )}
      </div>

      {/* メモ入力ダイアログ */}
      {showMemoDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">
              データにメモを追加
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                メモ（任意）
              </label>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800"
                rows={4}
                maxLength={500}
              />
              <div className="text-right text-xs text-gray-500 mt-1">
                {memo.length}/500文字
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowMemoDialog(false);
                  setMemo("");
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={confirmDownload}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
              >
                ダウンロード
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
