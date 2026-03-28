import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" type="image/png" href="/favicon.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Global suppression of wallet extension injection errors
              (function() {
                const suppress = (e) => {
                  const error = e.error || (e.reason && e.reason.message) || e.reason || '';
                  const msg = typeof error === 'string' ? error : error.message || '';
                  
                  // Silence intrusive Next.js Dev Overlays for wallet extension conflicts
                  const isConflict = 
                    msg.includes('ethereum') || 
                    msg.includes('getter') || 
                    msg.includes('defineProperty') ||
                    msg.includes('descriptor') ||
                    msg.includes('Nightly') ||
                    msg.includes('Backpack') ||
                    msg.includes('chunk-inject') ||
                    msg.includes('chrome-extension://');

                  if (isConflict) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                  }
                };
                window.addEventListener('error', suppress, true);
                window.addEventListener('unhandledrejection', suppress, true);
              })();
            `,
          }}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
