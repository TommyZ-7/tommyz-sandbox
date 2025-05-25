import Image from "next/image";
import App from "@/components/test2/App";

export default function Home() {
  return (
    <>
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        <App />
      </div>
    </>
  );
}
