/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // ── Budgetin primary: sage green ──────────────────────────
        primary: {
          DEFAULT: '#6B8E6B',
          50:  '#F1F5EE',
          100: '#DEE8D7',
          200: '#C2D4B9',
          300: '#A2BD97',
          400: '#82A276',
          500: '#6B8E6B',
          600: '#547254',
          700: '#41594F',
          800: '#2F4338',
          900: '#1F2D26',
        },
        // ── Budgetin accent: clay/terracotta ─────────────────────
        accent: {
          DEFAULT: '#C97B5C',
          50:  '#FBF1EC',
          100: '#F4DDD0',
          200: '#EAC0AB',
          300: '#DFA386',
          400: '#D38966',
          500: '#C97B5C',
          600: '#A8624A',
          700: '#834C39',
        },
        // ── Budgetin canvas: warm cream ───────────────────────────
        canvas: {
          DEFAULT: '#FAF7F2',
          50:  '#FDFBF7',
          100: '#FAF7F2',
          200: '#F4EEE3',
          300: '#ECE4D3',
          400: '#DDD2BD',
          500: '#C7B89E',
        },
        // ── Budgetin mustard ──────────────────────────────────────
        mustard: {
          DEFAULT: '#D9A441',
          400: '#E3B25A',
          500: '#D9A441',
          600: '#B98C30',
        },
        // ── Budgetin ink (neutrals) ──────────────────────────────
        ink: {
          50:  '#F5F1E8',
          100: '#ECE7DD',
          200: '#E0DBD2',
          300: '#C7C2B9',
          400: '#A8A39B',
          500: '#8E887F',
          600: '#6F6A63',
          700: '#55504A',
          800: '#3F3B36',
          900: '#2D2A26',
        },
        // ── Semantic ──────────────────────────────────────────
        income:   '#6B8E6B',   // sage (not green)
        expense:  '#C97B5C',   // clay (not red)
        danger:   '#C66B6B',   // rose — only for destructive actions
        saving:   '#D9A441',   // mustard
        info:     '#6E97AE',   // sky
        // ── Surface / bg ──────────────────────────────────────
        surface:  '#FFFFFF',
        bg:       '#FAF7F2',
        bgSunken: '#F4EEE3',
        border:   '#E0DBD2',
        divider:  '#ECE4D3',
      },
      fontFamily: {
        sans:    ['Nunito_500Medium', 'System'],
        medium:  ['Nunito_600SemiBold', 'System'],
        semibold:['Nunito_700Bold', 'System'],
        bold:    ['Nunito_800ExtraBold', 'System'],
        black:   ['Nunito_900Black', 'System'],
        mono:    ['JetBrainsMono', 'Menlo', 'monospace'],
      },
      borderRadius: {
        'xs':  '6px',
        'sm':  '10px',
        'md':  '14px',
        'lg':  '18px',
        'xl':  '24px',
        '2xl': '32px',
        'pill':'9999px',
      },
      fontSize: {
        'display': ['40px', { lineHeight: '1.15' }],
        'h1':      ['32px', { lineHeight: '1.15' }],
        'h2':      ['26px', { lineHeight: '1.3'  }],
        'h3':      ['22px', { lineHeight: '1.3'  }],
        'h4':      ['18px', { lineHeight: '1.4'  }],
        'body':    ['16px', { lineHeight: '1.5'  }],
        'bodySm':  ['14px', { lineHeight: '1.5'  }],
        'caption': ['12px', { lineHeight: '1.5'  }],
        'micro':   ['11px', { lineHeight: '1.4'  }],
      },
      boxShadow: {
        'Budgetin-sm': '0 2px 6px rgba(45,42,38,0.05)',
        'Budgetin-md': '0 6px 16px rgba(45,42,38,0.07)',
        'Budgetin-lg': '0 14px 32px rgba(45,42,38,0.09)',
      },
    },
  },
  plugins: [],
}
