export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const unauthorized = (message = "You must sign in to continue.") => new HttpError(401, message);
export const forbidden = (message = "You do not have access to this resource.") => new HttpError(403, message);
export const notFound = (message = "The requested resource was not found.") => new HttpError(404, message);
export const badRequest = (message = "The request could not be processed.") => new HttpError(400, message);

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof Error && error.message.includes("DATABASE_URL")) {
    return Response.json({ error: error.message }, { status: 503 });
  }
  console.error(error);
  return Response.json({ error: "Unexpected server error." }, { status: 500 });
}