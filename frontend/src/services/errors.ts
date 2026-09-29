// Turn an unknown thrown value into a user-facing message.
export const errorMessage = (err: unknown, fallback: string): string =>
  err instanceof Error && err.message ? err.message : fallback;
