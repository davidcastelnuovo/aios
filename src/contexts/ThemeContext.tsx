import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ColorPalette = 'default' | 'green-gradient' | 'blue' | 'purple' | 'orange';

interface ThemeContextType {
  palette: ColorPalette;
  setPalette: (palette: ColorPalette) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const palettes = {
  default: {
    primary: '222.2 47.4% 11.2%',
    'primary-foreground': '210 40% 98%',
    'primary-glow': '222.2 47.4% 20%',
  },
  'green-gradient': {
    primary: '158 64% 52%', // #36d399 - green
    'primary-foreground': '0 0% 100%',
    'primary-glow': '158 64% 62%',
    'gradient-primary': 'linear-gradient(135deg, hsl(158, 64%, 52%) 0%, hsl(174, 60%, 51%) 100%)',
    'gradient-subtle': 'linear-gradient(180deg, hsl(158, 64%, 97%) 0%, hsl(0, 0%, 100%) 100%)',
  },
  blue: {
    primary: '221 83% 53%', // #3b82f6 - blue
    'primary-foreground': '0 0% 100%',
    'primary-glow': '221 83% 63%',
    'gradient-primary': 'linear-gradient(135deg, hsl(221, 83%, 53%) 0%, hsl(243, 75%, 59%) 100%)',
    'gradient-subtle': 'linear-gradient(180deg, hsl(221, 83%, 97%) 0%, hsl(0, 0%, 100%) 100%)',
  },
  purple: {
    primary: '271 81% 56%', // #a855f7 - purple
    'primary-foreground': '0 0% 100%',
    'primary-glow': '271 81% 66%',
    'gradient-primary': 'linear-gradient(135deg, hsl(271, 81%, 56%) 0%, hsl(292, 84%, 61%) 100%)',
    'gradient-subtle': 'linear-gradient(180deg, hsl(271, 81%, 97%) 0%, hsl(0, 0%, 100%) 100%)',
  },
  orange: {
    primary: '25 95% 53%', // #fb923c - orange
    'primary-foreground': '0 0% 100%',
    'primary-glow': '25 95% 63%',
    'gradient-primary': 'linear-gradient(135deg, hsl(25, 95%, 53%) 0%, hsl(38, 92%, 50%) 100%)',
    'gradient-subtle': 'linear-gradient(180deg, hsl(25, 95%, 97%) 0%, hsl(0, 0%, 100%) 100%)',
  },
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [palette, setPaletteState] = useState<ColorPalette>(() => {
    const saved = localStorage.getItem('color-palette');
    return (saved as ColorPalette) || 'default';
  });

  const setPalette = (newPalette: ColorPalette) => {
    setPaletteState(newPalette);
    localStorage.setItem('color-palette', newPalette);
    applyPalette(newPalette);
  };

  const applyPalette = (paletteKey: ColorPalette) => {
    const colors = palettes[paletteKey];
    const root = document.documentElement;

    Object.entries(colors).forEach(([key, value]) => {
      if (key.startsWith('gradient')) {
        // For gradients, we set them as CSS custom properties
        root.style.setProperty(`--${key}`, value);
      } else {
        root.style.setProperty(`--${key}`, value);
      }
    });
  };

  useEffect(() => {
    applyPalette(palette);
  }, [palette]);

  return (
    <ThemeContext.Provider value={{ palette, setPalette }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
