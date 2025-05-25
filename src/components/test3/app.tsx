"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import { Camera } from "@mediapipe/camera_utils";
import {
  HandLandmarker,
  FilesetResolver,
  HandLandmarkerResult,
  DrawingUtils,
} from "@mediapipe/tasks-vision";
import { drawCanvas } from "./util";

// HandLandmarkerモデルへのパス
const HAND_LANDMARKER_MODEL_PATH =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export default function App() {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
            minHandPresenceConfidence: 0.5, // Task APIではこちらを使用
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
    const canvasCtx = canvas.getContext("2d");

    if (!canvasCtx) {
      animationFrameIdRef.current = requestAnimationFrame(predictWebcam);
      return;
    }

    // ビデオの準備ができているか確認
    if (video.readyState < 2) {
      // HAVE_CURRENT_DATA 以上が必要
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

      // 描画処理
      drawCanvas(canvasCtx, video, results);
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
  }, []);

  // カメラの初期設定と描画ループの開始
  useEffect(() => {
    if (isLoading || errorMessage) return; // 初期化中またはエラー時は何もしない

    if (webcamRef.current && webcamRef.current.video) {
      const camera = new Camera(webcamRef.current.video, {
        onFrame: async () => {
          // onFrameは空でも良い。predictWebcamループで処理するため。
          // 必要であれば、ここでwebcamRef.current.videoを直接使うこともできる。
        },
        width: 1280,
        height: 720,
      });
      camera
        .start()
        .then(() => {
          console.log("Camera started. Starting prediction loop.");
          // 描画ループを開始
          animationFrameIdRef.current = requestAnimationFrame(predictWebcam);
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
        // Cameraインスタンスのクリーンアップ (camera.stop()など、Cameraクラスの仕様による)
        // Cameraユーティリティのstopメソッドがない場合は、関連するリソース解放処理をここで行う
        if (camera && typeof (camera as any).stop === "function") {
          (camera as any).stop();
        }
        if (animationFrameIdRef.current) {
          cancelAnimationFrame(animationFrameIdRef.current);
        }
      };
    }
  }, [isLoading, errorMessage, predictWebcam]);

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
    <div className="relative w-full max-w-4xl mx-auto">
      <Webcam
        audio={false}
        className="absolute top-0 left-0 opacity-0" // 描画はCanvasで行うため非表示にするが、参照は保持
        width={1280}
        height={720}
        ref={webcamRef}
        screenshotFormat="image/jpeg"
        videoConstraints={{ width: 1280, height: 720, facingMode: "user" }}
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
        className="w-full h-auto border border-gray-300 rounded-lg shadow-lg"
      />
      {/* 検出結果をコンソールに出力するボタン（必要に応じて） */}
      {/* <button onClick={OutputData} className="mt-4 p-2 bg-blue-500 text-white rounded">Output Data</button> */}
    </div>
  );
}
