"use client";
import type { PortForward, TrafficPoint } from "@/lib/types";
import { ForwardWorkspace } from "./forward-workspace";
export function ForwardDetail({ forward }: { forward: PortForward; traffic?: TrafficPoint[] }) {
  return <ForwardWorkspace initialSelectedId={forward.id} />;
}
