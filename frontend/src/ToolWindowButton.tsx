import { ExternalLink } from "lucide-react";
import type { ToolID } from "./catalog";
import { openToolWindow } from "./bridge";
import { exportToolSession } from "./toolSession";
export default function ToolWindowButton({
  id,
  notify,
}: {
  id: ToolID;
  notify: (s: string) => void;
}) {
  if (new URLSearchParams(location.search).has("tool")) return null;
  return (
    <button
      className="secondary"
      onClick={() =>
        void openToolWindow(id, exportToolSession(id)).catch((e) =>
          notify(String(e)),
        )
      }
    >
      <ExternalLink size={14} />
      独立窗口
    </button>
  );
}
