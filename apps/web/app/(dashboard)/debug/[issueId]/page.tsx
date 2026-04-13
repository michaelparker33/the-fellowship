"use client";

import { useParams } from "next/navigation";
import { DebugPage } from "@multica/views/debug";

export default function DebugPageRoute() {
  const params = useParams<{ issueId: string }>();
  return <DebugPage issueId={params.issueId} />;
}
