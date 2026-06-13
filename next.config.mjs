/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ensure the seeded example transcripts (read via fs at request time, Feature 2)
  // are traced into the /api/calls serverless function on Vercel.
  outputFileTracingIncludes: {
    "/api/calls": ["./src/data/examples/**/*"],
  },
};

export default nextConfig;
