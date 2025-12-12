import Link from "next/link";
import GitHubRepoCard from "@/components/git/GitHubRepoCard";
import { researchData } from "@/components/data";

export default function Home() {
  return (
    <div className="min-h-screen p-4 sm:p-8 md:p-20 font-[family-name:var(--font-geist-sans)] max-w-5xl mx-auto dark:text-gray-100">
      <header className="mb-8 sm:mb-12 text-center sm:text-left">
        <h1 className="text-2xl sm:text-4xl font-bold mb-4">研究開発ログ</h1>

      </header>

      <main className="flex flex-col gap-8 sm:gap-12">
        {researchData.map((research) => (
          <section
            key={research.id}
            className="flex flex-col gap-4 p-4 sm:p-6 border rounded-xl bg-white/50 hover:bg-white hover:shadow-sm transition-all duration-300 dark:bg-gray-800/30 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <div className="flex flex-col gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 border-b pb-2 dark:text-gray-100 dark:border-gray-700">
                {research.title}
              </h2>
              <p className="text-sm sm:text-base text-gray-600 leading-relaxed dark:text-gray-300">
                {research.description}
              </p>
            </div>

            <ul className="flex flex-col gap-3 mt-2">
              {research.publications.map((pub) => (
                <li key={pub.id}>
                  <Link
                    href={pub.url ? `/kennkyu/${pub.url}` : "#"}
                    className="group sm:flex sm:items-baseline gap-2 text-blue-600 hover:text-blue-800 transition-colors dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    <span className="font-semibold block sm:inline group-hover:underline">
                      {pub.title}
                    </span>
                    {pub.journal && (
                      <span className="text-sm text-gray-500 dark:text-gray-400 block sm:inline mt-1 sm:mt-0">
                        <span className="hidden sm:inline">— </span>
                        {pub.journal}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <div className="mt-8 border-t pt-8 dark:border-gray-700">
          <GitHubRepoCard owner="TommyZ-7" repo="tommyz-sandbox" />
        </div>
      </main>
    </div>
  );
}
