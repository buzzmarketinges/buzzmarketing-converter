import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "var(--background)",
                foreground: "var(--foreground)",
                primary: "var(--primary)",
                accent: "var(--accent)",
                surface: "var(--surface)",
                border: "var(--border)",
            },
            borderRadius: {
                DEFAULT: "var(--radius)",
            },
            fontFamily: {
                sans: "var(--font-sans)",
            },
        },
    },
    plugins: [],
};
export default config;
