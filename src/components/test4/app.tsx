"use client";
import { useEffect, useRef } from "react";
import {
  FilesetResolver,
  PoseLandmarker,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let landmarker: PoseLandmarker | undefined;
    let stream: MediaStream | undefined;

    // 初期化
    const init = async () => {
      // Wasm バンドルの読み込み
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
      );

      // PoseLandmarker 初期化
      landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
          delegate: "GPU", // GPU 利用。CPU しかない環境でも自動フォールバック
        },
        runningMode: "VIDEO",
        numPoses: 1,
      });

      // カメラ起動
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      // 描画コンテキスト
      const canvas = canvasRef.current!;
      const ctx2d = canvas.getContext("2d")!;

      // GPU 描画を完全に使い切る場合は WebGL2 コンテキストも取得する
      // const gl = canvas.getContext("webgl2") as WebGL2RenderingContext;
      // const drawer = new DrawingUtils(ctx2d, gl);
      const drawer = new DrawingUtils(ctx2d);

      // 推定ループ
      const detect = () => {
        if (!videoRef.current || !landmarker) return;

        const ts = performance.now();
        const res = landmarker.detectForVideo(videoRef.current, ts);

        ctx2d.clearRect(0, 0, canvas.width, canvas.height);
        ctx2d.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

        if (res.landmarks.length) {
          const lm = res.landmarks[0];
          drawer.drawLandmarks(lm, {
            color: "red",
            lineWidth: 2,
          });
          drawer.drawConnectors(lm, PoseLandmarker.POSE_CONNECTIONS);
        }
        requestAnimationFrame(detect);
      };
      detect();
    };

    init();

    // クリーンアップ
    return () => {
      landmarker?.close();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div>
      <video
        ref={videoRef}
        width={640}
        height={480}
        style={{ display: "none" }}
      />
      <canvas ref={canvasRef} width={640} height={480} />
    </div>
  );
}
