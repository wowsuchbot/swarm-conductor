import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0d1117',
          1: '#161b22',
          2: '#21262d',
          3: '#30363d',
        },
        accent: {
          blue: '#58a6ff',
          green: '#3fb950',
          amber: '#d29922',
          red: '#f85149',
          purple: '#bc8cff',
        },
        border: '#30363d',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
export default config
