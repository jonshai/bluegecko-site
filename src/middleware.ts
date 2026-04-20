import type { MiddlewareHandler } from 'astro';

export const onRequest: MiddlewareHandler = async (context, next) => {
  const response = await next();

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
