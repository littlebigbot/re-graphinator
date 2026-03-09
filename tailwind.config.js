/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,js,css,vue}", // Include Vue files
    "./src/styles/base.css" // Add the renamed file
  ],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)', // Use CSS variables
        secondary: 'var(--color-secondary)' // Use CSS variables
      },
      spacing: {
        '72': '18rem', // Custom spacing
        '84': '21rem'
      }
    }
  },
  plugins: [],
};
