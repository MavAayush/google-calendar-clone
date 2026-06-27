export class ApiError extends Error {
  code: string;
  fields: Record<string, string> | null;

  constructor(code: string, message: string, fields: Record<string, string> | null = null) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.fields = fields;
  }
}

export const request = async <T>(url: string, config?: RequestInit): Promise<T> => {
  const res = await fetch(url, config);

  if (res.status === 204) {
    return null as unknown as T;
  }

  if (res.ok) {
    return res.json() as Promise<T>;
  }

  let errorBody: { error?: { code?: string; message?: string; fields?: Record<string, string> | null } } | undefined;
  try {
    errorBody = await res.json();
  } catch {
    // Fail silently
  }

  const errData = errorBody?.error;
  if (errData && typeof errData.code === "string" && typeof errData.message === "string") {
    throw new ApiError(errData.code, errData.message, errData.fields || null);
  }

  throw new ApiError(
    "INTERNAL_ERROR",
    `Request failed with status ${res.status}`
  );
};
