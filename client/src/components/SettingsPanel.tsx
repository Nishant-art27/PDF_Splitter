import { useEffect, useState } from "react";
import { fetchHeaders, saveHeaders } from "../api";
import Icon, { Spinner } from "./Icon";

/**
 * Manage the legal classification headers used to detect document
 * boundaries. Persisted server-side so they survive restarts.
 */
export default function SettingsPanel() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [defaults, setDefaults] = useState<string[]>([]);
  const [newHeader, setNewHeader] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchHeaders()
      .then((res) => {
        setHeaders(res.headers);
        setDefaults(res.defaults);
      })
      .catch((err) =>
        setMessage({ kind: "error", text: err instanceof Error ? err.message : "Load failed." })
      )
      .finally(() => setLoading(false));
  }, []);

  function update(mutate: (prev: string[]) => string[]) {
    setHeaders(mutate);
    setDirty(true);
    setMessage(null);
  }

  function addHeader() {
    const value = newHeader.trim();
    if (!value) return;
    if (headers.some((h) => h.toUpperCase() === value.toUpperCase())) {
      setMessage({ kind: "error", text: `"${value}" is already in the list.` });
      return;
    }
    update((prev) => [...prev, value]);
    setNewHeader("");
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setMessage(null);
    try {
      const saved = await saveHeaders(headers);
      setHeaders(saved);
      setDirty(false);
      setMessage({ kind: "ok", text: "Headers saved." });
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Save failed." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-500">
        <Spinner className="h-4 w-4" /> Loading headers…
      </div>
    );
  }

  return (
    <div className="animate-fade-up space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
          <Icon name="sliders" className="h-6 w-6" />
        </div>
        <div>
          <h2 className="font-semibold tracking-tight">Classification headers</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            A new document starts whenever a page begins with one of these headers (checked in the
            top lines of each page; case, punctuation, and a leading serial number like the “31” in
            “31 Cr. Case 8295/2025” are ignored). This list is saved to your account — it stays
            yours after you sign out, and other users have their own.
          </p>
        </div>
      </div>

      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {headers.map((header, i) => (
          <li key={i} className="group flex items-center gap-2 px-4 py-2 transition-colors hover:bg-slate-50">
            <span className="w-7 shrink-0 text-right font-mono text-xs text-slate-300">
              {i + 1}
            </span>
            <input
              value={header}
              onChange={(e) => update((prev) => prev.map((h, j) => (j === i ? e.target.value : h)))}
              className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 font-mono text-sm transition-colors hover:border-slate-200 focus:border-indigo-400 focus:bg-white focus:outline-none"
            />
            <button
              onClick={() => update((prev) => prev.filter((_, j) => j !== i))}
              className="shrink-0 rounded-lg p-2 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-600 group-hover:text-slate-400"
              title="Remove header"
              aria-label={`Remove header ${header}`}
            >
              <Icon name="trash" className="h-4 w-4" />
            </button>
          </li>
        ))}
        {headers.length === 0 && (
          <li className="px-4 py-4 text-sm text-slate-500">
            No headers configured — every upload will use fallback mode.
          </li>
        )}
      </ul>

      <div className="flex gap-2">
        <input
          value={newHeader}
          onChange={(e) => setNewHeader(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addHeader()}
          placeholder="Add a header, e.g. CRL REV"
          className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-indigo-400 focus:outline-none"
        />
        <button
          onClick={addHeader}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-slate-50"
        >
          <Icon name="plus" className="h-4 w-4" /> Add
        </button>
      </div>

      {message && (
        <div
          className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${
            message.kind === "ok"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          <Icon name={message.kind === "ok" ? "check" : "alert"} className="mt-0.5 h-4 w-4 shrink-0" />
          {message.text}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!dirty || saving || headers.every((h) => h.trim() === "")}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 px-5 py-2.5 font-semibold text-white shadow-md shadow-indigo-500/25 transition-all hover:from-indigo-700 hover:to-indigo-600 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
        >
          {saving ? <Spinner className="h-4 w-4" /> : <Icon name="check" className="h-4 w-4" />}
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button
          onClick={() => {
            setHeaders(defaults);
            setDirty(true);
            setMessage(null);
          }}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium shadow-sm transition-colors hover:bg-slate-50"
        >
          Restore defaults
        </button>
        {dirty && (
          <span className="flex items-center gap-1.5 text-sm font-medium text-amber-600">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Unsaved changes
          </span>
        )}
      </div>
    </div>
  );
}
