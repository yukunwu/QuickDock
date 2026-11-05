import { useState } from "react";
import { getTranslationDraft, setDockTranslation } from "./toolSession";
import DockTranslation from "./DockTranslation";
export default function TranslationWorkspace({
  back,
  notify,
}: {
  back: () => void;
  notify: (s: string) => void;
}) {
  const [query, setQuery] = useState(() => getTranslationDraft()?.query || "");
  const change = (text: string) => {
    setQuery(text);
    const previous = getTranslationDraft();
    if (previous)
      setDockTranslation({ ...previous, query: text, answer: null });
  };
  return (
    <section className="workspace translation-workspace">
      <DockTranslation
        query={query}
        onQueryChange={change}
        visible={true}
        autoRun={false}
        back={back}
        notify={notify}
      />
    </section>
  );
}
