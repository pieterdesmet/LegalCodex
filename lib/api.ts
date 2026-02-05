import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function requireApiUser() {
  const user = await getCurrentUser();
  if (!user) {
    return { error: jsonError("Unauthorized", 401), user: null } as const;
  }

  return { error: null, user } as const;
}

export async function parseBody<TSchema extends z.ZodTypeAny>(
  request: Request,
  schema: TSchema
): Promise<
  | { data: z.infer<TSchema>; error: null }
  | {
      data: null;
      error: Response;
    }
> {
  try {
    const body = await request.json();
    const data = schema.parse(body);
    return { data, error: null };
  } catch {
    return { data: null, error: jsonError("Invalid request body", 422) };
  }
}
