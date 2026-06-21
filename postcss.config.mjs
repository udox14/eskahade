const config = {
  plugins: {
    // Mantine PostCSS preset — wajib agar mixin/light-dark Mantine bekerja
    "postcss-preset-mantine": {},
    "postcss-simple-vars": {
      // Diselaraskan ke skala Tailwind (lihat lib/theme.ts breakpoints)
      variables: {
        "mantine-breakpoint-xs": "40em",
        "mantine-breakpoint-sm": "48em",
        "mantine-breakpoint-md": "64em",
        "mantine-breakpoint-lg": "80em",
        "mantine-breakpoint-xl": "96em",
      },
    },
    // Tailwind v4 tetap aktif selama migrasi bertahap (coexist dengan Mantine)
    "@tailwindcss/postcss": {},
  },
};

export default config;
