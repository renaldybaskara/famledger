import { ScrollViewStyleReset } from 'expo-router/html'
import type { PropsWithChildren } from 'react'

/**
 * Expo Router HTML shell — controls the <head> of the web export.
 * Critical for mobile web responsiveness:
 *   - viewport meta prevents browser zoom-out on small screens
 *   - theme-color matches the app's hero gradient
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="id">
      <head>
        <meta charSet="utf-8" />
        {/* ── Responsive viewport — MUST be present for mobile web ── */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        {/* Theme color matches hero gradient */}
        <meta name="theme-color" content="#41594F" />
        {/* iOS status bar */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Budgetin" />

        <title>Budgetin — Pencatatan Keuangan Keluarga</title>
        <meta name="description" content="Catat keuangan keluarga otomatis dari email bank. Self-hosted, privat, gratis." />

        {/*
         * Disable body scrolling for the root element so that
         * individual scrollable areas work correctly inside modals.
         */}
        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{
          __html: `
            * { box-sizing: border-box; }
            html, body { height: 100%; }
            body {
              overscroll-behavior: none;
              -webkit-tap-highlight-color: transparent;
            }
            /* Prevent white flash on load */
            #root { background-color: #FAF7F2; }
          `
        }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
