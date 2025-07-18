"use client";

// ▼▼▼ 変更・追加箇所 ここから ▼▼▼
// useRefを追加
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
// ▲▲▲ 変更・追加箇所 ここまで ▲▲▲

// TensorFlow.jsとPose Detectionの型定義のみをインポートします。
// ライブラリ本体は実行時に動的に読み込みます。
import type * as poseDetection from "@tensorflow-models/pose-detection";
import type * as tf from "@tensorflow/tfjs";

// モデルタイプを型として定義
type ModelType = "Lightning" | "Thunder" | "multiPose";
// 処理方法を型として定義
type ProcessingMode = "CPU" | "GPU" | "WebGPU";

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

const PoseDetector = (): JSX.Element => {
  // --- State Hooks ---
  const [modelType, setModelType] = useState<ModelType>("Lightning");
  const [processingMode, setProcessingMode] = useState<ProcessingMode>("GPU");
  const [status, setStatus] = useState("Loading...");
  const [isLoading, setIsLoading] = useState(true);
  const [isModelReady, setIsModelReady] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [videoDimensions, setVideoDimensions] = useState({
    width: 1280,
    height: 720,
  });
  const [handCanvasAspectRatio, setHandCanvasAspectRatio] = useState("4:3");
  const [handCanvasFullscreen, setHandCanvasFullscreen] = useState(false);

  // --- Refs for DOM elements and detection logic ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handCanvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<poseDetection.PoseDetector | null>(null);
  const adjacentPairsRef = useRef<[number, number][] | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const lastHandPositionsRef = useRef<{
    left: Point | null;
    right: Point | null;
  }>({
    left: null,
    right: null,
  });

  // ▼▼▼ 変更・追加箇所 ここから ▼▼▼
  // 音声再生用のRef
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // コンポーネントマウント時に音声ファイルを読み込む
  useEffect(() => {
    // NOTE: publicディレクトリなどに配置した実際の音声ファイルパスに書き換えてください。
    // 例: "/sounds/particle-effect.wav"
    audioRef.current = new Audio("/sounds/puyon.mp3");
    audioRef.current.load();
  }, []);
  // ▲▲▲ 変更・追加箇所 ここまで ▲▲▲

  // --- State for interactive quadrilateral ---
  const [quadPoints, setQuadPoints] = useState<Point[]>([
    { x: 320, y: 180 },
    { x: 960, y: 180 },
    { x: 960, y: 540 },
    { x: 320, y: 540 },
  ]);
  const [draggingPointIndex, setDraggingPointIndex] = useState<number | null>(
    null
  );
  const DRAG_HANDLE_SIZE = 15;

  // --- Memoized calculations ---
  const handCanvasDimensions = useMemo(() => {
    const baseWidth = 400;
    const ratio = handCanvasAspectRatio.split(":").map(Number);
    const height = (baseWidth * ratio[1]) / ratio[0];
    return { width: baseWidth, height };
  }, [handCanvasAspectRatio]);

  // --- Helper Functions for Geometry and Transformation ---

  const getHomographyMatrix = (
    srcPoints: Point[],
    dstPoints: Point[]
  ): number[] | null => {
    const A: number[][] = [];
    const b: number[] = [];
    for (let i = 0; i < 4; i++) {
      const { x, y } = srcPoints[i];
      const { x: X, y: Y } = dstPoints[i];
      A.push([x, y, 1, 0, 0, 0, -X * x, -X * y]);
      A.push([0, 0, 0, x, y, 1, -Y * x, -Y * y]);
      b.push(X, Y);
    }
    const A_inv = Matrix.inverse(A);
    if (!A_inv) return null;
    const h = Matrix.multiply(A_inv, b);
    h.push(1);
    return h;
  };

  const transformPoint = (point: Point, h: number[]): Point => {
    const { x, y } = point;
    const Z = h[6] * x + h[7] * y + h[8];
    const X = (h[0] * x + h[1] * y + h[2]) / Z;
    const Y = (h[3] * x + h[4] * y + h[5]) / Z;
    return { x: X, y: Y };
  };

  const isPointInQuad = (point: Point, quad: Point[]): boolean => {
    const signs: number[] = [];
    for (let i = 0; i < 4; i++) {
      const p1 = quad[i];
      const p2 = quad[(i + 1) % 4];
      const crossProduct =
        (p2.x - p1.x) * (point.y - p1.y) - (p2.y - p1.y) * (point.x - p1.x);
      signs.push(Math.sign(crossProduct));
    }
    return signs.every((s) => s === signs[0] || s === 0);
  };

  // --- Drawing Functions ---

  const drawKeypoints = (
    keypoints: poseDetection.Keypoint[],
    minConfidence: number,
    ctx: CanvasRenderingContext2D
  ) => {
    for (const keypoint of keypoints) {
      if (keypoint.score != null && keypoint.score > minConfidence) {
        ctx.beginPath();
        ctx.arc(keypoint.x, keypoint.y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = "#00ff00";
        ctx.fill();
      }
    }
  };

  const drawSkeleton = (
    keypoints: poseDetection.Keypoint[],
    minConfidence: number,
    ctx: CanvasRenderingContext2D
  ) => {
    const adjacentPairs = adjacentPairsRef.current;
    if (!adjacentPairs) return;
    ctx.strokeStyle = "#ff0000";
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
        ctx.moveTo(kp1.x, kp1.y);
        ctx.lineTo(kp2.x, kp2.y);
        ctx.stroke();
      }
    }
  };

  const drawInteractiveOverlay = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      ctx.strokeStyle = "rgba(255, 255, 0, 0.8)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(quadPoints[0].x, quadPoints[0].y);
      for (let i = 1; i < 4; i++) {
        ctx.lineTo(quadPoints[i].x, quadPoints[i].y);
      }
      ctx.closePath();
      ctx.stroke();

      ctx.fillStyle = "rgba(255, 255, 0, 1)";
      quadPoints.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, DRAG_HANDLE_SIZE, 0, 2 * Math.PI);
        ctx.fill();
      });
    },
    [quadPoints]
  );

  // パーティクルエフェクトと手の描画ロジックを統合した関数
  const drawResults = useCallback(
    (poses: poseDetection.Pose[]) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const handCanvas = handCanvasRef.current;
      if (!video || !canvas || !handCanvas || video.videoWidth === 0) return;

      // --- キャンバスの解像度設定 ---
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      if (handCanvasFullscreen) {
        const rect = handCanvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          if (
            handCanvas.width !== rect.width ||
            handCanvas.height !== rect.height
          ) {
            handCanvas.width = rect.width;
            handCanvas.height = rect.height;
          }
        }
      } else {
        handCanvas.width = handCanvasDimensions.width;
        handCanvas.height = handCanvasDimensions.height;
      }

      const ctx = canvas.getContext("2d");
      const handCtx = handCanvas.getContext("2d");
      if (!ctx || !handCtx) return;

      // --- メインキャンバスの描画 ---
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const pose of poses) {
        if (pose.keypoints) {
          drawKeypoints(pose.keypoints, 0.5, ctx);
          drawSkeleton(pose.keypoints, 0.5, ctx);
        }
      }
      drawInteractiveOverlay(ctx);

      // --- 手のキャンバスの背景描画 ---
      handCtx.fillStyle = "#1a1a1a";
      handCtx.fillRect(0, 0, handCanvas.width, handCanvas.height);

      // ▼▼▼ 変更・追加箇所 ここから ▼▼▼
      // --- パーティクルの生成関数（音声再生付き） ---
      const emitParticles = (x: number, y: number) => {
        // 音声を再生
        if (audioRef.current) {
          // 再生が連続したときに備え、再生位置を先頭に戻す
          audioRef.current.currentTime = 0;
          // play()はPromiseを返すため、エラーハンドリングを行う
          audioRef.current.play().catch((error) => {
            console.error("Audio playback failed:", error);
          });
        }

        for (let i = 0; i < 20; i++) {
          particlesRef.current.push(new Particle(x, y));
        }
      };
      // ▲▲▲ 変更・追加箇所 ここまで ▲▲▲

      // --- パーティクルの更新と描画 ---
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.update();
        p.draw(handCtx);
        if (p.life <= 0) {
          particlesRef.current.splice(i, 1); // 寿命が尽きたら削除
        }
      }

      // --- ホモグラフィ変換の準備 ---
      const dstPoints: Point[] = [
        { x: 0, y: 0 },
        { x: handCanvas.width, y: 0 },
        { x: handCanvas.width, y: handCanvas.height },
        { x: 0, y: handCanvas.height },
      ];
      const h = getHomographyMatrix(quadPoints, dstPoints);
      if (!h) return;

      // --- 手の検出、マーカー描画、エフェクトトリガー ---
      let isLeftHandVisible = false;
      let isRightHandVisible = false;

      for (const pose of poses) {
        if (!pose.keypoints) continue;
        const leftWrist = pose.keypoints[9];
        const rightWrist = pose.keypoints[10];

        // 左手の処理
        if (
          leftWrist?.score &&
          leftWrist.score > 0.5 &&
          isPointInQuad(leftWrist, quadPoints)
        ) {
          isLeftHandVisible = true;
          const transformedPoint = transformPoint(leftWrist, h);

          const lastPos = lastHandPositionsRef.current.left;
          if (lastPos) {
            const distance = Math.sqrt(
              (transformedPoint.x - lastPos.x) ** 2 +
                (transformedPoint.y - lastPos.y) ** 2
            );
            // 5px以上動いたらパーティクルを生成
            if (distance > 5) {
              emitParticles(transformedPoint.x, transformedPoint.y);
            }
          }
          lastHandPositionsRef.current.left = transformedPoint;
        }

        // 右手の処理
        if (
          rightWrist?.score &&
          rightWrist.score > 0.5 &&
          isPointInQuad(rightWrist, quadPoints)
        ) {
          isRightHandVisible = true;
          const transformedPoint = transformPoint(rightWrist, h);

          const lastPos = lastHandPositionsRef.current.right;
          if (lastPos) {
            const distance = Math.sqrt(
              (transformedPoint.x - lastPos.x) ** 2 +
                (transformedPoint.y - lastPos.y) ** 2
            );
            // 5px以上動いたらパーティクルを生成
            if (distance > 5) {
              emitParticles(transformedPoint.x, transformedPoint.y);
            }
          }
          lastHandPositionsRef.current.right = transformedPoint;
        }
      }

      // 手が範囲外に出たら、最後の位置をリセット
      if (!isLeftHandVisible) lastHandPositionsRef.current.left = null;
      if (!isRightHandVisible) lastHandPositionsRef.current.right = null;
    },
    [
      quadPoints,
      drawInteractiveOverlay,
      handCanvasDimensions,
      handCanvasFullscreen,
    ]
  );

  // --- Pointer Event Handlers for Interactive Quad (Mouse & Touch) ---
  const getPointerPos = (
    e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>
  ): Point | null => {
    const rect = e.currentTarget.getBoundingClientRect();
    const video = videoRef.current;
    if (!video) return null;

    let clientX, clientY;
    if ("touches" in e.nativeEvent) {
      if (e.nativeEvent.touches.length === 0) return null;
      clientX = e.nativeEvent.touches[0].clientX;
      clientY = e.nativeEvent.touches[0].clientY;
    } else {
      clientX = e.nativeEvent.clientX;
      clientY = e.nativeEvent.clientY;
    }

    let x = clientX - rect.left;
    let y = clientY - rect.top;

    const scaleX = rect.width / video.videoWidth;
    const scaleY = rect.height / video.videoHeight;

    x /= scaleX;
    y /= scaleY;

    const flippedX = video.videoWidth - x;

    return { x: flippedX, y: y };
  };

  const handlePointerDown = (
    e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>
  ) => {
    const pos = getPointerPos(e);
    if (!pos) return;
    for (let i = 0; i < quadPoints.length; i++) {
      const p = quadPoints[i];
      const distance = Math.sqrt((p.x - pos.x) ** 2 + (p.y - pos.y) ** 2);
      if (distance < DRAG_HANDLE_SIZE) {
        setDraggingPointIndex(i);
        return;
      }
    }
  };

  const handlePointerMove = (
    e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>
  ) => {
    if (draggingPointIndex === null) return;
    e.preventDefault();
    const pos = getPointerPos(e);
    if (!pos) return;
    setQuadPoints((prevPoints) =>
      prevPoints.map((p, i) => (i === draggingPointIndex ? pos : p))
    );
  };

  const handlePointerUp = () => {
    setDraggingPointIndex(null);
  };

  const handleSliderChange = (
    pointIndex: number,
    axis: "x" | "y",
    value: string
  ) => {
    const numericValue = Number(value);
    setQuadPoints((prevPoints) => {
      const newPoints = [...prevPoints];
      newPoints[pointIndex] = {
        ...newPoints[pointIndex],
        [axis]: numericValue,
      };
      return newPoints;
    });
  };

  // --- Core Detection and Initialization Logic ---

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
  }, [drawResults]);

  // Effect for heavy initialization (model loading, camera setup)
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      setIsModelReady(false);
      setIsCameraReady(false);
      if (detectorRef.current) detectorRef.current.dispose();

      setStatus(`ライブラリと"${modelType}"モデルを読み込み中...`);
      try {
        const [tfModule, poseDetectionModule] = await Promise.all([
          import("@tensorflow/tfjs"),
          import("@tensorflow-models/pose-detection"),
        ]);
        if (processingMode === "CPU")
          await import("@tensorflow/tfjs-backend-cpu");
        if (processingMode === "GPU")
          await import("@tensorflow/tfjs-backend-webgl");
        if (processingMode === "WebGPU") {
          await import("@tensorflow/tfjs-backend-webgpu");
          await import("@tensorflow/tfjs-backend-webgl");
        }

        await tfModule
          .setBackend(
            processingMode === "CPU"
              ? "cpu"
              : processingMode === "GPU"
              ? "webgl"
              : "webgpu"
          )
          .catch(async () => {
            console.warn(
              `${processingMode} backend failed, falling back to webgl.`
            );
            await tfModule.setBackend("webgl");
          });
        await tfModule.ready();

        const model = poseDetectionModule.SupportedModels.MoveNet;
        detectorRef.current = await poseDetectionModule.createDetector(model, {
          modelType:
            modelType === "Lightning"
              ? poseDetectionModule.movenet.modelType.SINGLEPOSE_LIGHTNING
              : modelType === "Thunder"
              ? poseDetectionModule.movenet.modelType.SINGLEPOSE_THUNDER
              : poseDetectionModule.movenet.modelType.MULTIPOSE_LIGHTNING,
        });
        adjacentPairsRef.current = poseDetectionModule.util.getAdjacentPairs(
          model
        ) as [number, number][];
        setIsModelReady(true);

        setStatus("カメラを準備中...");
        if (!cameras.length) await getCameraDevices();

        if (videoRef.current && selectedCameraId) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { exact: selectedCameraId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          });
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setVideoDimensions({
              width: videoRef.current!.videoWidth,
              height: videoRef.current!.videoHeight,
            });
            setIsCameraReady(true);
            setIsLoading(false);
            setStatus("準備完了");
          };
        }
      } catch (error) {
        console.error("初期化に失敗しました:", error);
        setStatus("エラーが発生しました。");
        setIsLoading(false);
      }
    };
    init();

    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream)
          .getTracks()
          .forEach((track) => track.stop());
      }
    };
  }, [modelType, processingMode, selectedCameraId, cameras.length]);

  // Effect for starting/stopping the animation loop
  useEffect(() => {
    let animationId: number;
    const loop = async () => {
      await detectPose();
      animationId = requestAnimationFrame(loop);
    };

    if (isModelReady && isCameraReady) {
      loop();
    }

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isModelReady, isCameraReady, detectPose]);

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

  return (
    <div className="flex flex-col items-center p-4 md:p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl md:text-3xl font-bold mb-4 text-gray-800">
        リアルタイム姿勢検出 (インタラクティブ範囲指定)
      </h1>

      {isLoading && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p>{status}</p>
        </div>
      )}

      {/* --- Controls --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 w-full max-w-5xl">
        {/* Controls for Camera, Mode, Model */}
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
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            処理モード
          </label>
          <div className="flex space-x-1 rounded-md shadow-sm" role="group">
            <button
              onClick={() => setProcessingMode("WebGPU")}
              disabled={isLoading}
              className={`px-4 py-2 text-sm font-medium border rounded-l-lg ${
                processingMode === "WebGPU"
                  ? "bg-purple-600 text-white"
                  : "bg-white"
              }`}
            >
              WebGPU
            </button>
            <button
              onClick={() => setProcessingMode("GPU")}
              disabled={isLoading}
              className={`px-4 py-2 text-sm font-medium border-t border-b ${
                processingMode === "GPU" ? "bg-red-600 text-white" : "bg-white"
              }`}
            >
              GPU
            </button>
            <button
              onClick={() => setProcessingMode("CPU")}
              disabled={isLoading}
              className={`px-4 py-2 text-sm font-medium border rounded-r-lg ${
                processingMode === "CPU"
                  ? "bg-orange-500 text-white"
                  : "bg-white"
              }`}
            >
              CPU
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            モデル
          </label>
          <div className="flex space-x-1 rounded-md shadow-sm" role="group">
            <button
              onClick={() => setModelType("Lightning")}
              disabled={isLoading}
              className={`px-4 py-2 text-sm font-medium border rounded-l-lg ${
                modelType === "Lightning"
                  ? "bg-blue-600 text-white"
                  : "bg-white"
              }`}
            >
              Lightning
            </button>
            <button
              onClick={() => setModelType("Thunder")}
              disabled={isLoading}
              className={`px-4 py-2 text-sm font-medium border-t border-b ${
                modelType === "Thunder"
                  ? "bg-indigo-600 text-white"
                  : "bg-white"
              }`}
            >
              Thunder
            </button>
            <button
              onClick={() => setModelType("multiPose")}
              disabled={isLoading}
              className={`px-4 py-2 text-sm font-medium border rounded-r-lg ${
                modelType === "multiPose"
                  ? "bg-green-600 text-white"
                  : "bg-white"
              }`}
            >
              MultiPose
            </button>
          </div>
        </div>
      </div>

      {/* --- Canvases --- */}
      <div className="flex flex-col lg:flex-row items-start justify-center gap-6 w-full max-w-7xl">
        <div className="flex-grow w-full lg:w-auto">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            全身ポーズ検出 (枠内をドラッグ or 下のスライダーで範囲指定)
          </h3>
          <div
            className="relative border-2 border-gray-300 rounded-lg overflow-hidden max-w-full aspect-[16/9] cursor-pointer touch-none"
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
          >
            <video
              ref={videoRef}
              className="block w-full h-full object-cover"
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
        <div className="flex-shrink-0 w-full lg:w-auto">
          <div className="flex items-center mb-3">
            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-2">
                手の位置 (アスペクト比)
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
            {/* フルスクリーン切り替えボタン */}
            <button
              onClick={() => setHandCanvasFullscreen(!handCanvasFullscreen)}
              className="ml-4 mt-8 px-3 py-2 text-sm font-medium border rounded-lg shadow-sm bg-white hover:bg-gray-50 transition"
              aria-label={
                handCanvasFullscreen ? "通常表示に戻す" : "フルスクリーンで表示"
              }
            >
              {handCanvasFullscreen ? "戻す" : "最大化"}
            </button>
          </div>
          {/* handCanvasのコンテナとスタイル */}
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

      {/* --- Sliders for Quad Points --- */}
      {!isLoading && isCameraReady && (
        <div className="w-full max-w-5xl mt-6 p-4 bg-white rounded-lg border">
          <h3 className="text-lg font-semibold text-gray-700 mb-3">
            検出範囲の座標調整
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
            {quadPoints.map((point, index) => (
              <div key={index}>
                <h4 className="font-semibold text-gray-600">
                  頂点 {index + 1}
                </h4>
                <div className="mt-1">
                  <label className="flex items-center space-x-2 text-sm">
                    <span>X:</span>
                    <input
                      type="range"
                      min="0"
                      max={videoDimensions.width}
                      value={point.x}
                      onChange={(e) =>
                        handleSliderChange(index, "x", e.target.value)
                      }
                      className="w-full"
                    />
                    <span>{point.x.toFixed(0)}</span>
                  </label>
                </div>
                <div className="mt-1">
                  <label className="flex items-center space-x-2 text-sm">
                    <span>Y:</span>
                    <input
                      type="range"
                      min="0"
                      max={videoDimensions.height}
                      value={point.y}
                      onChange={(e) =>
                        handleSliderChange(index, "y", e.target.value)
                      }
                      className="w-full"
                    />
                    <span>{point.y.toFixed(0)}</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PoseDetector;
