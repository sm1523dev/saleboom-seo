import { app, InvocationContext, Timer } from "@azure/functions";
import { queueProvider } from "../../../lib/queue";

async function digestTimerHandler(_timer: Timer, context: InvocationContext): Promise<void> {
  await queueProvider.enqueue("digest", { triggeredBy: "weekly-timer" });
  context.log("Weekly digest job enqueued");
}

app.timer("digest-timer", {
  schedule: "0 8 * * 1",  // Mondays at 8am UTC
  handler: digestTimerHandler,
});
