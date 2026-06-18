/** @type {import('next').NextConfig} */
const nextConfig = {
  // imapflow, plaid, playwright, nodemailer are server-only — keep them external so
  // the bundler doesn't try to pull them into the client/edge bundle.
  serverExternalPackages: [
    "imapflow",
    "mailparser",
    "nodemailer",
    "playwright",
    "@anthropic-ai/sdk",
  ],
};

export default nextConfig;
