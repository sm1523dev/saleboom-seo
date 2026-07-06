# Uptime Monitoring Setup

The `/api/health` endpoint returns `200 OK` when all services are healthy and `503` when degraded. Configure an external ping service to monitor it.

## Endpoint

```
GET https://saleboomseo.dpdns.org/api/health
```

Expected response (healthy):
```json
{
  "status": "ok",
  "version": "0.1.0",
  "timestamp": "2026-07-05T10:00:00.000Z",
  "services": { "database": "ok", "queue": "ok" }
}
```

## Option A — UptimeRobot (free)

1. Sign up at [uptimerobot.com](https://uptimerobot.com)
2. **New Monitor** → Type: **HTTP(s)**
3. Friendly name: `SaleBoom SEO — Pi Dev`
4. URL: `https://saleboomseo.dpdns.org/api/health`
5. Monitoring interval: **5 minutes** (free tier minimum)
6. Alert contacts: add your email

> Free tier monitors every 5 minutes. Upgrade for 60-second intervals.

## Option B — Better Uptime (free tier)

1. Sign up at [betteruptime.com](https://betteruptime.com)
2. **New monitor** → URL: `https://saleboomseo.dpdns.org/api/health`
3. Check frequency: **3 minutes** (free tier)
4. On-call policy: email alert

## Option C — Grafana Cloud (free, 1 probe)

1. Sign up at [grafana.com/products/cloud](https://grafana.com/products/cloud)
2. Add a **Synthetic Monitoring** probe
3. Target: `https://saleboomseo.dpdns.org/api/health`
4. Frequency: **1 minute**
5. Alert via Grafana alerting → email or webhook

## Alert channel

Once you have a webhook URL from your chosen service, set it in your secrets:

```yaml
# k8s/dev/secrets.yaml
SLACK_ALERT_WEBHOOK: "https://hooks.slack.com/..."   # if using Slack
ALERT_EMAIL_TO: "admin@yourdomain.com"               # if using email
```

The internal alerting system (`lib/metrics/alerts.ts`) uses the same channels for scan failure and queue depth alerts.

## UPTIME_MONITOR_URL

Set this to the dashboard URL of your monitor for team reference (not used by the app):

```yaml
UPTIME_MONITOR_URL: "https://stats.uptimerobot.com/your-page-id"
```
