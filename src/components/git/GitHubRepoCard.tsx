"use client";
import React, { useState, useEffect } from "react";
import "./GitHubRepoCard.css";

// コンポーネントが受け取るPropsの型を定義
interface GitHubRepoCardProps {
  owner: string;
  repo: string;
}

// GitHub APIのレスポンスデータのうち、使用するキーの型を定義
interface RepoData {
  name: string;
  description: string | null; // descriptionはnullの場合がある
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  language: string | null; // languageもnullの場合がある
}

// 主要な言語の色を定義（必要に応じて追加）
const getLanguageColor = (language: string | null): string => {
  if (!language) return "#cccccc"; // 言語がない場合はデフォルト色

  const colors: { [key: string]: string } = {
    JavaScript: "#f1e05a",
    TypeScript: "#3178c6",
    Python: "#3572A5",
    Java: "#b07219",
    HTML: "#e34c26",
    CSS: "#563d7c",
    Ruby: "#701516",
    Go: "#00ADD8",
    "C++": "#f34b7d",
    "C#": "#178600",
    PHP: "#4F5D95",
    Swift: "#ffac45",
    Kotlin: "#A97BFF",
    Rust: "#dea584",
  };
  return colors[language] || "#cccccc";
};

// GitHubアイコンSVGコンポーネント
const GitHubIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    style={{ marginRight: "8px" }}
  >
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);

const GitHubRepoCard: React.FC<GitHubRepoCardProps> = ({ owner, repo }) => {
  // stateに型を適用
  const [repoData, setRepoData] = useState<RepoData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRepoData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `https://api.github.com/repos/${owner}/${repo}`
        );
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("リポジトリが見つかりませんでした");
          }
          throw new Error(`エラーが発生しました: ${response.statusText}`);
        }
        const data: RepoData = await response.json();
        setRepoData(data);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("予期せぬエラーが発生しました");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchRepoData();
  }, [owner, repo]);

  if (loading) {
    return <div className="repo-card-placeholder">Loading...</div>;
  }

  if (error) {
    return (
      <div className="repo-card-placeholder repo-card-error">
        Error: {error}
      </div>
    );
  }

  // repoDataがnullの場合は何も表示しない（エラー処理でカバーされるが念のため）
  if (!repoData) {
    return null;
  }

  return (
    <div className="repo-card">
      <div className="repo-card-header">
        <h3 className="repo-name">
          <a href={repoData.html_url} target="_blank" rel="noopener noreferrer">
            <GitHubIcon />
            {repoData.name}
          </a>
        </h3>
        <p className="repo-description">
          {repoData.description || "No description provided."}
        </p>
      </div>
      <div className="repo-card-stats">
        <span className="repo-stat">
          <span
            className="repo-language-color"
            style={{ backgroundColor: getLanguageColor(repoData.language) }}
          ></span>
          {repoData.language || "N/A"}
        </span>
        <span className="repo-stat">
          ⭐️ {repoData.stargazers_count.toLocaleString()}
        </span>
        <span className="repo-stat">
          🍴 {repoData.forks_count.toLocaleString()}
        </span>
      </div>
    </div>
  );
};

export default GitHubRepoCard;
