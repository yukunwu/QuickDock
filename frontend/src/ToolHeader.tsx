import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { t, useLocale, errorText } from "./i18n";
import { tools, type ToolID } from "./catalog";
import { copy } from "./bridge";
import ToolWindowButton from "./ToolWindowButton";
export default function ToolHeader({
  id,
  back,
  notify,
  children,
}: {
  id: ToolID;
  back: () => void;
  notify: (s: string) => void;
  children?: ReactNode;
}) {
  useLocale();
  const tool = tools.find((item) => item.id === id)!;
  return (
    <div className="workspace-header">
      <button className="icon-button" aria-label={t("返回")} onClick={back}>
        <ArrowLeft size={19} />
      </button>
      <span className={`item-icon ${tool.color}`}>
        <tool.icon size={21} />
      </span>
      <div>
        <h2>{tool.name}</h2>
        <p>{tool.subtitle}</p>
      </div>
      <ToolWindowButton id={id} notify={notify} />
      {children}
    </div>
  );
}
export function copyText(
  text: string,
  notify: (s: string) => void,
  message = "已复制",
) {
  void copy(text)
    .then(() => notify(t(message)))
    .catch((e) => notify(errorText(e)));
}
