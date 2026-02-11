/** @type {import('tailwindcss').Config} */
import defaultTheme from 'tailwindcss/defaultTheme';
import daisyui from 'daisyui';

export default {
    content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Oswald', ...defaultTheme.fontFamily.sans],
                mono: ['Space Mono', ...defaultTheme.fontFamily.mono],
            },
        },
    },
    plugins: [daisyui],
    daisyui: {
        themes: ['lofi'],
        darkTheme: 'lofi', // Force lofi even in dark mode for broad consistency (Brutalist)
        logs: false,
    },
};
