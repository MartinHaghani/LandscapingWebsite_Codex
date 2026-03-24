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
        canvas: {
          DEFAULT: '#F7F4EE',
          soft: '#FCFAF5',
          muted: '#EFEADD'
        },
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F5F2EA',
          raised: '#FFFDF9'
        },
        ink: '#101713',
        copy: {
          DEFAULT: '#233227',
          muted: '#4D5F53',
          soft: '#6C7B71'
        },
        stroke: '#D6D7CF'
      },
      fontFamily: {
        sans: ['Sora', 'ui-sans-serif', 'sans-serif'],
        display: ['Space Grotesk', 'ui-sans-serif', 'sans-serif'],
        script: ['Great Vibes', 'cursive']
      },
      boxShadow: {
        soft: '0 20px 50px -28px rgba(16, 23, 19, 0.35)',
        lift: '0 24px 50px -32px rgba(16, 23, 19, 0.42)'
      },
      backgroundImage: {
        mesh: 'radial-gradient(circle at 22% 18%, rgba(50, 159, 91, 0.17), transparent 40%), radial-gradient(circle at 82% -6%, rgba(16, 23, 19, 0.07), transparent 34%), linear-gradient(130deg, rgba(255, 255, 255, 0.66), rgba(255, 255, 255, 0))'
      }
    }
  },
  plugins: []
} satisfies Config;
