/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'obscura-bg': "#000033",
        'obscura-deep': "#0A0A2A",
        'accent': "#FFD700",
        'highlight': "#4B0082",
        'alert': "#FF4500",
        'neon': "#00FFFF",
        'purple': "#FF00FF",
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
