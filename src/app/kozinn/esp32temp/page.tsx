"use client";
import { useState, useEffect, useRef } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { Wifi, WifiOff, Thermometer, History, Server, Zap } from "lucide-react";

// Tooltipのカスタムコンポーネント
const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: any[];
  label?: any;
}) => {
  if (active && payload && payload.length) {
    const secondsAgo = label;
    let timeLabel;

    if (secondsAgo === 0) {
      timeLabel = "現在";
    } else {
      const minutes = Math.floor(secondsAgo / 60);
      const seconds = secondsAgo % 60;
      if (minutes > 0) {
        timeLabel = `${minutes}分${seconds}秒前`;
      } else {
        timeLabel = `${seconds}秒前`;
      }
    }

    return (
      <div className="p-3 bg-gray-700/50 backdrop-blur-sm border border-gray-600 rounded-lg shadow-lg">
        <p className="text-sm text-cyan-300">{`温度: ${payload[0].value.toFixed(
          2
        )} °C`}</p>
        <p className="text-xs text-gray-400">{timeLabel}</p>
      </div>
    );
  }
  return null;
};

// 1桁の数字を表示し、スロットマシンのように回転するアニメーションを実装するコンポーネント
const DigitSlot = ({ digit }: { digit: string }) => {
  const numbers = "0123456789";
  const digitIndex = numbers.indexOf(digit);

  // 'em' 単位を使うことで、親要素のフォントサイズに連動する
  const y = `-${digitIndex}em`;

  return (
    <motion.div
      // y座標を目的の数字の位置にアニメーションさせる
      animate={{ y }}
      // アニメーションの挙動をspring（バネ）に設定
      transition={{ type: "spring", stiffness: 150, damping: 20 }}
      className="flex flex-col"
    >
      {numbers.split("").map((num) => (
        // 各数字が親要素のline-heightと同じ高さを持つようにする (text-7xlはline-height: 1)
        <span key={num} className="h-[1em]">
          {num}
        </span>
      ))}
    </motion.div>
  );
};

// 温度の数値をスロットアニメーションで表示するコンポーネント
const AnimatedNumber = ({ value }: { value: number }) => {
  // 数値を小数点以下2桁の文字列に変換 (例: 25.36)
  const valueString = value.toFixed(2);

  return (
    // Flexboxを使い、各桁を横に並べる
    // h-[1em] と overflow-hidden で1行分の高さにクリップする
    <div className="flex h-[1em] overflow-hidden">
      {valueString.split("").map((char, index) => {
        // 文字が小数点の場合
        if (char === ".") {
          return (
            // 小数点はアニメーションさせずに静的に表示
            <span key={index} className="h-[1em]">
              .
            </span>
          );
        }
        // 文字が数字の場合
        return <DigitSlot key={index} digit={char} />;
      })}
    </div>
  );
};

export default function Home() {
  const [ipAddress, setIpAddress] = useState("localhost");
  const [port, setPort] = useState("8001");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<TemperatureData>({
    current_temp: 0,
    history: [],
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // コンポーネントがアンマウントされるときにタイマーをクリア
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  interface TemperatureData {
    current_temp: number;
    history: number[];
  }

  const fetchData = async (
    currentIp: string,
    currentPort: string
  ): Promise<boolean> => {
    setError("");
    try {
      // --- 実際のマイコンに接続する場合 ---
      const response = await fetch(`https://${currentIp}:${currentPort}/temp`);
      if (!response.ok) {
        throw new Error(`HTTPエラー: ${response.status}`);
      }
      const jsonData = await response.json();
      jsonData.history.reverse();
      setData(jsonData);
      return true;
    } catch (e: unknown) {
      console.error("データ取得エラー:", e);
      setError(
        "データの取得に失敗しました。IPアドレス、ポート、APIサーバーのCORS設定を確認してください。"
      );
      setIsConnected(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      return false;
    }
  };

  const handleConnect = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();
    if (!ipAddress || !port) {
      setError("IPアドレスとポートを入力してください。");
      return;
    }
    setIsConnecting(true);
    setError("");

    const success = await fetchData(ipAddress, port);

    if (success) {
      setIsConnected(true);
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        fetchData(ipAddress, port);
      }, 5000);
    }
    setIsConnecting(false);
  };

  const handleDisconnect = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setIsConnected(false);
    setData({ current_temp: 0, history: [] });
    setError("");
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 50, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: "spring" as const,
        stiffness: 50,
        damping: 20,
        staggerChildren: 0.1,
      },
    },
    exit: {
      opacity: 0,
      y: -50,
      scale: 0.95,
      transition: { duration: 0.3 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="bg-gray-900 text-white min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 font-sans relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-blue-900/40 opacity-80"></div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2032%2032%22%20width%3D%2232%22%20height%3D%2232%22%20fill%3D%22none%22%20stroke%3D%22%231f2937%22%3E%3Cpath%20d%3D%22M0%20.5H32V32%22%2F%3E%3C%2Fsvg%3E')] opacity-20"></div>
      </div>

      <main className="z-10 w-full max-w-5xl mx-auto">
        <AnimatePresence mode="wait">
          {!isConnected ? (
            <motion.div
              key="form"
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full max-w-md mx-auto"
            >
              <form
                onSubmit={handleConnect}
                className="bg-gray-800/50 backdrop-blur-md border border-gray-700 rounded-2xl p-8 shadow-2xl shadow-blue-500/10"
              >
                <motion.div
                  variants={itemVariants}
                  className="flex items-center justify-center mb-6"
                >
                  <Zap className="w-10 h-10 text-cyan-300 mr-4" />
                  <h1 className="text-3xl font-bold text-gray-100">
                    Temp Monitor
                  </h1>
                </motion.div>
                <motion.div variants={itemVariants} className="mb-4">
                  <label
                    htmlFor="ip"
                    className="block text-sm font-medium text-gray-300 mb-2"
                  >
                    IPアドレス
                  </label>
                  <input
                    type="text"
                    id="ip"
                    value={ipAddress}
                    onChange={(e) => setIpAddress(e.target.value)}
                    className="w-full bg-gray-900/70 border border-gray-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 outline-none transition-all duration-300"
                    placeholder="例: 192.168.1.10"
                  />
                </motion.div>
                <motion.div variants={itemVariants} className="mb-6">
                  <label
                    htmlFor="port"
                    className="block text-sm font-medium text-gray-300 mb-2"
                  >
                    ポート
                  </label>
                  <input
                    type="text"
                    id="port"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    className="w-full bg-gray-900/70 border border-gray-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 outline-none transition-all duration-300"
                    placeholder="例: 80"
                  />
                </motion.div>
                <motion.div variants={itemVariants}>
                  <button
                    type="submit"
                    disabled={isConnecting}
                    className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:bg-gray-600 text-gray-900 font-bold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center shadow-lg shadow-cyan-500/20 hover:shadow-cyan-400/40 transform hover:scale-105"
                  >
                    {isConnecting ? (
                      <>
                        <motion.div className="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin mr-2"></motion.div>
                        接続中...
                      </>
                    ) : (
                      <>
                        <Wifi className="mr-2 h-5 w-5" />
                        接続して監視開始
                      </>
                    )}
                  </button>
                </motion.div>
                {error && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-red-400 text-sm mt-4 text-center"
                  >
                    {error}
                  </motion.p>
                )}
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="dashboard"
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full"
            >
              <header className="flex flex-col sm:flex-row justify-between items-center mb-6">
                <motion.div
                  variants={itemVariants}
                  className="flex items-center text-lg"
                >
                  <Server className="w-6 h-6 text-cyan-300 mr-3" />
                  <span className="text-gray-300">接続先:</span>
                  <span className="font-mono text-green-400 ml-2">
                    {ipAddress}:{port}
                  </span>
                </motion.div>
                <motion.div variants={itemVariants}>
                  <button
                    onClick={handleDisconnect}
                    className="mt-4 sm:mt-0 bg-red-600/80 hover:bg-red-500 text-white font-bold py-2 px-5 rounded-lg transition-all duration-300 flex items-center justify-center shadow-lg shadow-red-500/20 hover:shadow-red-500/40 transform hover:scale-105"
                  >
                    <WifiOff className="mr-2 h-5 w-5" />
                    切断
                  </button>
                </motion.div>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <motion.div
                  variants={itemVariants}
                  className="lg:col-span-1 bg-gray-800/50 backdrop-blur-md border border-gray-700 rounded-2xl p-6 flex flex-col justify-center items-center shadow-2xl shadow-blue-500/10"
                >
                  <div className="flex items-center text-gray-300 mb-4">
                    <Thermometer className="w-7 h-7 mr-3 text-red-400" />
                    <h2 className="text-2xl font-semibold">現在の温度</h2>
                  </div>
                  <div className="text-7xl font-bold text-white tracking-tighter relative">
                    <AnimatedNumber value={data.current_temp} />
                    <span className="text-5xl text-gray-400 absolute -right-12 top-2">
                      °C
                    </span>
                  </div>
                </motion.div>

                <motion.div
                  variants={itemVariants}
                  className="lg:col-span-2 bg-gray-800/50 backdrop-blur-md border border-gray-700 rounded-2xl p-6 shadow-2xl shadow-blue-500/10"
                >
                  <div className="flex items-center text-gray-300 mb-4">
                    <History className="w-6 h-6 mr-3 text-cyan-300" />
                    <h2 className="text-2xl font-semibold">温度履歴グラフ</h2>
                  </div>
                  <div className="w-full h-64 sm:h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={data.history.map((temp, index) => ({
                          temp: temp,
                          secondsAgo: (index + 1) * 5,
                        }))}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <defs>
                          <linearGradient
                            id="colorTemp"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#22d3ee"
                              stopOpacity={0.8}
                            />
                            <stop
                              offset="95%"
                              stopColor="#22d3ee"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis
                          dataKey="secondsAgo"
                          tick={{ fill: "#9ca3af" }}
                          stroke="#4b5563"
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(totalSeconds) => {
                            const hours = Math.floor(totalSeconds / 3600);
                            const minutes = Math.floor(
                              (totalSeconds % 3600) / 60
                            );
                            const seconds = totalSeconds % 60;
                            const pad = (num: number) =>
                              num.toString().padStart(2, "0");

                            if (hours > 0) {
                              return `${hours}:${pad(minutes)}:${pad(seconds)}`;
                            }
                            return `${minutes}:${pad(seconds)}`;
                          }}
                          reversed={true}
                        />
                        <YAxis
                          tick={{ fill: "#9ca3af" }}
                          stroke="#4b5563"
                          domain={["dataMin - 1", "dataMax + 1"]}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(temp) => `${temp.toFixed(3)}`}
                        />
                        <Tooltip
                          content={<CustomTooltip />}
                          cursor={{
                            stroke: "#06b6d4",
                            strokeWidth: 1,
                            strokeDasharray: "3 3",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="temp"
                          stroke="#22d3ee"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorTemp)"
                          isAnimationActive={true}
                          animationDuration={800}
                          dot={false}
                          activeDot={{
                            r: 6,
                            fill: "#06b6d4",
                            stroke: "white",
                            strokeWidth: 2,
                          }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
