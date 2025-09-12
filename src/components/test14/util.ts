import {
  HandLandmarkerResult,
  HandLandmarker,
  NormalizedLandmark,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

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

// パーティクルクラス
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
    this.size = Math.random() * 5 + 2;
    this.vx = (Math.random() - 0.5) * 4;
    this.vy = (Math.random() - 0.5) * 4;
    this.life = Math.random() * 50 + 50;
    this.initialLife = this.life;
    this.color = `hsl(${Math.random() * 360}, 100%, 70%)`;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0;
    this.life -= 1;
    this.size *= 0.98;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life / this.initialLife);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, Math.max(0, this.size), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
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
  particlesRef: React.MutableRefObject<Particle[]>,
  lastHandPositionsRef: React.MutableRefObject<{
    left: Point | null;
    right: Point | null;
  }>,
  audioRef: React.MutableRefObject<HTMLAudioElement | null>,
  isAudioPlaying: () => boolean,
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
  const emitParticles = (x: number, y: number) => {
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

    for (let i = 0; i < 20; i++) {
      particlesRef.current.push(new Particle(x, y));
    }
  };

  // パーティクルの更新と描画
  for (let i = particlesRef.current.length - 1; i >= 0; i--) {
    const p = particlesRef.current[i];
    p.update();
    p.draw(handCtx);
    if (p.life <= 0) {
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

      // 手首の座標を取得（ランドマークインデックス0が手首）
      const wrist = landmarks[0];
      if (wrist) {
        const wristPoint = {
          x: wrist.x * handCanvas.width,
          y: wrist.y * handCanvas.height,
        };

        if (handedness === "Left") {
          isLeftHandVisible = true;
          const lastPos = lastHandPositionsRef.current.left;
          if (lastPos) {
            const distance = Math.sqrt(
              (wristPoint.x - lastPos.x) ** 2 + (wristPoint.y - lastPos.y) ** 2
            );
            if (distance > 5) {
              emitParticles(wristPoint.x, wristPoint.y);
            }
          }
          lastHandPositionsRef.current.left = wristPoint;
        } else if (handedness === "Right") {
          isRightHandVisible = true;
          const lastPos = lastHandPositionsRef.current.right;
          if (lastPos) {
            const distance = Math.sqrt(
              (wristPoint.x - lastPos.x) ** 2 + (wristPoint.y - lastPos.y) ** 2
            );
            if (distance > 5) {
              emitParticles(wristPoint.x, wristPoint.y);
            }
          }
          lastHandPositionsRef.current.right = wristPoint;
        }
      }
    }
  }

  // 手が範囲外に出たら、最後の位置をリセット
  if (!isLeftHandVisible) lastHandPositionsRef.current.left = null;
  if (!isRightHandVisible) lastHandPositionsRef.current.right = null;
};
