import { useEffect, useState } from "react";
import type { ProcessResponse } from "../types";
import { fileDownloadUrl, zipDownloadUrl, destroyResultSession } from "../api";
import { formatRemaining, formatSize } from "../format";
import Icon from "./Icon";

export default function ResultsPanel({
  result,
  onReset,
}: {
  result: ProcessResponse;
  onReset: () => void;
}) {
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Refreshing or closing the page erases the generated PDFs from the
  // server immediately — nothing lingers once the results leave the screen.
  useEffect(() => {
    const wipe = () => destroyResultSession(result.sessionId);
    window.addEventListener("pagehide", wipe);
    return () => window.removeEventListener("pagehide", wipe);
  }, [result.sessionId]);

  const remaining = result.expiresAt - now;
  const expired = remaining <= 0;
  const expiringSoon = !expired && remaining < 2 * 60 * 1000;
  const includedCount = result.files.length - excluded.size;

  function toggle(id: string) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="animate-fade-up flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
            <Icon name="documents" className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-semibold tracking-tight">
              {result.files.length} document{result.files.length === 1 ? "" : "s"} generated
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-600">
                {result.totalPages} source pages
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 font-medium ${
                  result.mode === "headers"
                    ? "bg-indigo-50 text-indigo-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                {result.mode === "headers" ? "Header detection" : "Fallback mode"}
              </span>
              <span
                className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 font-medium ${
                  expired
                    ? "bg-red-50 text-red-700"
                    : expiringSoon
                      ? "bg-red-50 text-red-600"
                      : "bg-slate-100 text-slate-600"
                }`}
              >
                <Icon name="clock" className="h-3.5 w-3.5" />
                {expired ? "expired — re-process to download" : `expires in ${formatRemaining(remaining)}`}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={onReset}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-slate-50"
        >
          Process another PDF
        </button>
      </div>

      {result.mode === "fallback" && (
        <div className="animate-fade-up flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            No configured legal classification header was found, so the document was treated as a
            normal PDF and split by detected section headings. Files named “not done …” need
            manual review.
          </span>
        </div>
      )}

      <ul className="space-y-3">
        {result.files.map((file, i) => {
          const isExcluded = excluded.has(file.id);
          const needsReview = file.filename.toLowerCase().startsWith("not done");
          const disabled = expired || isExcluded;
          return (
            <li
              key={file.id}
              style={{ animationDelay: `${i * 50}ms` }}
              className={`animate-fade-up rounded-2xl border bg-white p-4 shadow-sm transition-all ${
                isExcluded ? "border-slate-200 opacity-55" : "border-slate-200 hover:shadow-md"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      needsReview ? "bg-amber-100 text-amber-600" : "bg-indigo-50 text-indigo-600"
                    }`}
                  >
                    <Icon name={needsReview ? "alert" : "document"} className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="break-all font-semibold tracking-tight">{file.filename}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-600">
                        Pages {file.pageStart}–{file.pageEnd}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-600">
                        {formatSize(file.sizeBytes)}
                      </span>
                      {needsReview && (
                        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 font-medium text-amber-700">
                          needs manual review
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => toggle(file.id)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                      isExcluded
                        ? "border-red-600 bg-red-600 text-white hover:bg-red-700"
                        : "border-slate-300 bg-white text-slate-600 hover:border-red-300 hover:text-red-600"
                    }`}
                  >
                    <Icon name={isExcluded ? "x" : "check"} className="h-3.5 w-3.5" />
                    {isExcluded ? "Excluded" : "Exclude"}
                  </button>
                  <a
                    href={disabled ? undefined : fileDownloadUrl(result.sessionId, file.id)}
                    download={file.filename}
                    aria-disabled={disabled}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      disabled
                        ? "pointer-events-none bg-slate-100 text-slate-400"
                        : "bg-slate-900 text-white hover:bg-slate-700"
                    }`}
                  >
                    <Icon name="download" className="h-3.5 w-3.5" />
                    Download
                  </a>
                </div>
              </div>
              {file.previewText && (
                <p className="mt-3 rounded-lg border-l-2 border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-600">
                  {file.previewText}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <a
        href={
          expired || includedCount === 0
            ? undefined
            : zipDownloadUrl(result.sessionId, [...excluded])
        }
        aria-disabled={expired || includedCount === 0}
        className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 font-semibold transition-all ${
          expired || includedCount === 0
            ? "pointer-events-none bg-slate-200 text-slate-400"
            : "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-500/25 hover:from-indigo-700 hover:to-indigo-600 hover:shadow-lg hover:shadow-indigo-500/30"
        }`}
      >
        <Icon name="archive" className="h-5 w-5" />
        Download all as ZIP ({includedCount} file{includedCount === 1 ? "" : "s"})
      </a>
    </div>
  );
}
