import { app, InvocationContext, Timer } from "@azure/functions";
import { handlePrPollJob } from "@/workers/handlers/pr-poll.handler";

async function prPollTimerHandler(_timer: Timer, context: InvocationContext): Promise<void> {
  context.log("pr-poll-timer: checking open PRs");
  await handlePrPollJob(undefined, {
    jobId: context.invocationId,
    attemptNumber: 1,
    log: (msg: string) => context.log(msg),
    updateProgress: async () => {},
  });
}

app.timer("pr-poll-timer", {
  schedule: "0 */5 * * * *",  // every 5 minutes
  handler: prPollTimerHandler,
});
