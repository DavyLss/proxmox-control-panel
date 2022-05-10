import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import viteTsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    viteTsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({
      server: { entry: "server" },
    }),
    viteReact(),
  ],
  define: {
    "process.env.TSS_SERVER_FN_BASE": JSON.stringify("/_serverFn/"),
    "process.env.TSS_ROUTER_BASEPATH": JSON.stringify("/"),
    "process.env.TSS_DEV_SERVER": JSON.stringify("true"),
    "process.env.TSS_DEV_SSR_STYLES_ENABLED": JSON.stringify("true"),
    "process.env.TSS_DEV_SSR_STYLES_BASEPATH": JSON.stringify("/"),
  },
  server: {
    allowedHosts: ["proxmox-control-panel.lassechere.fr"],
  },
});
