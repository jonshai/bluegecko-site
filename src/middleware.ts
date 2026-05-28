import type { MiddlewareHandler } from 'astro';

export const onRequest: MiddlewareHandler = async (context, next) => {
  const response = await next();
  const isOutreach = context.url.pathname.startsWith('/p/');

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
