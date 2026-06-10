export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
  extend: {
    fontFamily: {
      poppins: ["Poppins", "sans-serif"],
    },
    animation: {
      "en-fade-in": "en-fade-in 0.35s ease-out both",
      "en-fade-in-up": "en-fade-in-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both",
      "en-scale-in": "en-scale-in 0.38s cubic-bezier(0.22, 1, 0.36, 1) both",
    },
    keyframes: {
      "en-fade-in": {
        from: { opacity: "0" },
        to: { opacity: "1" },
      },
      "en-fade-in-up": {
        from: { opacity: "0", transform: "translateY(14px)" },
        to: { opacity: "1", transform: "translateY(0)" },
      },
      "en-scale-in": {
        from: { opacity: "0", transform: "scale(0.94)" },
        to: { opacity: "1", transform: "scale(1)" },
      },
    },
  },
},
  plugins: [],
};