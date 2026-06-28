import { z } from "zod";

export const ScanJobMessageSchema = z.object({
  scanId: z.string().uuid(),
  websiteId: z.string().uuid(),
  enqueuedAt: z.string().datetime(),
});

export type ScanJobMessage = z.infer<typeof ScanJobMessageSchema>;

export const QUEUE_NAMES = {
  SCAN_JOBS: "scan-jobs",
  SCAN_JOBS_POISON: "scan-jobs-poison",
} as const;
