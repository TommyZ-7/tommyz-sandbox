"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FlaskConical, Users } from "lucide-react";

export const Header = () => {
  const pathname = usePathname();

  return (
    <header className="fixed top-0 left-0 right-0 bg-gray-900 bg-opacity-80 backdrop-blur-md z-50 border-b border-gray-700">
      <div className="container mx-auto px-6 py-4 flex justify-between items-center">
        <Link
          href="/kennkyu"
          className="text-2xl font-bold text-white cursor-pointer flex items-center gap-2"
        >
          <FlaskConical className="text-cyan-400" />
          <span>粂野研究室</span>
        </Link>
        <nav className="hidden md:flex items-center space-x-6">
          <Link
            href="/kennkyu"
            className={`text-lg ${
              pathname === "/" ? "text-cyan-400" : "text-gray-300"
            } hover:text-cyan-400 transition-colors`}
          >
            ホーム
          </Link>
          <Link
            href="/kennkyu/research"
            className={`text-lg ${
              pathname.startsWith("/research")
                ? "text-cyan-400"
                : "text-gray-300"
            } hover:text-cyan-400 transition-colors`}
          >
            進捗一覧
          </Link>
        </nav>
        <button className="md:hidden text-white">
          <Users />
        </button>
      </div>
    </header>
  );
};
