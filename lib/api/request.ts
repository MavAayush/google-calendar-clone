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
    const text = await res.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`Failed to parse JSON response. Status: ${res.status}. Body: ${text.substring(0, 150)}`);
    }
  }

  let errorBody: { error?: { code?: string; message?: string; fields?: Record<string, string> | null } } | undefined;
  try {
    const errorText = await res.text();
    errorBody = JSON.parse(errorText);
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
