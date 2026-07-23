import Icon from "./Icon";

export const ADMIN_EMAIL = "mnishant2173@gmail.com";

/**
 * Small "contact admin" box shown in the top-right corner. `tone` matches
 * it to the dark header/login backdrop or a light page.
 */
export default function ContactAdmin({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const styles =
    tone === "dark"
      ? "bg-white/10 text-slate-300 ring-white/10 hover:bg-white/20 hover:text-white"
      : "bg-white text-slate-600 ring-slate-200 shadow-sm hover:text-indigo-700";
  return (
    <a
      href={`mailto:${ADMIN_EMAIL}`}
      title={`Email the administrator: ${ADMIN_EMAIL}`}
      className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs ring-1 ring-inset transition-colors ${styles}`}
    >
      <Icon name="mail" className="h-4 w-4 shrink-0" />
      <span className="text-left leading-tight">
        <span className="block font-semibold">Contact admin</span>
        <span className={tone === "dark" ? "text-slate-400" : "text-slate-400"}>
          {ADMIN_EMAIL}
        </span>
      </span>
    </a>
  );
}
