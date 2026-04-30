import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(__dirname),
  // Turbopack hangs compiling routes that import large JSON files
  // (item-details.json is 1.15 MB, classic-group-named.json + 2 expansions ~175 KB).
  // Use webpack until Next 16.x turbopack handles this case.
};

export default nextConfig;
