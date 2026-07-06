import { NodeSDK } from "@opentelemetry/sdk-node";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { SimpleSpanProcessor, ConsoleSpanExporter } from "@opentelemetry/sdk-trace-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

export function initTelemetry(serviceName: string): void {
  const exporter = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
    ? new OTLPTraceExporter({ url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT })
    : new ConsoleSpanExporter();

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? serviceName,
    }),
    spanProcessor: new SimpleSpanProcessor(exporter),
  });

  sdk.start();

  process.on("SIGTERM", () => sdk.shutdown().finally(() => process.exit(0)));
  process.on("SIGINT", () => sdk.shutdown().finally(() => process.exit(0)));
}
