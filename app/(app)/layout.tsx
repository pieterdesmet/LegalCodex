import { clearSession, requireUser } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  async function logoutAction() {
    "use server";
    clearSession();
    redirect("/login");
  }

  return (
    <div className="min-h-screen md:flex">
      <Sidebar />
      <main className="flex-1">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:px-8">
          <div>
            <p className="text-sm font-medium text-slate-900">{user.name}</p>
            <p className="text-xs text-slate-500">{user.role}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              Sign out
            </button>
          </form>
        </header>
        <div className="p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
