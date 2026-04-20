import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    BASIC_AUTH_USER: process.env.BASIC_AUTH_USER ?? '',
    BASIC_AUTH_PASS: process.env.BASIC_AUTH_PASS ?? '',
  },
};

export default nextConfig;
