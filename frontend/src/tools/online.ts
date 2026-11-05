export const languages = [
  ["zh-CN", "简体中文"],
  ["zh-TW", "繁体中文"],
  ["en", "英语"],
  ["ja", "日语"],
  ["ko", "韩语"],
  ["fr", "法语"],
  ["de", "德语"],
  ["es", "西班牙语"],
  ["ru", "俄语"],
  ["pt", "葡萄牙语"],
  ["it", "意大利语"],
];
export type Translation = {
  text: string;
  detected: string;
  validationVersion?: number;
};
export function translationScriptValid(text: string, target: string) {
  if (!["en", "fr", "de", "es", "pt", "it"].includes(target)) return true;
  return !/\p{L}/u.test(text) || /\p{Script=Latin}/u.test(text);
}
export type Provider = "google" | "mymemory";
export function translationError(error: unknown, provider: Provider) {
  const message = (
    error instanceof Error ? error.message : String(error)
  ).replace(/^(?:(?:RuntimeError|Error):\s*)+/, "");
  if (/deadline|TimeoutError|timed out/i.test(message))
    return "翻译超时，请检查网络或切换翻译源";
  if (provider === "mymemory")
    return message === "429"
      ? "MyMemory请求频率受限（HTTP 429）"
      : message || "MyMemory翻译失败，请稍后重试或切换翻译源";
  if (/429|过于频繁|限流/.test(message))
    return provider === "google"
      ? "Google 翻译已限流（429）。可切换到 MyMemory，或稍后再试。"
      : "翻译请求受限，请稍后重试。";
  return message || "翻译失败，请稍后重试";
}
export function guessSource(text: string) {
  return /[\u3400-\u9fff]/.test(text) ? "zh-CN" : "en";
}
export function googleSearchURL(query: string) {
  if (!query.trim() || [...query].length > 5000)
    throw Error("搜索内容须为1～5000字符");
  return "https://www.google.com/search?" + new URLSearchParams({ q: query });
}
export function translationRequest(
  text: string,
  source: string,
  target: string,
  provider: Provider,
) {
  if (!text.trim() || [...text].length > 5000)
    throw Error("翻译内容须为1～5000字符");
  const valid = new Set(languages.map(([id]) => id));
  if (!valid.has(target) || !(valid.has(source) || source === "auto"))
    throw Error("请选择有效语言");
  if (provider === "mymemory") {
    if (new TextEncoder().encode(text).length > 500)
      throw Error("MyMemory每次支持最多500字节，请缩短文本或选择Google翻译");
    if (source === "auto" || source === target)
      throw Error("请选择不同的原文和目标语言");
    return (
      "https://api.mymemory.translated.net/get?" +
      new URLSearchParams({ q: text, langpair: source + "|" + target })
    );
  }
  return (
    "https://translate.googleapis.com/translate_a/single?" +
    new URLSearchParams({
      client: "gtx",
      sl: source,
      tl: target,
      dt: "t",
      q: text,
    })
  );
}
export function parseTranslation(
  body: unknown,
  source: string,
  provider: Provider,
  original = "",
  target = "",
): Translation {
  if (provider === "mymemory") {
    const data = body as {
      responseStatus?: number | string;
      responseDetails?: string;
      quotaFinished?: boolean | string;
      responseData?: { translatedText?: unknown };
      matches?: {
        segment?: unknown;
        translation?: unknown;
        source?: unknown;
        target?: unknown;
        match?: unknown;
      }[];
    };
    if (!data || typeof data !== "object")
      throw Error("MyMemory响应格式异常，未取得译文；请稍后重试或切换翻译源");
    const status = Number(data.responseStatus),
      details = String(data.responseDetails || "").toUpperCase();
    if (
      data.quotaFinished === true ||
      data.quotaFinished === "true" ||
      status === 429 ||
      /USED ALL AVAILABLE FREE TRANSLATIONS|DAILY LIMIT|QUOTA EXCEEDED/.test(
        details,
      )
    )
      throw Error(
        "MyMemory免费翻译额度已用完或请求受限，请稍后重试或切换翻译源",
      );
    if (status !== 200)
      throw Error(
        `MyMemory拒绝了翻译请求（服务状态 ${Number.isFinite(status) ? status : 0}），请检查原文与语言选择或切换翻译源`,
      );
    if (typeof data.responseData?.translatedText !== "string")
      throw Error("MyMemory响应格式异常，未取得译文；请稍后重试或切换翻译源");
    if (!data.responseData.translatedText.trim())
      throw Error("MyMemory未找到这段文字的译文，请修改原文或切换翻译源");
    // Decode HTML entities as text, never insert provider HTML into the DOM.
    const node = document.createElement("textarea");
    const decode = (text: string) => {
      node.innerHTML = text;
      return node.value;
    };
    let text = decode(data.responseData.translatedText);
    if (!translationScriptValid(text, target)) {
      const base = (value: unknown) =>
        typeof value === "string" ? value.toLowerCase().split("-")[0] : "";
      text =
        (Array.isArray(data.matches) ? data.matches : [])
          .filter(
            (m) =>
              typeof m?.segment === "string" &&
              m.segment.trim() === original.trim() &&
              base(m.source) === base(source) &&
              base(m.target) === base(target) &&
              Number(m.match) === 1 &&
              typeof m.translation === "string",
          )
          .map((m) => decode(m.translation as string))
          .find(
            (value) => value.trim() && translationScriptValid(value, target),
          ) || "";
      if (!text)
        throw Error("MyMemory返回的译文与目标语言不符，已拦截；请切换翻译源");
    }
    return { text, detected: source, validationVersion: 1 };
  }
  if (!Array.isArray(body) || !Array.isArray(body[0]))
    throw Error("翻译服务返回了无法识别的结果");
  const text = body[0]
    .map((segment: unknown) => {
      if (!Array.isArray(segment) || typeof segment[0] !== "string")
        throw Error("翻译服务返回了无法识别的结果");
      return segment[0];
    })
    .join("");
  if (!text) throw Error("翻译服务未返回译文");
  return { text, detected: typeof body[2] === "string" ? body[2] : "" };
}

export function translationPageURL(
  text: string,
  source: string,
  target: string,
) {
  translationRequest(text || "x", source, target, "google");
  return (
    "https://translate.google.com/?" +
    new URLSearchParams({ sl: source, tl: target, text, op: "translate" })
  );
}
