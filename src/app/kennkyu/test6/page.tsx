"use client";

import { useState, useEffect, useRef, useCallback } from "react";
// TensorFlow.jsとPose Detectionの型定義のみをインポートします。
// ライブラリ本体は実行時に動的に読み込みます。
import type * as poseDetection from "@tensorflow-models/pose-detection";
import type * as tf from "@tensorflow/tfjs";

// モデルタイプを型として定義
type ModelType = "Lightning" | "Thunder";

const PoseDetector = (): JSX.Element => {
  // モデルの種類を管理するState
  const [modelType, setModelType] = useState<ModelType>("Lightning");
  // 読み込み中・エラーの状態を管理するState
  const [status, setStatus] = useState("Loading...");

  // DOM要素への参照
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // TensorFlow.jsの検出器とアニメーションループのIDを保持
  const detectorRef = useRef<poseDetection.PoseDetector | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  // スケルトン描画用の接続情報を保持
  const adjacentPairsRef = useRef<[number, number][] | null>(null);
  // 読み込み状態を管理するState
  const [isLoading, setIsLoading] = useState(true);
  // モデルの読み込み進捗を管理するState
  const [loadingProgress, setLoadingProgress] = useState("初期化中...");
  // モデルの読み込み完了状態を管理するState
  const [isModelReady, setIsModelReady] = useState(false);
  // カメラの準備状態を管理するState
  const [isCameraReady, setIsCameraReady] = useState(false);

  /**
   * キーポイント（関節点）を描画する
   */
  const drawKeypoints = (
    keypoints: poseDetection.Keypoint[],
    minConfidence: number,
    ctx: CanvasRenderingContext2D,
    scale = 1
  ) => {
    for (const keypoint of keypoints) {
      if (keypoint.score != null && keypoint.score > minConfidence) {
        const { y, x } = keypoint;
        ctx.beginPath();
        ctx.arc(x * scale, y * scale, 4, 0, 2 * Math.PI);
        ctx.fillStyle = "#00ff00"; // 緑色
        ctx.fill();
      }
    }
  };

  /**
   * スケルトン（骨格）を描画する
   */
  const drawSkeleton = (
    keypoints: poseDetection.Keypoint[],
    minConfidence: number,
    ctx: CanvasRenderingContext2D,
    scale = 1
  ) => {
    // Refから接続情報を取得
    const adjacentPairs = adjacentPairsRef.current;
    if (!adjacentPairs) return;

    ctx.strokeStyle = "#ff0000"; // 赤色
    ctx.lineWidth = 2;

    for (const [i, j] of adjacentPairs) {
      const kp1 = keypoints[i];
      const kp2 = keypoints[j];

      if (
        kp1.score != null &&
        kp1.score > minConfidence &&
        kp2.score != null &&
        kp2.score > minConfidence
      ) {
        ctx.beginPath();
        ctx.moveTo(kp1.x * scale, kp1.y * scale);
        ctx.lineTo(kp2.x * scale, kp2.y * scale);
        ctx.stroke();
      }
    }
  };

  /**
   * 検出結果をCanvasに描画する関数
   */
  const drawResults = useCallback((poses: poseDetection.Pose[]) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // Canvasのサイズを映像に合わせる
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    canvas.width = videoWidth;
    canvas.height = videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 検出されたポーズを描画
    for (const pose of poses) {
      if (pose.keypoints) {
        drawKeypoints(pose.keypoints, 0.5, ctx);
        drawSkeleton(pose.keypoints, 0.5, ctx);
      }
    }
  }, []);

  /**
   * 姿勢検出をループ実行する関数
   */
  const detectPose = useCallback(async () => {
    const detector = detectorRef.current;
    const video = videoRef.current;

    if (detector && video && video.readyState === 4) {
      try {
        const poses = await detector.estimatePoses(video, {
          flipHorizontal: false,
        });
        drawResults(poses);
      } catch (error) {
        console.error("姿勢検出中にエラーが発生しました:", error);
      }
    }
    animationFrameIdRef.current = requestAnimationFrame(detectPose);
  }, [drawResults]);

  /**
   * 初期化処理
   * モデルの種類が変更されるたびに実行される
   */
  useEffect(() => {
    const init = async () => {
      // 初期化開始
      setIsLoading(true);
      setIsModelReady(false);
      setIsCameraReady(false);
      setLoadingProgress("初期化中...");

      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      if (detectorRef.current) {
        detectorRef.current.dispose();
        detectorRef.current = null;
      }

      setStatus(`ライブラリと"${modelType}"モデルを読み込み中...`);
      setLoadingProgress("ライブラリを読み込み中...");

      try {
        // ライブラリを動的にインポート
        const [tfModule, poseDetectionModule] = await Promise.all([
          import("@tensorflow/tfjs"),
          import("@tensorflow-models/pose-detection"),
          import("@tensorflow/tfjs-backend-webgl"),
        ]);

        setLoadingProgress("TensorFlow.jsを初期化中...");
        await tfModule.setBackend("webgl");
        await tfModule.ready();

        setLoadingProgress(`${modelType}モデルを読み込み中...`);
        const model = poseDetectionModule.SupportedModels.MoveNet;
        const detectorConfig: poseDetection.MoveNetModelConfig = {
          modelType:
            modelType === "Lightning"
              ? poseDetectionModule.movenet.modelType.SINGLEPOSE_LIGHTNING
              : poseDetectionModule.movenet.modelType.SINGLEPOSE_THUNDER,
        };

        // 骨格の接続情報をRefに保存
        adjacentPairsRef.current = poseDetectionModule.util.getAdjacentPairs(
          model
        ) as [number, number][];

        detectorRef.current = await poseDetectionModule.createDetector(
          model,
          detectorConfig
        );

        setIsModelReady(true);
        setLoadingProgress("カメラを初期化中...");
        setStatus("カメラを準備中...");

        if (videoRef.current) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          });
          videoRef.current.srcObject = stream;

          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setIsCameraReady(true);
            setIsLoading(false);
            setLoadingProgress("準備完了");
            setStatus("準備完了");
            detectPose();
          };
        }
      } catch (error) {
        console.error("初期化に失敗しました:", error);
        setStatus("エラーが発生しました。コンソールを確認してください。");
        setLoadingProgress("エラーが発生しました");
        setIsLoading(false);
        setIsModelReady(false);
        setIsCameraReady(false);
      }
    };

    init();

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      if (detectorRef.current) {
        detectorRef.current.dispose();
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [modelType, detectPose]);

  return (
    <div className="flex flex-col items-center p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">
        リアルタイム姿勢検出
      </h1>

      {/* ローディング状態 */}
      {isLoading && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div>
            <div className="text-blue-700">
              <div className="font-semibold">初期化中...</div>
              <div className="text-sm">{loadingProgress}</div>
            </div>
          </div>
        </div>
      )}
      <div className="flex justify-center space-x-4 mb-4">
        <button
          onClick={() => setModelType("Lightning")}
          disabled={
            status.includes("Lightning") || status.includes("読み込み中")
          }
          className={`px-6 py-2 bg-blue-500 text-white font-semibold rounded-md shadow-md hover:bg-blue-600 transition duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed          }`}
        >
          Lightning (高速)
        </button>
        <button
          onClick={() => setModelType("Thunder")}
          disabled={status.includes("Thunder") || status.includes("読み込み中")}
          className={`px-6 py-2 bg-purple-600 text-white font-semibold rounded-md shadow-md hover:bg-purple-700 transition duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed 
          }`}
        >
          Thunder (高精度)
        </button>
      </div>

      {/* ステータス表示 */}
      <div className="mb-4 flex flex-wrap gap-3 justify-center">
        <div
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            isModelReady
              ? "bg-green-100 text-green-800"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          モデル: {isModelReady ? "準備完了" : "読み込み中"}
        </div>
        <div
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            isCameraReady
              ? "bg-green-100 text-green-800"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          カメラ: {isCameraReady ? "準備完了" : "初期化中"}
        </div>
        <div className="px-4 py-2 bg-blue-100 text-blue-800 rounded-lg text-sm font-medium">
          使用モデル: {modelType}
        </div>
        <div className="px-4 py-2 bg-purple-100 text-purple-800 rounded-lg text-sm font-medium">
          検出人数: Null
        </div>
      </div>
      <div className="relative mb-6">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          style={{ transform: "scaleX(-1)" }}
          playsInline
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full"
          style={{ transform: "scaleX(-1)" }}
        />
      </div>
    </div>
  );
};

export default PoseDetector;
