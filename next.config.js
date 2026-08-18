/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
