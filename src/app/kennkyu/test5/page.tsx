"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";

const RealWebcamPoseDetection: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);
  const animationRef = useRef<number>();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModelReady, setIsModelReady] = useState<boolean>(false);
  const [isCameraReady, setIsCameraReady] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [detectedPoses, setDetectedPoses] = useState<number>(0);
  const [fps, setFps] = useState<number>(0);
  const [loadingProgress, setLoadingProgress] = useState<string>("");

  // FPS計算用
  const lastFrameTime = useRef<number>(performance.now());
  const frameCount = useRef<number>(0);

  // 骨格接続の定義
  const connections = [
    [0, 1],
    [0, 2],
    [1, 3],
    [2, 4], // 顔
    [5, 6],
    [5, 7],
    [7, 9],
    [6, 8],
    [8, 10], // 腕
    [5, 11],
    [6, 12],
    [11, 12], // 体幹
    [11, 13],
    [13, 15],
    [12, 14],
    [14, 16], // 脚
  ];

  // 人物ごとの色
  const personColors = [
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#96CEB4",
    "#FFEAA7",
    "#DDA0DD",
    "#98D8C8",
    "#F7DC6F",
  ];

  // TensorFlow.jsとモデルの初期化
  const initializeModel = useCallback(async () => {
    try {
      setLoadingProgress("TensorFlow.jsを初期化中...");

      // TensorFlow.jsの動的インポート
      const tf = await import("@tensorflow/tfjs");
      await import("@tensorflow/tfjs-backend-webgl");
      const poseDetection = await import("@tensorflow-models/pose-detection");

      await tf.ready();
      setLoadingProgress("姿勢検出モデルを読み込み中...");

      // MoveNet MultiPoseモデルを使用
      const model = poseDetection.SupportedModels.MoveNet;
      const detector = await poseDetection.createDetector(model, {
        modelType: poseDetection.movenet.modelType.MULTIPOSE_LIGHTNING,
        enableSmoothing: true,
        minPoseScore: 0.25,
        multiPoseMaxDimension: 256,
        enableTracking: true,
        trackerType: poseDetection.TrackerType.BoundingBox,
        trackerConfig: {
          maxTracks: 6,
          maxAge: 1000,
          minSimilarity: 0.15,
          keypointTrackerParams: {
            keypointConfidenceThreshold: 0.3,
            minNumberOfKeypoints: 4,
            keypointFalloff: [
              0.9, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7,
              0.7, 0.7, 0.7, 0.7,
            ], // 17 keypoints for MoveNet
          },
        },
      });

      detectorRef.current = detector;
      setIsModelReady(true);
      setLoadingProgress("モデル読み込み完了");
    } catch (err) {
      console.error("Model initialization error:", err);
      setError(
        `モデル初期化エラー: ${
          err instanceof Error ? err.message : "不明なエラー"
        }`
      );
    }
  }, []);

  // カメラの初期化
  const initializeCamera = useCallback(async () => {
    try {
      setLoadingProgress("カメラにアクセス中...");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 60 },
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current!.play();
          setIsCameraReady(true);
          setLoadingProgress("カメラ準備完了");
        };
      }
    } catch (err) {
      console.error("Camera initialization error:", err);
      setError(
        `カメラアクセスエラー: ${
          err instanceof Error ? err.message : "不明なエラー"
        }`
      );
    }
  }, []);

  // 姿勢検出の実行
  const detectPoses = useCallback(async () => {
    if (
      !detectorRef.current ||
      !videoRef.current ||
      !canvasRef.current ||
      !isCameraReady
    ) {
      animationRef.current = requestAnimationFrame(detectPoses);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    try {
      // 姿勢検出を実行
      const poses = await detectorRef.current.estimatePoses(video);
      setDetectedPoses(poses.length);

      // キャンバスをクリア
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // ビデオフレームを描画（鏡像）
      ctx.save();
      ctx.scale(-1, 1);
      ctx.translate(-canvas.width, 0);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      // 検出された姿勢を描画
      drawPoses(ctx, poses);

      // FPS計算
      calculateFPS();
    } catch (err) {
      console.error("Pose detection error:", err);
    }

    animationRef.current = requestAnimationFrame(detectPoses);
  }, [isCameraReady]);

  // FPS計算
  const calculateFPS = useCallback(() => {
    const now = performance.now();
    frameCount.current++;

    if (now - lastFrameTime.current >= 1000) {
      setFps(
        Math.round((frameCount.current * 1000) / (now - lastFrameTime.current))
      );
      frameCount.current = 0;
      lastFrameTime.current = now;
    }
  }, []);

  // 姿勢描画
  const drawPoses = useCallback(
    (ctx: CanvasRenderingContext2D, poses: any[]) => {
      poses.forEach((pose, personIndex) => {
        const color = personColors[personIndex % personColors.length];

        // 骨格線を描画
        connections.forEach(([startIdx, endIdx]) => {
          const start = pose.keypoints[startIdx];
          const end = pose.keypoints[endIdx];

          if (start && end && start.score > 0.2 && end.score > 0.2) {
            ctx.beginPath();
            // 座標を鏡像に変換
            ctx.moveTo(ctx.canvas.width - start.x, start.y);
            ctx.lineTo(ctx.canvas.width - end.x, end.y);
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.lineCap = "round";
            ctx.globalAlpha = 0.8;
            ctx.stroke();
            ctx.globalAlpha = 1.0;
          }
        });

        // キーポイントを描画
        pose.keypoints.forEach((keypoint: any) => {
          if (keypoint.score > 0.2) {
            const mirroredX = ctx.canvas.width - keypoint.x;

            // キーポイントの円
            ctx.beginPath();
            ctx.arc(mirroredX, keypoint.y, 4, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = "#FFFFFF";
            ctx.lineWidth = 2;
            ctx.stroke();

            // 信頼度が高いキーポイントには追加の視覚効果
            if (keypoint.score > 0.7) {
              ctx.beginPath();
              ctx.arc(mirroredX, keypoint.y, 8, 0, 2 * Math.PI);
              ctx.strokeStyle = color;
              ctx.lineWidth = 1;
              ctx.globalAlpha = 0.3;
              ctx.stroke();
              ctx.globalAlpha = 1.0;
            }
          }
        });

        // 人物ラベル
        if (pose.keypoints[0] && pose.keypoints[0].score > 0.2) {
          const nose = pose.keypoints[0];
          const mirroredX = ctx.canvas.width - nose.x;
          ctx.fillStyle = color;
          ctx.font = "bold 14px Arial";
          ctx.fillText(
            `Person ${personIndex + 1}`,
            mirroredX + 10,
            nose.y - 10
          );

          // 信頼度スコア
          if (pose.score) {
            ctx.font = "12px Arial";
            ctx.fillText(
              `${(pose.score * 100).toFixed(1)}%`,
              mirroredX + 10,
              nose.y + 5
            );
          }
        }
      });
    },
    []
  );

  // 初期化処理
  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      await initializeModel();
      await initializeCamera();
      setIsLoading(false);
    };

    initialize();

    return () => {
      // クリーンアップ
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (detectorRef.current && detectorRef.current.dispose) {
        detectorRef.current.dispose();
      }
    };
  }, [initializeModel, initializeCamera]);

  // 姿勢検出開始
  useEffect(() => {
    if (isModelReady && isCameraReady && !isLoading) {
      detectPoses();
    }
  }, [isModelReady, isCameraReady, isLoading, detectPoses]);

  if (error) {
    return (
      <div className="flex flex-col items-center p-8 bg-red-50 rounded-lg">
        <div className="text-red-600 text-lg font-semibold mb-4">
          エラーが発生しました
        </div>
        <div className="text-red-500 text-sm mb-4">{error}</div>
        <div className="text-gray-600 text-sm">
          <p>• カメラへのアクセス許可を確認してください</p>
          <p>• HTTPSまたはlocalhostで実行していることを確認してください</p>
          <p>• ブラウザがWebRTCをサポートしていることを確認してください</p>
        </div>
      </div>
    );
  }

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
          FPS: {fps}
        </div>
        <div className="px-4 py-2 bg-purple-100 text-purple-800 rounded-lg text-sm font-medium">
          検出人数: {detectedPoses}
        </div>
      </div>

      {/* メインキャンバス */}
      <div className="relative mb-6">
        <video
          ref={videoRef}
          className="hidden"
          width={1280}
          height={720}
          autoPlay
          playsInline
          muted
        />
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          className="border-2 border-gray-300 rounded-xl shadow-lg bg-black"
        />
      </div>
    </div>
  );
};

export default RealWebcamPoseDetection;
