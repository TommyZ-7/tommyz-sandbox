import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { HAND_CONNECTIONS, NormalizedLandmarkListList, Results } from '@mediapipe/hands';

interface Ball {
  x: number;
  y: number;
  color: string;
  active: boolean;
}

let balls: Ball[] = [];
const colors = ['red', 'blue', 'yellow'];
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
      drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 5 });
      drawLandmarks(ctx, landmarks, { color: '#FF0000', lineWidth: 1, radius: 5 });
    }
    // 線の描画
    const lineInfo = drawLine(ctx, results.multiHandLandmarks);

    // ボールの更新と描画
    updateAndDrawBalls(ctx, width, height, lineInfo);
  }

  drawScore(ctx, width, height);

  ctx.restore();
};

/**
 *  両手の人差し指の先端を結ぶ線を描き、長さに応じて段階的に色を変化させる
 *  特定の範囲外では線を描画しない
 * @param ctx
 * @param handLandmarks
 */
const drawLine = (
  ctx: CanvasRenderingContext2D,
  handLandmarks: NormalizedLandmarkListList
): { color: string | null; x1: number; y1: number; x2: number; y2: number } | null => {
  if (handLandmarks.length === 2 && handLandmarks[0].length > 8 && handLandmarks[1].length > 8) {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    const [x1, y1] = [handLandmarks[0][8].x * width, handLandmarks[0][8].y * height];
    const [x2, y2] = [handLandmarks[1][8].x * width, handLandmarks[1][8].y * height];

    // 線の長さを計算
    const lineLength = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

    // 対角線の長さを計算
    const maxLength = Math.sqrt(width * width + height * height);

    // 線の長さに基づいて色を決定
    let color: string | null = null;

    if (lineLength < maxLength / 5) {
      color = 'red';
    } else if (lineLength < (maxLength * 2) / 5) {
      color = 'blue';
    } else if (lineLength < (maxLength * 3) / 5) {
      color = 'yellow';
    }

    // 色が決定された場合のみ線を描画
    if (color) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    return { color, x1, y1, x2, y2 };
  }
  return null;
};

const updateAndDrawBalls = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  lineInfo: { color: string | null; x1: number; y1: number; x2: number; y2: number } | null
) => {
  // 新しいボールを追加
  if (Math.random() < 0.02) {
    balls.push({
      x: (Math.random() * (0.8 - 0.2) + 0.2) * width,
      y: 0,
      color: colors[Math.floor(Math.random() * colors.length)],
      active: true,
    });
  }

  // ボールの更新と描画
  balls = balls.filter((ball) => {
    if (!ball.active) return false;

    ball.y += 6; // ボールを下に移動

    // ボールが画面外に出たら削除
    if (ball.y > height) return false;

    // 線との衝突判定
    if (lineInfo && lineInfo.color === ball.color) {
      const isColliding = isPointOnLine(
        ball.x,
        ball.y,
        lineInfo.x1,
        lineInfo.y1,
        lineInfo.x2,
        lineInfo.y2
      );
      if (isColliding) {
        ball.active = false;
        score++; // 得点を増やす
        return false;
      }
    }

    // ボールを描画
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = ball.color;
    ctx.fill();

    return true;
  });
};

const isPointOnLine = (
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): boolean => {
  const d1 = Math.sqrt(Math.pow(px - x1, 2) + Math.pow(py - y1, 2));
  const d2 = Math.sqrt(Math.pow(px - x2, 2) + Math.pow(py - y2, 2));
  const lineLen = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  const buffer = 0.4; // 許容誤差

  return Math.abs(d1 + d2 - lineLen) < buffer;
};

/**
 * 得点を右上に表示する
 * @param ctx canvas context
 * @param width canvas width
 * @param height canvas height
 */

const drawScore = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  ctx.save();
  ctx.scale(-1, 1); // スケールを元に戻す
  ctx.font = '50px Arial';
  ctx.fillStyle = 'white';
  ctx.textAlign = 'right';
  ctx.fillText(`スコア: ${score}`, -20, 50); // 右上に表示
  ctx.restore();
};
