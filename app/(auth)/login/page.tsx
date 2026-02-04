import { redirect } from "next/navigation";
import { authenticate, createSession, getCurrentUser } from "@/lib/auth";
import { loginSchema } from "@/lib/validators";

export default async function LoginPage({
  searchParams
}: {
  searchParams: { error?: string; next?: string };
}) {
  const existingUser = await getCurrentUser();
  if (existingUser) {
    redirect("/dashboard");
  }

  async function loginAction(formData: FormData) {
    "use server";

    const parsed = loginSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password")
    });

    if (!parsed.success) {
      redirect("/login?error=invalid_input");
    }

    const user = await authenticate(parsed.data.email, parsed.data.password);
    if (!user) {
      redirect("/login?error=invalid_credentials");
    }

    await createSession(user);
    const next = String(formData.get("next") || "/dashboard");
    redirect(next.startsWith("/") ? next : "/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Legal Practice MVP</h1>
        <p className="mt-1 text-sm text-slate-600">Sign in to continue.</p>

        {searchParams.error ? (
          <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {searchParams.error === "invalid_credentials"
              ? "Invalid email or password."
              : "Please fill in a valid email and password."}
          </div>
        ) : null}

        <form action={loginAction} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={searchParams.next ?? "/dashboard"} />
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="admin@demo.law"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="demo1234"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
