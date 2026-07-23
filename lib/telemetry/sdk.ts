import { NodeSDK } from "@opentelemetry/sdk-node";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { SimpleSpanProcessor, NoopSpanProcessor } from "@opentelemetry/sdk-trace-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

export function initTelemetry(serviceName: string): void {
  const spanProcessor = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
    ? new SimpleSpanProcessor(new OTLPTraceExporter({ url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT }))
    : new NoopSpanProcessor();

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? serviceName,
    }),
    spanProcessor,
  });

  sdk.start();

  process.on("SIGTERM", () => sdk.shutdown().finally(() => process.exit(0)));
  process.on("SIGINT", () => sdk.shutdown().finally(() => process.exit(0)));
}
