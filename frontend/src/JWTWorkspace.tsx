import { useMemo } from "react";
import { Copy, ShieldAlert } from "lucide-react";
import { errorText, getLanguage, t, useLocale } from "./i18n";
import ToolHeader, { copyText } from "./ToolHeader";
import { useToolDraft } from "./useToolDraft";
import { jwtDecode } from "./tools/devtools";
import { relativeTime } from "./tools/time";
const claimLabel: Record<string, string> = {
  iat: "签发时间 iat",
  nbf: "生效时间 nbf",
  exp: "过期时间 exp",
};
export default function JWTWorkspace({
  back,
  notify,
}: {
  back: () => void;
  notify: (s: string) => void;
}) {
  useLocale();
  const [state, update] = useToolDraft("jwt", {});
  const decoded = useMemo(() => {
    if (!state.input.trim()) return { value: null, error: "" };
    try {
      return { value: jwtDecode(state.input), error: "" };
    } catch (e) {
      return { value: null, error: errorText(e) };
    }
  }, [state.input]);
  const jwt = decoded.value;
  const section = (title: string, body: string) => (
    <div className="jwt-section">
      <div className="editor-label">
        {title}
        <button
          className="icon-button"
          aria-label={t("复制 {text}", { text: title })}
          onClick={() => copyText(body, notify)}
        >
          <Copy size={13} />
        </button>
      </div>
      <pre>{body}</pre>
    </div>
  );
  return (
    <section className="workspace devtool-workspace">
      <ToolHeader id="jwt" back={back} notify={notify} />
      <div className="editor-grid jwt-grid">
        <div className="editor-pane">
          <div className="editor-label">
            {t("JWT 令牌")}
            <span>{t("可包含 Bearer 前缀")}</span>
          </div>
          <textarea
            autoFocus
            aria-label={t("JWT 令牌")}
            spellCheck={false}
            placeholder="eyJhbGciOi…"
            value={state.input}
            onChange={(e) => update({ input: e.target.value })}
          />
        </div>
        <div className="editor-pane output jwt-output">
          {decoded.error ? (
            <pre className="output-error" role="alert">
              {decoded.error}
            </pre>
          ) : !jwt ? (
            <div className="empty">{t("粘贴 JWT 查看头部、载荷和有效期")}</div>
          ) : (
            <>
              <div className="jwt-status">
                <span className="tag">{jwt.algorithm || "none"}</span>
                {jwt.expired ? (
                  <span className="jwt-badge bad">{t("已过期")}</span>
                ) : jwt.notYetValid ? (
                  <span className="jwt-badge bad">{t("尚未生效")}</span>
                ) : (
                  jwt.times.some((c) => c.name === "exp") && (
                    <span className="jwt-badge good">{t("有效期内")}</span>
                  )
                )}
              </div>
              {jwt.times.length > 0 && (
                <dl className="jwt-times">
                  {jwt.times.map((c) => (
                    <div key={c.name}>
                      <dt>{t(claimLabel[c.name])}</dt>
                      <dd>
                        {new Date(c.ms).toLocaleString(getLanguage())} ·{" "}
                        {relativeTime(c.ms, Date.now(), getLanguage())}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              {section(t("头部 Header"), jwt.header)}
              {section(t("载荷 Payload"), jwt.payload)}
            </>
          )}
        </div>
      </div>
      <div className="workspace-note">
        <ShieldAlert size={14} />
        {t("只解码，不校验签名；令牌在本机解析，不会上传。")}
      </div>
    </section>
  );
}
