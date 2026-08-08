// @ts-nocheck
import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en" style={{ height: "100%" }}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        {/* SEO */}
        <title>XYTEEE Nexus — Where quiet conversations become close bonds</title>
        <meta
          name="description"
          content="A serene, real-time space for the people who matter most. Private chat, stories, circles, voice and video calls on XYTEEE Nexus."
        />
        <meta
          name="keywords"
          content="XYTEEE, Nexus, messenger, chat app, private chat, video calls, stories, social"
        />
        <meta name="author" content="XYTEEE" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://xyteee.com/" />
        <meta name="theme-color" content="#070709" />
        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="XYTEEE Nexus" />
        <meta property="og:title" content="XYTEEE Nexus — Where quiet conversations become close bonds" />
        <meta
          property="og:description"
          content="A serene, real-time space for the people who matter most. Private chat, stories, circles, voice and video calls on XYTEEE Nexus."
        />
        <meta property="og:url" content="https://xyteee.com/" />
        <meta property="og:image" content="https://xyteee.com/og-image.png" />
        <meta property="og:locale" content="en_US" />
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="XYTEEE Nexus — Where quiet conversations become close bonds" />
        <meta
          name="twitter:description"
          content="A serene, real-time space for the people who matter most. Private chat, stories, circles, voice and video calls on XYTEEE Nexus."
        />
        <meta name="twitter:image" content="https://xyteee.com/og-image.png" />
        <meta name="twitter:site" content="@xyteee" />
        {/* Icons / mobile web app */}
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-title" content="Nexus" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="Nexus" />
        <meta name="msapplication-navbutton-color" content="#070709" />
        <meta name="msapplication-TileColor" content="#070709" />
        {/*
          Disable body scrolling on web to make ScrollView components work correctly.
          If you want to enable scrolling, remove `ScrollViewStyleReset` and
          set `overflow: auto` on the body style below.
        */}
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              body > div:first-child { position: fixed !important; top: 0; left: 0; right: 0; bottom: 0; }
              [role="tablist"] [role="tab"] * { overflow: visible !important; }
              [role="heading"], [role="heading"] * { overflow: visible !important; }
            `,
          }}
        />
      </head>
      <body
        style={{
          margin: 0,
          height: "100%",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </body>
    </html>
  );
}
