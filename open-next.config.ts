import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";

const config = defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
});

export default {
  ...config,
  imageOptimization: false,
};