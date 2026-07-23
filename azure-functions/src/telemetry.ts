import appInsights from "applicationinsights";

if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  appInsights
    .setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING)
    .setAutoDependencyCorrelation(true)
    .setAutoCollectRequests(false)     // host already tracks invocations
    .setAutoCollectPerformance(false)  // not needed in Functions
    .setAutoCollectExceptions(true)    // uncaught exceptions → App Insights
    .setAutoCollectDependencies(true)  // DB queries, HTTP calls auto-tracked
    .setAutoCollectConsole(true, true) // console.log → traces
    .setSendLiveMetrics(false)
    .start();
}
