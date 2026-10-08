import { toast } from "sonner";
import { StaffApiError } from "./session";
import { copy } from "./copy";

/**
 * Thrown by a form submit when its own field checks fail. The fields already
 * show inline errors, so `runAction` shows no toast and no success copy.
 */
export class FormValidationError extends Error {
  constructor() {
    super("Form has invalid fields.");
    this.name = "FormValidationError";
  }
}

/**
 * Runs an async action, toasting the success copy on completion and the
 * provider message on failure. Returns the result or undefined on error.
 * 422 responses surface their field errors in the toast description.
 */
export async function runAction<T>(
  fn: () => Promise<T>,
  opts: {
    success?: string;
    error?: string;
    onError?: (error: unknown) => void;
  } = {}
): Promise<T | undefined> {
  try {
    const result = await fn();
    if (opts.success) toast.success(opts.success);
    return result;
  } catch (error) {
    if (error instanceof FormValidationError) return undefined;
    const message =
      error instanceof Error ? error.message : (opts.error ?? copy.state.errorGeneric);
    if (error instanceof StaffApiError && error.status === 422 && error.details) {
      const fields = Object.entries(error.details)
        .map(([field, errors]) => `${field}: ${errors.join(", ")}`)
        .join(" ");
      toast.error(opts.error ?? copy.state.error422, {
        description: fields || message,
      });
    } else {
      toast.error(message || opts.error || copy.state.errorGeneric);
    }
    opts.onError?.(error);
    return undefined;
  }
}
