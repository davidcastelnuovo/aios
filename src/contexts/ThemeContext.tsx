import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './TenantContext';
import { useQuery } from '@tanstack/react-query';

export type ColorPalette = 'default' | 'green-gradient' | 'blue' | 'purple' | 'orange';

interface ThemeContextType {
  palette: ColorPalette;
  setPalette: (palette: ColorPalette) => Promise<void>;
  logoUrl: string | null;
  setLogoUrl: (url: string | null) => Promise<void>;
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
  const { currentTenantId } = useTenant();
  const [palette, setPaletteState] = useState<ColorPalette>('default');
  const [logoUrl, setLogoUrlState] = useState<string | null>(null);

  // Load tenant branding settings
  const { data: brandingSettings } = useQuery({
    queryKey: ['tenant-branding', currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return null;
      
      const { data, error } = await supabase
        .from('tenant_settings')
        .select('setting_value')
        .eq('tenant_id', currentTenantId)
        .eq('setting_key', 'branding')
        .maybeSingle();
      
      if (error) throw error;
      return data?.setting_value;
    },
    enabled: !!currentTenantId,
  });

  // Apply branding when loaded
  useEffect(() => {
    if (brandingSettings) {
      const settings = brandingSettings as { colorPalette?: ColorPalette; logoUrl?: string };
      const colorPalette = settings.colorPalette || 'default';
      const logo = settings.logoUrl || null;
      
      setPaletteState(colorPalette);
      setLogoUrlState(logo);
      applyPalette(colorPalette);
    }
  }, [brandingSettings]);

  const setPalette = async (newPalette: ColorPalette) => {
    if (!currentTenantId) return;
    
    setPaletteState(newPalette);
    applyPalette(newPalette);
    
    // Save to tenant_settings
    const currentSettings = (brandingSettings as { colorPalette?: ColorPalette; logoUrl?: string }) || {};
    await supabase
      .from('tenant_settings')
      .upsert({
        tenant_id: currentTenantId,
        setting_key: 'branding',
        setting_value: {
          ...currentSettings,
          colorPalette: newPalette,
        },
      }, {
        onConflict: 'tenant_id,setting_key',
      });
  };

  const setLogoUrl = async (url: string | null) => {
    if (!currentTenantId) return;
    
    setLogoUrlState(url);
    
    // Save to tenant_settings
    const currentSettings = (brandingSettings as { colorPalette?: ColorPalette; logoUrl?: string }) || {};
    await supabase
      .from('tenant_settings')
      .upsert({
        tenant_id: currentTenantId,
        setting_key: 'branding',
        setting_value: {
          ...currentSettings,
          logoUrl: url,
        },
      }, {
        onConflict: 'tenant_id,setting_key',
      });
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
    <ThemeContext.Provider value={{ palette, setPalette, logoUrl, setLogoUrl }}>
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
