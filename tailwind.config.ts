/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./packages/vite/index.html",
      "./packages/vite/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class', // This is crucial for the class-based dark mode
    theme: {
      extend: {},
    },
    plugins: [],
  }