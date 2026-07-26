// applicationinsights is deferred until after synchronous module loading completes.
// Loading it eagerly from Azure Files takes >30s (many transitive deps), blocking GRPC
// worker registration and triggering a host timeout before any functions are registered.
// setImmediate fires after all synchronous module init — GRPC registration is done by then.
setImmediate(() => {
  if (!process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ai = require("applicationinsights") as typeof import("applicationinsights");
  ai.setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING)
    .setAutoDependencyCorrelation(true)
    .setAutoCollectRequests(false)     // host already tracks invocations
    .setAutoCollectPerformance(false)  // not needed in Functions
    .setAutoCollectExceptions(true)    // uncaught exceptions → App Insights
    .setAutoCollectDependencies(true)  // DB queries, HTTP calls auto-tracked
    .setAutoCollectConsole(true, true) // console.log → traces
    .setSendLiveMetrics(false)
    .start();
});
