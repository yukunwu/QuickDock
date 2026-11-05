export const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
export const commandLabel = isMac ? "⌘" : "Ctrl";
export const defaultShortcut = isMac ? "Option+Space" : "Ctrl+Alt+Space";
