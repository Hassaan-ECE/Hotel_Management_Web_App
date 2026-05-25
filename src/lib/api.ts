import { ZodSchema } from "zod";
import { badRequest, errorResponse } from "@/lib/errors";

export async function parseJson<T>(request: Request, schema: ZodSchema<T>) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw badRequest(parsed.error.issues.map((issue) => issue.message).join(", "));
  }
  return parsed.data;
}

export function apiError(error: unknown) {
  return errorResponse(error);
}