import {
  HandLandmarkerResult,
  HandLandmarker,
  NormalizedLandmark,
  DrawingUtils,
} from "@mediapipe/tasks-vision";
import { EffectType, EffectParticle, createParticles } from "./effects";

// 2D座標の型定義
type Point = { x: number; y: number };

// ランドマークデータの型定義
interface LandmarkData {
  x: number;
  y: number;
  z: number;
  handedness: string;
  index: number;
}

/**
 * メインの描画関数
 */
export const drawCanvas = (
  canvas: HTMLCanvasElement,
  videoElement: HTMLVideoElement,
  results: HandLandmarkerResult,
  handCanvasDimensions: { width: number; height: number },
  handCanvasFullscreen: boolean,
  backgroundImage: HTMLImageElement | null,
  particlesRef: React.MutableRefObject<EffectParticle[]>,
  lastHandPositionsRef: React.MutableRefObject<{
    left: { [fingertipIndex: number]: Point | null };
    right: { [fingertipIndex: number]: Point | null };
  }>,
  audioRef: React.MutableRefObject<HTMLAudioElement | null>,
  isAudioPlaying: () => boolean,
  selectedEffect: EffectType,
  handCanvasRef?: React.RefObject<HTMLCanvasElement>
) => {
  if (!canvas || !videoElement || videoElement.videoWidth === 0) return;

  // キャンバスサイズの設定
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // メインキャンバスをクリア
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 手のキャンバスを取得
  const handCanvas =
    handCanvasRef?.current ||
    (document.querySelector("canvas:last-of-type") as HTMLCanvasElement);
  if (!handCanvas) return;

  // 手のキャンバスのサイズ設定
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

  const handCtx = handCanvas.getContext("2d");
  if (!handCtx) return;

  // 手のキャンバスの背景描画
  if (backgroundImage) {
    handCtx.drawImage(
      backgroundImage,
      0,
      0,
      handCanvas.width,
      handCanvas.height
    );
  } else {
    handCtx.fillStyle = "#1a1a1a";
    handCtx.fillRect(0, 0, handCanvas.width, handCanvas.height);
  }

  // パーティクルエフェクト生成関数
  const emitParticles = (x: number, y: number, magnitude: number) => {
    if (audioRef.current) {
      if (isAudioPlaying()) {
        // 音声が再生中の場合はスキップ
      } else {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch((error) => {
          console.error("Audio playback failed:", error);
        });
      }
    }

    const newParticles = createParticles(selectedEffect, x, y, magnitude);
    particlesRef.current.push(...newParticles);
  };

  // パーティクルの更新と描画
  for (let i = particlesRef.current.length - 1; i >= 0; i--) {
    const p = particlesRef.current[i];
    p.update();
    p.draw(handCtx);
    if (p.isDead()) {
      particlesRef.current.splice(i, 1);
    }
  }

  // 手の検出と描画
  let isLeftHandVisible = false;
  let isRightHandVisible = false;

  if (results.landmarks && results.landmarks.length > 0) {
    const drawingUtils = new DrawingUtils(ctx);

    for (let handIndex = 0; handIndex < results.landmarks.length; handIndex++) {
      const landmarks = results.landmarks[handIndex];
      const handedness =
        results.handednesses?.[handIndex]?.[0]?.categoryName || "Unknown";

      // メインキャンバスに手のランドマークと接続線を描画
      drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {
        color: handedness === "Left" ? "#00FF00" : "#FF0000",
        lineWidth: 5,
      });
      drawingUtils.drawLandmarks(landmarks, {
        color: handedness === "Left" ? "#00AA00" : "#AA0000",
        lineWidth: 1,
        radius: 5,
      });

      // 指先のインデックス（親指、人差し指、中指、薬指、小指）
      const fingertipIndices = [4, 8, 12, 16, 20];

      // 各指先の座標を取得してエフェクトを生成
      for (const fingertipIndex of fingertipIndices) {
        const fingertip = landmarks[fingertipIndex];
        if (fingertip) {
          const fingertipPoint = {
            x: fingertip.x * handCanvas.width,
            y: fingertip.y * handCanvas.height,
          };

          if (handedness === "Left") {
            isLeftHandVisible = true;
            const lastPos = lastHandPositionsRef.current.left[fingertipIndex];
            if (lastPos) {
              const distance = Math.sqrt(
                (fingertipPoint.x - lastPos.x) ** 2 +
                (fingertipPoint.y - lastPos.y) ** 2
              );
              if (distance > 2) { // Slightly lower threshold to catch slower movements
                // Magnitude based on distance (speed)
                const magnitude = Math.min(distance, 20);
                emitParticles(fingertipPoint.x, fingertipPoint.y, magnitude);
              }
            }
            lastHandPositionsRef.current.left[fingertipIndex] = fingertipPoint;
          } else if (handedness === "Right") {
            isRightHandVisible = true;
            const lastPos = lastHandPositionsRef.current.right[fingertipIndex];
            if (lastPos) {
              const distance = Math.sqrt(
                (fingertipPoint.x - lastPos.x) ** 2 +
                (fingertipPoint.y - lastPos.y) ** 2
              );
              if (distance > 2) {
                const magnitude = Math.min(distance, 20);
                emitParticles(fingertipPoint.x, fingertipPoint.y, magnitude);
              }
            }
            lastHandPositionsRef.current.right[fingertipIndex] = fingertipPoint;
          }
        }
      }
    }
  }

  // 手が範囲外に出たら、最後の位置をリセット
  if (!isLeftHandVisible) {
    lastHandPositionsRef.current.left = {
      4: null,
      8: null,
      12: null,
      16: null,
      20: null,
    };
  }
  if (!isRightHandVisible) {
    lastHandPositionsRef.current.right = {
      4: null,
      8: null,
      12: null,
      16: null,
      20: null,
    };
  }
};

