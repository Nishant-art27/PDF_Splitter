import Icon from "./Icon";
import ContactAdmin from "./ContactAdmin";

/**
 * Shown when the site is effectively down: the frontend crashed or the
 * server cannot be reached.
 */
export default function MaintenancePage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-100 px-4">
      <div className="h-1 bg-gradient-to-r from-indigo-600 via-sky-400 to-indigo-600" />
      <div className="flex justify-end px-4 pt-4 sm:px-6">
        <ContactAdmin tone="light" />
      </div>
      <div className="flex flex-1 items-center justify-center pb-24">
        <div className="animate-fade-up w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
            <Icon name="wrench" className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-slate-900">
            The site is under maintenance
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Something went wrong or the server is not reachable right now. Please try again in a
            few minutes — if it keeps happening, contact the admin.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 px-4 py-3 font-semibold text-white shadow-md shadow-indigo-500/25 transition-all hover:from-indigo-700 hover:to-indigo-600"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
