/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        abyss: "#050816",
        pulse: "#45d5ff",
        neon: "#7ef9ff",
        vault: "#10203c",
        ember: "#ff5f9e",
      },
      boxShadow: {
        glow: "0 0 30px rgba(69, 213, 255, 0.22)",
        card: "0 25px 80px rgba(5, 8, 22, 0.48)",
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(126, 249, 255, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(126, 249, 255, 0.08) 1px, transparent 1px)",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Plus Jakarta Sans'", "sans-serif"],
      },
      animation: {
        "pulse-slow": "pulse 4s ease-in-out infinite",
        "float-slow": "float 6s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
    },
  },
  plugins: [],
};

