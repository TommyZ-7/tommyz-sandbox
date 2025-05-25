import Image from "next/image";
import App from "@/components/test1/App";

export default function Home() {
  return (
    <>
      <main className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        <App />
      </main>
    </>
  );
}
