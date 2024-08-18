import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                content: resolve(__dirname, "src/content.ts"),
                popup: resolve(__dirname, 'src/popup.ts')
            },
            output: {
                entryFileNames: "[name].js",
                chunkFileNames: "[name]-[hash].js",
                inlineDynamicImports: false,
                format: "es",
            },
        },
    },
    define: {
        "process.env": {},
    },
    envPrefix: "VITE_", // 環境変数にVITE_プレフィックスを使用する
});
