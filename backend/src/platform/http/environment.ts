export type WorkerHttpEnv = {
  Bindings: CloudflareBindings;
  Variables: { requestId: string };
};
