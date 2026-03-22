"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type ProtectedReportAutoRefreshProps = {
  status: "queued" | "processing" | "ready" | "failed";
};

export function ProtectedReportAutoRefresh({
  status,
}: ProtectedReportAutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    if (status !== "queued" && status !== "processing") {
      return;
    }

    const intervalId = window.setInterval(() => {
      router.refresh();
    }, 4000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [router, status]);

  return null;
}
