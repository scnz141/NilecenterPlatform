export type NccReadState<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "unavailable" }
  | { status: "workspace" }
  | { status: "error"; message: string };

export function classifyNccFailure(result: {
  status?: number;
  error?: string;
}): NccReadState<never> {
  if (result.status === 503 || result.status === 404) {
    return { status: "unavailable" };
  }
  if (result.status === 400 && /branch/i.test(result.error ?? "")) {
    return { status: "workspace" };
  }
  return {
    status: "error",
    message: result.error ?? "EMS data could not be loaded.",
  };
}
