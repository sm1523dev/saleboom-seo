(function () {
  var AI_DOMAINS = [
    "perplexity.ai", "chatgpt.com", "claude.ai", "gemini.google.com",
    "copilot.microsoft.com", "you.com", "phind.com", "bing.com", "kagi.com",
    "grok.x.ai", "meta.ai",
  ];
  var ref = document.referrer;
  if (!ref) return;
  var host;
  try { host = new URL(ref).hostname.replace(/^www\./, ""); } catch (e) { return; }
  if (!AI_DOMAINS.some(function (d) { return host === d || host.slice(-d.length - 1) === "." + d; })) return;
  var sid = sessionStorage.getItem("__sb_sid");
  if (!sid) {
    try { sid = crypto.randomUUID(); } catch (e) { sid = Math.random().toString(36).slice(2) + Date.now().toString(36); }
    sessionStorage.setItem("__sb_sid", sid);
  }
  var wid = window.__SB_WEBSITE_ID;
  if (!wid) return;
  var payload = JSON.stringify({ websiteId: wid, referrerPlatform: host, landingPath: location.pathname, sessionId: sid });
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/aeo/referral", new Blob([payload], { type: "application/json" }));
  } else {
    var xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/aeo/referral", true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send(payload);
  }
})();
