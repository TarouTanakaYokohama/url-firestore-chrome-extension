import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                background: resolve(__dirname, "src/background.ts"),
                content: resolve(__dirname, "src/content.ts"),
            },
            output: {
                entryFileNames: "[name].js",
                chunkFileNames: "[name]-[hash].js",
                inlineDynamicImports: false,
                format: "es", // iifeからesに変更
            },
        },
    },
    define: {
        "process.env": {},
    },
    envPrefix: "VITE_", // 環境変数にVITE_プレフィックスを使用する
});
