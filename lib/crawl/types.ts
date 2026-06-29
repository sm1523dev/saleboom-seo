import { z } from "zod";

export const PageMetadataSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  language: z.string().optional(),
  url: z.string().optional(),
  ogTitle: z.string().optional(),
  ogDescription: z.string().optional(),
  ogImage: z.string().optional(),
  statusCode: z.number().optional(),
});

export type PageMetadata = z.infer<typeof PageMetadataSchema>;

export const PageResultSchema = z.object({
  url: z.string(),
  markdown: z.string().optional(),
  html: z.string().optional(),
  links: z.array(z.string()).optional(),
  metadata: PageMetadataSchema.optional(),
});

export type PageResult = z.infer<typeof PageResultSchema>;

export const CrawlResultSchema = z.object({
  jobId: z.string(),
  total: z.number(),
  pages: z.array(PageResultSchema),
});

export type CrawlResult = z.infer<typeof CrawlResultSchema>;

export type ScrapeOpts = {
  limit?: number;
};

export interface CrawlProvider {
  scrapeUrl(url: string, opts?: ScrapeOpts): Promise<PageResult>;
  crawlSite(url: string, opts?: ScrapeOpts): Promise<CrawlResult>;
}
