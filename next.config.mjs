/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The unrelated standalone admin prototype file lives at repo root and is not
  // part of this app; exclude it from type-checking handled via tsconfig.
};

export default nextConfig;
