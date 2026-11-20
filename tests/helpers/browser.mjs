import { chromium, webkit } from 'playwright-core';

export const browserEngine = process.env.PW_BROWSER || 'chromium';
if (browserEngine !== 'chromium' && browserEngine !== 'webkit') {
  throw new Error(`Unsupported PW_BROWSER "${browserEngine}". Use chromium or webkit.`);
}

export const isWebKit = browserEngine === 'webkit';
export const webKitMobileOptions = isWebKit ? { isMobile: true, hasTouch: true } : {};

const browserType = isWebKit ? webkit : chromium;
const browserChannel = process.env.PW_CHANNEL || 'msedge';

function launchOptions({ args = ['--no-sandbox'], channel = browserChannel, ...options }) {
  if (isWebKit) return { headless: true, ...options };
  return { channel, headless: true, args, ...options };
}

export function launchBrowser(options = {}) {
  return browserType.launch(launchOptions(options));
}

export function launchPersistentContext(profile, options = {}) {
  return browserType.launchPersistentContext(profile, launchOptions(options));
}
