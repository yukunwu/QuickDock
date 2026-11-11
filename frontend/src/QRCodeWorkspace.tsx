import { useMemo, useState } from "react";
import { ArrowLeft, Copy, Download, QrCode, ShieldCheck } from "lucide-react";
import { t, errorText, useLocale } from "./i18n";
import { drafts } from "./toolSession";
import { copy, saveQRCode } from "./bridge";
import type { Draft } from "./tools/compute";
import { createQR, qrCanvas, qrSVG, type QRLevel } from "./tools/qrcode";
import ToolWindowButton from "./ToolWindowButton";
export default function QRCodeWorkspace({
  back,
  notify,
}: {
  back: () => void;
  notify: (message: string) => void;
}) {
  useLocale();
  const [state, setState] = useState<Draft>(
    () =>
      drafts.get("qrcode") || {
        input: "",
        mode: "M",
        count: 512,
        unit: "",
        zone: "",
        group: "",
        from: "",
        to: "",
        generated: "",
      },
  );
  const [saving, setSaving] = useState(false);
  const update = (value: Partial<Draft>) =>
    setState((old) => {
      const next = { ...old, ...value };
      drafts.set("qrcode", next);
      return next;
    });
  const size = [256, 512, 1024].includes(state.count) ? state.count : 512;
  const level: QRLevel = ["L", "M", "Q", "H"].includes(state.mode)
    ? (state.mode as QRLevel)
    : "M";
  const output = useMemo(() => {
    try {
      const qr = createQR(state.input, level);
      return { qr, svg: qr ? qrSVG(qr, size) : "", error: "" };
    } catch (e) {
      return {
        qr: null,
        svg: "",
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }, [state.input, size, level]);
  const exportImage = async (format: "png" | "svg") => {
    if (!output.qr || saving) return;
    setSaving(true);
    try {
      const data =
        format === "svg"
          ? output.svg
          : qrCanvas(output.qr, size).toDataURL("image/png").split(",")[1];
      if (await saveQRCode(format, data)) notify(t("二维码已导出"));
    } catch (e) {
      notify(errorText(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="workspace qr-workspace">
      <div className="workspace-header">
        <button className="icon-button" aria-label={t("返回")} onClick={back}>
          <ArrowLeft size={19} />
        </button>
        <span className="item-icon">
          <QrCode size={21} />
        </span>
        <div>
          <h2>{t("二维码生成器")}</h2>
          <p>{t("将文字或网址生成二维码")}</p>
        </div>
        <ToolWindowButton id="qrcode" notify={notify} />
      </div>
      <div className="workspace-options">
        <span className="tag">{t("本地处理")}</span>
        <button className="secondary" onClick={() => update({ input: "" })}>
          {t("清空输入")}
        </button>
        <label>
          {t("图片尺寸")}{" "}
          <select
            aria-label={t("图片尺寸")}
            value={size}
            onChange={(e) => update({ count: Number(e.target.value) })}
          >
            {[256, 512, 1024].map((n) => (
              <option key={n} value={n}>
                {n} px
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("容错级别")}{" "}
          <select
            aria-label={t("容错级别")}
            value={level}
            onChange={(e) => update({ mode: e.target.value })}
          >
            {(["L", "M", "Q", "H"] as const).map((v, i) => (
              <option key={v} value={v}>
                {v} · {[7, 15, 25, 30][i]}%
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="editor-grid qr-grid">
        <div className="editor-pane">
          <div className="editor-label">
            {t("输入")}
            <span>{t("文字或网址")}</span>
          </div>
          <textarea
            aria-label={t("二维码内容")}
            spellCheck={false}
            value={state.input}
            placeholder={t("输入文字或粘贴网址…")}
            onChange={(e) => update({ input: e.target.value })}
          />
        </div>
        <div className="qr-preview editor-pane">
          <div className="editor-label">
            {t("二维码预览")}
            <span>
              {output.qr
                ? `${output.qr.modules.size} × ${output.qr.modules.size}`
                : t("等待输入")}
            </span>
          </div>
          <div className="qr-preview-body">
            {output.svg ? (
              <img
                alt={t("二维码预览")}
                src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(output.svg)}`}
              />
            ) : (
              <div
                className={output.error ? "output-error" : "qr-empty"}
                role={output.error ? "alert" : undefined}
              >
                {output.error
                  ? errorText(output.error)
                  : t("输入内容后生成二维码")}
              </div>
            )}
          </div>
          <div className="qr-actions">
            <button
              className="primary"
              disabled={!output.qr || saving}
              onClick={() => void exportImage("png")}
            >
              <Download size={14} />
              {t("导出 PNG")}
            </button>
            <button
              className="secondary"
              disabled={!output.qr || saving}
              onClick={() => void exportImage("svg")}
            >
              {t("导出 SVG")}
            </button>
            <button
              className="secondary"
              disabled={!output.qr}
              onClick={() =>
                void copy(output.svg)
                  .then(() => notify(t("SVG 已复制")))
                  .catch((e) => notify(errorText(e)))
              }
            >
              <Copy size={14} />
              {t("复制 SVG")}
            </button>
          </div>
        </div>
      </div>
      <div className="workspace-note">
        <ShieldCheck size={14} />
        {t("保留白色边距以便扫描；PNG 按整数像素绘制，尺寸可能略小于所选值。")}
      </div>
    </section>
  );
}
