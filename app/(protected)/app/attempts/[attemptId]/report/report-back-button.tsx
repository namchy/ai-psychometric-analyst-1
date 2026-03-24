"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export function ReportBackButton() {
  const router = useRouter();

  return (
    <button
      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-transparent px-4 py-2 text-sm font-semibold text-slate-200 transition-colors duration-200 hover:bg-white/[0.04]"
      onClick={() => {
        router.push("/app");
      }}
      type="button"
    >
      <ArrowLeft className="h-4 w-4" />
      <span>Nazad na Dashboard</span>
    </button>
  );
}
