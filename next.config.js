/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: "/products/dine",
        destination: "/products/restaurant-pos",
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
