export default {
  default: {
    override: {
      wrapper: "cloudflare-node",
    },
  },
  imageOptimization: {
    bundle: false,
    override: {
      wrapper: "cloudflare-node",
    }
  },
  middleware: {
    external: true,
    override: {
      wrapper: "cloudflare-node"
    }
  }
};
