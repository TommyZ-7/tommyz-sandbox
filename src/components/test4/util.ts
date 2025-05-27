import {
  HandLandmarkerResult,
  HandLandmarker, // HAND_CONNECTIONS を取得するためにインポート
  NormalizedLandmark,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

/**
 * Canvasに描画する
 * @param ctx Canvas 2D Context
 * @param videoElement 描画するビデオ要素
 * @param results 手の検出結果 (HandLandmarkerResult)
 */
export const drawCanvas = (
  ctx: CanvasRenderingContext2D,
  videoElement: HTMLVideoElement,
  results: HandLandmarkerResult
) => {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const drawingUtils = new DrawingUtils(ctx); // DrawingUtilsのインスタンスを作成

  ctx.save();
  ctx.clearRect(0, 0, width, height);

  // Canvasの左右反転（自撮り映像の場合）
  ctx.scale(-1, 1);
  ctx.translate(-width, 0);

  // キャプチャ画像の描画
  ctx.drawImage(videoElement, 0, 0, width, height);

  // 手の描画
  if (results.landmarks) {
    for (const landmarks of results.landmarks) {
      // 骨格の描画
      drawingUtils.drawConnectors(
        landmarks,
        HandLandmarker.HAND_CONNECTIONS, // Task APIのHAND_CONNECTIONSを使用
        {
          color: "#00FF00", // 緑色
          lineWidth: 5,
        }
      );
      // ランドマークの描画
      drawingUtils.drawLandmarks(landmarks, {
        color: "#FF0000", // 赤色
        lineWidth: 1,
        radius: 5,
      });
    }
  }
  ctx.restore();
};
