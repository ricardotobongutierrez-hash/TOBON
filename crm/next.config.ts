import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // PGlite y pg cargan binarios/WASM: Next no debe intentar empaquetarlos.
  serverExternalPackages: ["@electric-sql/pglite", "pg", "exceljs", "bcryptjs"],
  // El indicador flotante de desarrollo tapa la navegacion inferior en movil.
  devIndicators: false,
  experimental: {
    serverActions: { bodySizeLimit: "15mb" },
  },
};

export default nextConfig;
