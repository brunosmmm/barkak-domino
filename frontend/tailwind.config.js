/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Bar aesthetic palette
        bar: {
          dark: '#0a0a0a',      // Near black background
          darker: '#050505',    // Deepest shadow
          felt: '#1a3d2e',      // Dark green felt
          'felt-light': '#2d5a47', // Lighter felt accent
          'felt-dark': '#0f2a1f',  // Darker felt for shadows
          wood: '#2d1f14',      // Dark wood/leather
          'wood-light': '#4a3528', // Lighter wood
          'wood-dark': '#1a0f08',  // Darkest wood
          'wood-rim': '#3d2a1c',   // Wood rim highlight
        },
        neon: {
          amber: '#f59e0b',     // Primary neon amber
          'amber-glow': '#fbbf24', // Brighter amber
          gold: '#d97706',      // Deep gold
          red: '#ef4444',       // Neon red accent
          'red-glow': '#f87171', // Brighter red
        },
        whiskey: {
          light: '#c2956b',     // Light whiskey
          DEFAULT: '#92611a',   // Whiskey color
          dark: '#6b4513',      // Dark whiskey
        },
      },
      backgroundImage: {
        'bar-scene': "url('/images/bar-background.png')",
      },
      boxShadow: {
        'neon-amber': '0 0 10px #f59e0b, 0 0 20px #f59e0b40',
        'neon-gold': '0 0 10px #d97706, 0 0 20px #d9770640',
        'neon-red': '0 0 10px #ef4444, 0 0 20px #ef444440',
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
}
