import { errorText, t, useLocale } from "./i18n";
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
  useLocale();
  if (new URLSearchParams(location.search).has("tool")) return null;
  return (
    <button
      className="secondary"
      onClick={() =>
        void openToolWindow(id, exportToolSession(id)).catch((e) =>
          notify(errorText(e)),
        )
      }
    >
      <ExternalLink size={14} />
      {t("独立窗口")}
    </button>
  );
}
