import type { MiddlewareHandler } from 'astro';
import { logOmScan } from './lib/log-om-scan';
import { sendOmWebhook } from './lib/send-om-webhook';

export const onRequest: MiddlewareHandler = async (context, next) => {
  const { pathname } = context.url;
  const isOutreach = pathname.startsWith('/p/');

  // OM scan capture: /list-my-house?ref=<12-char-hex>
  // True edge-side capture — no client JS, no modification to the page.
  if (pathname === '/list-my-house') {
    const ref = context.url.searchParams.get('ref');
    if (ref) {
      const timestamp = new Date().toISOString();
      const userAgent = context.request.headers.get('user-agent') ?? '';

      // Kick off side-effects and render concurrently (all three start now)
      const scanPromise = logOmScan(ref, userAgent, timestamp);
      const webhookPromise = sendOmWebhook(ref, timestamp, userAgent);
      const responsePromise = next();

      // Settle all before returning — CF Pages has no waitUntil, so un-awaited
      // work after response return is not guaranteed to execute.
      const results = await Promise.allSettled([scanPromise, webhookPromise, responsePromise]);
      const renderResult = results[2];
      if (renderResult.status === 'rejected') throw renderResult.reason;
      return renderResult.value;
    }
  }

  const response = await next();

  if (isOutreach) {
    // Set noindex header and return without stella injection
    const newHeaders = new Headers(response.headers);
    newHeaders.set('X-Robots-Tag', 'noindex');
    return new Response(response.body, {
      status: response.status,
      headers: newHeaders,
    });
  }

  if (response.headers.get('content-type')?.includes('text/html')) {
    const html = await response.text();
    const injected = html.replace(
      '</body>',
      '<script src="/stella-loader.js" defer></script></body>'
    );
    return new Response(injected, {
      status: response.status,
      headers: response.headers,
    });
  }

  return response;
};
