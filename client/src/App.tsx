import { useEffect, useState } from "react";
import type { ProcessResponse } from "./types";
import { fetchMe, logout, setUnauthorizedHandler } from "./api";
import UploadPanel from "./components/UploadPanel";
import ResultsPanel from "./components/ResultsPanel";
import SettingsPanel from "./components/SettingsPanel";
import AuthPage from "./components/AuthPage";
import ContactAdmin from "./components/ContactAdmin";
import MaintenancePage from "./components/MaintenancePage";
import Icon, { Spinner } from "./components/Icon";

type Tab = "split" | "settings";

export default function App() {
  const [tab, setTab] = useState<Tab>("split");
  const [result, setResult] = useState<ProcessResponse | null>(null);
  const [user, setUser] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [serverDown, setServerDown] = useState(false);

  useEffect(() => {
    // Any 401 from the API (expired session, server restart) drops the
    // app back to the login page.
    setUnauthorizedHandler(() => setUser(null));
    fetchMe()
      .then(setUser)
      .catch(() => setServerDown(true))
      .finally(() => setAuthChecked(true));
  }, []);

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // Server unreachable — still sign out locally.
    }
    setUser(null);
    setResult(null);
    setTab("split");
  }

  if (serverDown) {
    return <MaintenancePage />;
  }

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-400">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage onLogin={setUser} />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-900">
      <div className="h-1 bg-gradient-to-r from-indigo-600 via-sky-400 to-indigo-600" />
      <header className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white shadow-lg">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/20 ring-1 ring-inset ring-indigo-400/40">
              <Icon name="documents" className="h-6 w-6 text-indigo-300" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Legal PDF Splitter</h1>
              <p className="text-sm text-slate-400">
                Split court bundles by case classification headers
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ContactAdmin tone="dark" />
            <nav className="flex gap-1 rounded-xl bg-white/10 p-1 ring-1 ring-inset ring-white/10">
              <TabButton active={tab === "split"} onClick={() => setTab("split")}>
                Split PDF
              </TabButton>
              <TabButton active={tab === "settings"} onClick={() => setTab("settings")}>
                Header Settings
              </TabButton>
            </nav>
            <div className="flex items-center gap-1.5 rounded-xl bg-white/10 py-1 pl-3 pr-1 text-sm ring-1 ring-inset ring-white/10">
              <span className="max-w-32 truncate font-medium text-slate-200">{user}</span>
              <button
                onClick={handleLogout}
                title="Sign out"
                className="rounded-lg px-2 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        {tab === "split" ? (
          result ? (
            <ResultsPanel
              key={result.sessionId}
              result={result}
              onReset={() => setResult(null)}
            />
          ) : (
            <UploadPanel onProcessed={setResult} />
          )
        ) : (
          <SettingsPanel />
        )}
      </main>

      <footer className="mx-auto w-full max-w-4xl px-4 pb-8 sm:px-6">
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
          <Icon name="shield" className="h-4 w-4 shrink-0 text-slate-400" />
          <span>
            Documents are processed in memory and never stored on the server. Generated files
            expire automatically after about 10 minutes.
          </span>
        </div>
      </footer>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-all ${
        active
          ? "bg-white text-slate-900 shadow-sm"
          : "text-slate-300 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
