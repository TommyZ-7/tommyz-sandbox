"use client";

import { useState, useEffect, useRef, useCallback } from "react";
// TensorFlow.jsとPose Detectionの型定義のみをインポートします。
// ライブラリ本体は実行時に動的に読み込みます。
import type * as poseDetection from "@tensorflow-models/pose-detection";
import type * as tf from "@tensorflow/tfjs";

// モデルタイプを型として定義
type ModelType = "Lightning" | "Thunder" | "multiPose";
// 処理方法を型として定義
type ProcessingMode = "CPU" | "GPU" | "WebGPU";

const PoseDetector = (): JSX.Element => {
  // モデルの種類を管理するState
  const [modelType, setModelType] = useState<ModelType>("Lightning");
  // 処理方法を管理するState
  const [processingMode, setProcessingMode] = useState<ProcessingMode>("GPU");
  // 読み込み中・エラーの状態を管理するState
  const [status, setStatus] = useState("Loading...");

  // DOM要素への参照
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handCanvasRef = useRef<HTMLCanvasElement>(null); // 手の位置表示用Canvas

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
  // GPU利用可能状態を管理するState
  const [isGpuAvailable, setIsGpuAvailable] = useState(false);
  // WebGPU利用可能状態を管理するState
  const [isWebGpuAvailable, setIsWebGpuAvailable] = useState(false);
  // モデルのフォールバック時に使用するState
  const [isFallback, setIsFallback] = useState(false);
  // 利用可能なカメラデバイスを管理するState
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  // 選択されたカメラデバイスIDを管理するState
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  // フルスクリーン表示状態を管理するState
  const [fullscreenMode, setFullscreenMode] = useState<
    "none" | "pose" | "hand"
  >("none");

  /**
   * 利用可能なカメラデバイスを取得する関数
   */
  const getCameraDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(
        (device) => device.kind === "videoinput"
      );
      setCameras(videoDevices);

      // デフォルトカメラを設定（最初のデバイスまたは既に選択されているもの）
      if (videoDevices.length > 0 && !selectedCameraId) {
        setSelectedCameraId(videoDevices[0].deviceId);
      }
    } catch (error) {
      console.error("カメラデバイスの取得に失敗しました:", error);
    }
  };

  /**
   * フルスクリーン表示を切り替える関数
   */
  const toggleFullscreen = (mode: "none" | "pose" | "hand") => {
    setFullscreenMode(mode);
  };

  /**
   * キーボードイベントでフルスクリーンを終了
   */
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === "Escape" && fullscreenMode !== "none") {
        setFullscreenMode("none");
      }
    };

    if (fullscreenMode !== "none") {
      document.addEventListener("keydown", handleKeyPress);
      return () => document.removeEventListener("keydown", handleKeyPress);
    }
  }, [fullscreenMode]);
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
   * 手の位置のみを描画する
   */
  const drawHandsOnly = (
    keypoints: poseDetection.Keypoint[],
    minConfidence: number,
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number
  ) => {
    // MoveNetのキーポイント定義（手首のインデックス）
    const LEFT_WRIST = 9;
    const RIGHT_WRIST = 10;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // 背景を暗めに設定
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 左手首を描画
    const leftWrist = keypoints[LEFT_WRIST];
    if (
      leftWrist &&
      leftWrist.score != null &&
      leftWrist.score > minConfidence
    ) {
      ctx.beginPath();
      ctx.arc(leftWrist.x, leftWrist.y, 15, 0, 2 * Math.PI);
      ctx.fillStyle = "#ff6b6b"; // 赤色（左手）
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.stroke();

      // 左手のラベル
      ctx.fillStyle = "#ffffff";
      ctx.font = "16px Arial";
      ctx.fillText("L", leftWrist.x - 5, leftWrist.y + 5);
    }

    // 右手首を描画
    const rightWrist = keypoints[RIGHT_WRIST];
    if (
      rightWrist &&
      rightWrist.score != null &&
      rightWrist.score > minConfidence
    ) {
      ctx.beginPath();
      ctx.arc(rightWrist.x, rightWrist.y, 15, 0, 2 * Math.PI);
      ctx.fillStyle = "#4ecdc4"; // 青緑色（右手）
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.stroke();

      // 右手のラベル
      ctx.fillStyle = "#ffffff";
      ctx.font = "16px Arial";
      ctx.fillText("R", rightWrist.x - 5, rightWrist.y + 5);
    }

    // 手の軌跡を表示するための線（オプション）
    if (
      leftWrist &&
      rightWrist &&
      leftWrist.score != null &&
      leftWrist.score > minConfidence &&
      rightWrist.score != null &&
      rightWrist.score > minConfidence
    ) {
      ctx.beginPath();
      ctx.moveTo(leftWrist.x, leftWrist.y);
      ctx.lineTo(rightWrist.x, rightWrist.y);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
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
    const handCanvas = handCanvasRef.current;
    if (!video || !canvas || !handCanvas) return;

    // Canvasのサイズを映像に合わせる
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    canvas.width = videoWidth;
    canvas.height = videoHeight;
    handCanvas.width = videoWidth;
    handCanvas.height = videoHeight;

    const ctx = canvas.getContext("2d");
    const handCtx = handCanvas.getContext("2d");
    if (!ctx || !handCtx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 検出されたポーズを描画
    for (const pose of poses) {
      if (pose.keypoints) {
        // メインCanvasに全身のポーズを描画
        drawKeypoints(pose.keypoints, 0.5, ctx);
        drawSkeleton(pose.keypoints, 0.5, ctx);

        // 手の位置専用Canvasに手の位置のみを描画
        drawHandsOnly(
          pose.keypoints,
          0.5,
          handCtx,
          handCanvas.width,
          handCanvas.height
        );
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
   * WebGPUの利用可能性をチェックする関数
   */
  const checkWebGpuAvailability = async (): Promise<boolean> => {
    if (!navigator.gpu) {
      console.log("WebGPU is not supported in this browser");
      return false;
    }

    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        console.log("WebGPU adapter not available");
        return false;
      }
      console.log("WebGPU is available");
      return true;
    } catch (error) {
      console.error("Error checking WebGPU availability:", error);
      return false;
    }
  };

  /**
   * TensorFlow.jsのバックエンドを設定する関数
   */
  const setupTensorFlowBackend = async (
    tfModule: typeof tf,
    mode: ProcessingMode
  ) => {
    try {
      if (mode === "WebGPU") {
        setLoadingProgress("WebGPU利用可能性をチェック中...");

        const webGpuAvailable = await checkWebGpuAvailability();
        setIsWebGpuAvailable(webGpuAvailable);

        if (!webGpuAvailable) {
          console.warn(
            "WebGPUが利用できません。GPU（WebGL）モードにフォールバックします。"
          );
          setProcessingMode("GPU");
          setIsFallback(true);
          setLoadingProgress("GPU（WebGL）バックエンドを初期化中...");
          await tfModule.setBackend("webgl");
        } else {
          setLoadingProgress("WebGPUバックエンドを初期化中...");
          await tfModule.setBackend("webgpu");
        }
        await tfModule.ready();
      } else if (mode === "GPU") {
        setLoadingProgress("GPU（WebGL）バックエンドを初期化中...");

        // WebGLバックエンドを設定
        await tfModule.setBackend("webgl");
        await tfModule.ready();

        // GPU利用可能性をチェック
        const gpuInfo = tfModule.env().getBool("WEBGL_VERSION");
        setIsGpuAvailable(gpuInfo);

        if (!gpuInfo) {
          console.warn(
            "WebGL（GPU）が利用できません。CPUモードにフォールバックします。"
          );
          await tfModule.setBackend("cpu");
          await tfModule.ready();
          setProcessingMode("CPU");
        }
      } else {
        setLoadingProgress("CPUバックエンドを初期化中...");
        await tfModule.setBackend("cpu");
        await tfModule.ready();
        setIsGpuAvailable(false);
        setIsWebGpuAvailable(false);
      }

      console.log(`TensorFlow.js バックエンド: ${tfModule.getBackend()}`);
    } catch (error) {
      console.error("バックエンドの設定に失敗しました:", error);
      // フォールバックとしてCPUを使用
      await tfModule.setBackend("cpu");
      await tfModule.ready();
      setProcessingMode("CPU");
      setIsGpuAvailable(false);
      setIsWebGpuAvailable(false);
    }
  };

  /**
   * 初期化処理
   * モデルの種類や処理方法が変更されるたびに実行される
   */
  useEffect(() => {
    const init = async () => {
      // 初期化開始
      setIsLoading(true);
      setIsFallback(false);
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

      setStatus(
        `ライブラリと"${modelType}"モデルを読み込み中...（${processingMode}モード）`
      );
      setLoadingProgress("ライブラリを読み込み中...");

      try {
        // ライブラリを動的にインポート
        const [tfModule, poseDetectionModule] = await Promise.all([
          import("@tensorflow/tfjs"),
          import("@tensorflow-models/pose-detection"),
        ]);

        // バックエンドを別途読み込み
        const backendPromises: Promise<any>[] = [];

        if (processingMode === "CPU") {
          backendPromises.push(import("@tensorflow/tfjs-backend-cpu"));
        } else if (processingMode === "GPU") {
          backendPromises.push(import("@tensorflow/tfjs-backend-webgl"));
        } else if (processingMode === "WebGPU") {
          backendPromises.push(import("@tensorflow/tfjs-backend-webgpu"));
          backendPromises.push(import("@tensorflow/tfjs-backend-webgl")); // WebGPU fallback
        }

        await Promise.all(backendPromises);

        // バックエンドを設定
        await setupTensorFlowBackend(tfModule, processingMode);

        setLoadingProgress(
          `${modelType}モデルを読み込み中...（${processingMode}モード）`
        );
        const model = poseDetectionModule.SupportedModels.MoveNet;
        const detectorConfig: poseDetection.MoveNetModelConfig = {
          modelType:
            modelType === "Lightning"
              ? poseDetectionModule.movenet.modelType.SINGLEPOSE_LIGHTNING
              : modelType === "Thunder"
              ? poseDetectionModule.movenet.modelType.SINGLEPOSE_THUNDER
              : poseDetectionModule.movenet.modelType.MULTIPOSE_LIGHTNING,
          enableTracking: true,
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

        // カメラデバイスを取得
        await getCameraDevices();

        if (videoRef.current) {
          const constraints: MediaStreamConstraints = {
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              ...(selectedCameraId && {
                deviceId: { exact: selectedCameraId },
              }),
            },
            audio: false,
          };

          const stream = await navigator.mediaDevices.getUserMedia(constraints);
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
        setIsGpuAvailable(false);
        setIsWebGpuAvailable(false);
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
  }, [modelType, processingMode, selectedCameraId, detectPose]);

  // カメラ選択が変更された時の処理
  useEffect(() => {
    if (selectedCameraId && isCameraReady) {
      // カメラを再初期化
      const reinitCamera = async () => {
        if (videoRef.current && videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach((track) => track.stop());
        }

        const constraints: MediaStreamConstraints = {
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            deviceId: { exact: selectedCameraId },
          },
          audio: false,
        };

        try {
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (error) {
          console.error("カメラの切り替えに失敗しました:", error);
        }
      };

      reinitCamera();
    }
  }, [selectedCameraId, isCameraReady]);

  return (
    <div
      className={`flex flex-col items-center p-6 bg-gray-50 min-h-screen ${
        fullscreenMode !== "none" ? "fixed inset-0 z-50 bg-black" : ""
      }`}
    >
      {fullscreenMode === "none" && (
        <>
          <h1 className="text-3xl font-bold mb-6 text-gray-800">
            リアルタイム姿勢検出（手の位置表示付き）
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

          {/* カメラ選択 */}
          {cameras.length > 1 && (
            <div className="mb-4 p-4 bg-white rounded-lg border border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                カメラを選択:
              </label>
              <select
                value={selectedCameraId}
                onChange={(e) => setSelectedCameraId(e.target.value)}
                disabled={isLoading}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                {cameras.map((camera, index) => (
                  <option key={camera.deviceId} value={camera.deviceId}>
                    {camera.label || `カメラ ${index + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 処理方法選択ボタン */}
          <div className="flex justify-center space-x-4 mb-4">
            <button
              onClick={() => setProcessingMode("WebGPU")}
              disabled={isLoading}
              className={`px-6 py-2 ${
                processingMode === "WebGPU"
                  ? "bg-purple-500 hover:bg-purple-600"
                  : "bg-gray-500 hover:bg-gray-600"
              } text-white font-semibold rounded-md shadow-md transition duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed`}
            >
              WebGPU処理
            </button>
            <button
              onClick={() => setProcessingMode("GPU")}
              disabled={isLoading}
              className={`px-6 py-2 ${
                processingMode === "GPU"
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-gray-500 hover:bg-gray-600"
              } text-white font-semibold rounded-md shadow-md transition duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed`}
            >
              GPU処理 (WebGL)
            </button>
            <button
              onClick={() => setProcessingMode("CPU")}
              disabled={isLoading}
              className={`px-6 py-2 ${
                processingMode === "CPU"
                  ? "bg-orange-500 hover:bg-orange-600"
                  : "bg-gray-500 hover:bg-gray-600"
              } text-white font-semibold rounded-md shadow-md transition duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed`}
            >
              CPU処理
            </button>
          </div>

          {/* モデル選択ボタン */}
          <div className="flex justify-center space-x-4 mb-4">
            <button
              onClick={() => setModelType("Lightning")}
              disabled={isLoading}
              className={`px-6 py-2 ${
                modelType === "Lightning"
                  ? "bg-blue-500 hover:bg-blue-600"
                  : "bg-gray-500 hover:bg-gray-600"
              } text-white font-semibold rounded-md shadow-md transition duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed`}
            >
              Lightning (高速)
            </button>
            <button
              onClick={() => setModelType("Thunder")}
              disabled={isLoading}
              className={`px-6 py-2 ${
                modelType === "Thunder"
                  ? "bg-purple-600 hover:bg-purple-700"
                  : "bg-gray-500 hover:bg-gray-600"
              } text-white font-semibold rounded-md shadow-md transition duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed`}
            >
              Thunder (高精度)
            </button>
            <button
              onClick={() => setModelType("multiPose")}
              disabled={isLoading}
              className={`px-6 py-2 ${
                modelType === "multiPose"
                  ? "bg-green-500 hover:bg-green-600"
                  : "bg-gray-500 hover:bg-gray-600"
              } text-white font-semibold rounded-md shadow-md transition duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed`}
            >
              multiPose (複数人)
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
            <div
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                processingMode === "WebGPU"
                  ? isWebGpuAvailable
                    ? "bg-purple-100 text-purple-800"
                    : "bg-yellow-100 text-yellow-800"
                  : processingMode === "GPU"
                  ? isGpuAvailable
                    ? "bg-red-100 text-red-800"
                    : "bg-yellow-100 text-yellow-800"
                  : "bg-orange-100 text-orange-800"
              }`}
            >
              処理方法: {processingMode}
              {processingMode === "WebGPU" &&
                !isWebGpuAvailable &&
                " (利用不可)"}
              {processingMode === "GPU" && !isGpuAvailable && " (利用不可)"}
            </div>
            <div className="px-4 py-2 bg-purple-100 text-purple-800 rounded-lg text-sm font-medium">
              検出人数: Null
            </div>
          </div>

          {/* フォールバック時の警告表示 */}
          {isFallback && (
            <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="text-yellow-700">
                <div className="font-semibold">注意:</div>
                <div className="text-sm">
                  WebGPUが利用できないため、GPU（WebGL）モードにフォールバックしました。
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* カメラ映像とCanvas */}
      <div
        className={
          fullscreenMode !== "none"
            ? "w-full h-full flex items-center justify-center"
            : "space-y-4"
        }
      >
        {/* メイン映像（全身ポーズ検出） */}
        {(fullscreenMode === "none" || fullscreenMode === "pose") && (
          <div
            className={`relative ${
              fullscreenMode === "pose" ? "w-full h-full" : ""
            }`}
          >
            {fullscreenMode === "none" && (
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-700">
                  全身ポーズ検出
                </h3>
                <button
                  onClick={() => toggleFullscreen("pose")}
                  className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-md transition duration-300"
                >
                  フルスクリーン
                </button>
              </div>
            )}
            <div
              className={`relative border-2 border-gray-300 rounded-lg overflow-hidden ${
                fullscreenMode === "pose" ? "w-full h-full" : ""
              }`}
            >
              <video
                ref={videoRef}
                className={`object-cover ${
                  fullscreenMode === "pose" ? "w-full h-full" : "w-full h-full"
                }`}
                style={{ transform: "scaleX(-1)" }}
                playsInline
              />
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full"
                style={{ transform: "scaleX(-1)" }}
              />
              {fullscreenMode === "pose" && (
                <button
                  onClick={() => toggleFullscreen("none")}
                  className="absolute top-4 right-4 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md transition duration-300 z-10"
                >
                  終了 (ESC)
                </button>
              )}
            </div>
          </div>
        )}

        {/* 手の位置専用表示 */}
        {(fullscreenMode === "none" || fullscreenMode === "hand") && (
          <div
            className={`relative ${
              fullscreenMode === "hand" ? "w-full h-full" : ""
            }`}
          >
            {fullscreenMode === "none" && (
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-700">
                  手の位置
                </h3>
                <button
                  onClick={() => toggleFullscreen("hand")}
                  className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-sm rounded-md transition duration-300"
                >
                  フルスクリーン
                </button>
              </div>
            )}
            <div
              className={`border-2 border-gray-300 rounded-lg overflow-hidden bg-gray-800 ${
                fullscreenMode === "hand" ? "w-full h-full" : ""
              }`}
            >
              <canvas
                ref={handCanvasRef}
                className={`object-cover ${
                  fullscreenMode === "hand" ? "w-full h-full" : "w-full h-full"
                }`}
                style={{ transform: "scaleX(-1)" }}
              />
              {fullscreenMode === "hand" && (
                <button
                  onClick={() => toggleFullscreen("none")}
                  className="absolute top-4 right-4 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md transition duration-300 z-10"
                >
                  終了 (ESC)
                </button>
              )}
            </div>
            {fullscreenMode === "none" && (
              <div className="mt-2 flex justify-center space-x-4 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-red-400 rounded-full"></div>
                  <span>左手 (L)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-teal-400 rounded-full"></div>
                  <span>右手 (R)</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PoseDetector;
