import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import {
  HAND_CONNECTIONS,
  NormalizedLandmarkListList,
  Results,
} from "@mediapipe/hands";

interface Ball {
  x: number;
  y: number;
  color: string;
  active: boolean;
}

let balls: Ball[] = [];
const colors = ["red", "blue", "yellow"];
let score = 0;

/**
 * cnavasに描画する
 * @param ctx canvas context
 * @param results 手の検出結果
 */
export const drawCanvas = (ctx: CanvasRenderingContext2D, results: Results) => {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  ctx.save();
  ctx.clearRect(0, 0, width, height);
  // canvas の左右反転
  ctx.scale(-1, 1);
  ctx.translate(-width, 0);
  // capture image の描画
  ctx.drawImage(results.image, 0, 0, width, height);
  // 手の描画
  if (results.multiHandLandmarks) {
    // 骨格の描画
    for (const landmarks of results.multiHandLandmarks) {
      drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {
        color: "#00FF00",
        lineWidth: 5,
      });
      drawLandmarks(ctx, landmarks, {
        color: "#FF0000",
        lineWidth: 1,
        radius: 5,
      });
    }
    // 線の描画

    // ボールの更新と描画
  }

  ctx.restore();
};

/**
 * @param ctx
 * @param handLandmarks
 */
