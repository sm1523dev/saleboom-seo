import "./telemetry"; // must be first — patches Node internals before other modules load
import "./functions/scan-worker";
import "./functions/aeo-worker";
import "./functions/ai-suggest-worker";
import "./functions/digest-worker";
import "./functions/rescan-timer";
import "./functions/aeo-timer";
import "./functions/digest-timer";
