import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#329F5B',
          muted: '#2B8A4E',
          soft: '#E6F4EC'
        },
        ink: '#060807'
      },
      fontFamily: {
        sans: ['Sora', 'ui-sans-serif', 'sans-serif'],
        display: ['Space Grotesk', 'ui-sans-serif', 'sans-serif']
      },
      boxShadow: {
        soft: '0 20px 50px -20px rgba(0, 0, 0, 0.45)'
      },
      backgroundImage: {
        mesh: 'radial-gradient(circle at 20% 20%, rgba(50, 159, 91, 0.24), transparent 42%), radial-gradient(circle at 80% 0%, rgba(255, 255, 255, 0.09), transparent 34%)'
      }
    }
  },
  plugins: []
} satisfies Config;
