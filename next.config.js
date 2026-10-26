// The TB Analyser is its own static app (github.com/sagar305/TB-analyser),
// deployed separately and served here under /products/tb-analyzer/app/ so it
// lives on setutechnology.com. Override for local testing against
// `node backend/server.mjs` in that repo.
const TB_ANALYZER_ORIGIN = process.env.TB_ANALYZER_ORIGIN || "https://tb-analyser.vercel.app";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The TB Analyser loads its scripts and styles by relative path, so it must
  // be opened at /products/tb-analyzer/app/ — with the slash. Next's built-in
  // slash stripping is switched off and the first redirect below puts it back
  // for every other path, so the rest of the site keeps one URL per page.
  // middleware.ts adds the slash when the app is opened without one.
  skipTrailingSlashRedirect: true,
  // Belt and braces for the dev-only benchmark route. It is prerendered, so no
  // function should be emitted for it — but if one ever were, its trace would
  // otherwise follow @huggingface/transformers to onnxruntime-node's 211 MB of
  // native binaries, which exist for Node and are never used here: this tool
  // runs the model in the browser, in a worker.
  outputFileTracingExcludes: {
    "/dev/**": [
      "node_modules/onnxruntime-node/**",
      "node_modules/@huggingface/transformers/**",
      "node_modules/sharp/**",
      "node_modules/@img/**",
    ],
  },
  async redirects() {
    return [
      {
        source: "/:path((?!products/tb-analyzer/app/$).+)/",
        destination: "/:path",
        permanent: true,
      },
      // The blog feed lives at /blog/rss.xml; point the addresses people and
      // feed readers habitually guess at it rather than 404ing them.
      {
        source: "/rss.xml",
        destination: "/blog/rss.xml",
        permanent: true,
      },
      {
        source: "/feed.xml",
        destination: "/blog/rss.xml",
        permanent: true,
      },
      {
        source: "/blog/feed.xml",
        destination: "/blog/rss.xml",
        permanent: true,
      },
      {
        source: "/products/dine",
        destination: "/products/restaurant-pos",
        permanent: true,
      },
      {
        source: "/free-pos",
        destination: "/products/browser-based-pos",
        permanent: true,
      },
      {
        source: "/tools/bank-statement-analyzer",
        destination: "/products/bank-statement-analyzer",
        permanent: true,
      },
      {
        source: "/tools/bank-statement-analyzer/:path*",
        destination: "/products/bank-statement-analyzer/:path*",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/products/tb-analyzer/app/",
        destination: `${TB_ANALYZER_ORIGIN}/`,
      },
      {
        source: "/products/tb-analyzer/app/:path+",
        destination: `${TB_ANALYZER_ORIGIN}/:path+`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1",
          },
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
