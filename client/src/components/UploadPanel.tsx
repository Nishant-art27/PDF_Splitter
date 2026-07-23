import { useRef, useState } from "react";
import type { ProcessResponse } from "../types";
import { processPdf } from "../api";
import { formatSize } from "../format";
import Icon, { Spinner } from "./Icon";

const STEPS = [
  { title: "Upload the bundle", text: "One searchable (text-based) court PDF." },
  { title: "Automatic detection", text: "Page tops are matched against your headers." },
  { title: "Review & download", text: "Exclude what you don't need, save PDFs or a ZIP." },
];

export default function UploadPanel({
  onProcessed,
}: {
  onProcessed: (result: ProcessResponse) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function pick(candidate: File | undefined) {
    setError(null);
    if (!candidate) return;
    if (!candidate.name.toLowerCase().endsWith(".pdf") && candidate.type !== "application/pdf") {
      setError("Please choose a PDF file.");
      return;
    }
    setFile(candidate);
  }

  async function handleProcess() {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      onProcessed(await processPdf(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-fade-up space-y-5">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          pick(e.dataTransfer.files[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-white px-6 py-14 text-center shadow-sm transition-all ${
          dragOver
            ? "scale-[1.01] border-indigo-500 bg-indigo-50"
            : "border-slate-300 hover:border-indigo-400 hover:shadow-md"
        }`}
      >
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-full transition-colors ${
            dragOver ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-400"
          }`}
        >
          <Icon name="cloudUp" className="h-8 w-8" />
        </div>
        <p className="mt-4 text-lg font-semibold tracking-tight">
          {dragOver ? "Drop it here" : "Drop a PDF here, or click to browse"}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Searchable (text-based) PDFs only — scanned documents are not supported
        </p>

        {file && (
          <div
            className="mt-5 flex max-w-full items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 py-1.5 pl-3 pr-1.5 text-sm text-indigo-900"
            onClick={(e) => e.stopPropagation()}
          >
            <Icon name="document" className="h-4 w-4 shrink-0 text-indigo-500" />
            <span className="truncate font-medium">{file.name}</span>
            <span className="shrink-0 text-indigo-400">{formatSize(file.size)}</span>
            <button
              onClick={() => setFile(null)}
              title="Remove file"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-indigo-400 transition-colors hover:bg-indigo-100 hover:text-indigo-700"
            >
              <Icon name="x" className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <button
        onClick={handleProcess}
        disabled={!file || busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 px-4 py-3.5 font-semibold text-white shadow-md shadow-indigo-500/25 transition-all hover:from-indigo-700 hover:to-indigo-600 hover:shadow-lg hover:shadow-indigo-500/30 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
      >
        {busy ? (
          <>
            <Spinner className="h-5 w-5" /> Processing…
          </>
        ) : (
          <>
            <Icon name="documents" className="h-5 w-5" /> Split PDF
          </>
        )}
      </button>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <div
            key={step.title}
            className="rounded-xl border border-slate-200 bg-white/70 p-4"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                {i + 1}
              </span>
              <p className="text-sm font-semibold">{step.title}</p>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">{step.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
