/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // Legacy domain → canonical. Matches on the incoming Host header so it
      // only fires for the old .dev URL, not files.thegrovery.com itself.
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'file-upload-tool.thegrovery.dev' }],
        destination: 'https://files.thegrovery.com/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
