import React, { useState } from 'react';
import { 
  Target, 
  CheckCircle2, 
  Zap, 
  Users, 
  DollarSign, 
  MessageSquare,
  Sparkles,
  RefreshCw,
  Calendar,
  CalendarClock,
  PieChart,
  LucideIcon
} from "lucide-react";

interface OptionData {
  id: number;
  icon: LucideIcon;
  main: string;
  sub: string;
  defaultColor: string;
  bgColor: string;
  isNew?: boolean;
}

const OptionsSelector: React.FC = () => {
  const [activeOption, setActiveOption] = useState<number>(0);

  const optionsData: OptionData[] = [
    {
      id: 0,
      icon: Target,
      main: 'ניהול לידים',
      sub: 'פייפליין מכירות, סטטוסים דינמיים',
      defaultColor: '#36d399',
      bgColor: 'from-[#36d399]/30 to-[#36d399]/10'
    },
    {
      id: 1,
      icon: CheckCircle2,
      main: 'ניהול משימות',
      sub: 'קנבן, טבלה, לוח שנה',
      defaultColor: '#22c55e',
      bgColor: 'from-green-500/30 to-green-500/10'
    },
    {
      id: 2,
      icon: Zap,
      main: 'אוטומציות',
      sub: 'טריגרים אוטומטיים, פולואפים',
      defaultColor: '#eab308',
      bgColor: 'from-yellow-500/30 to-yellow-500/10'
    },
    {
      id: 3,
      icon: Users,
      main: 'ניהול לקוחות',
      sub: 'כרטיס לקוח מפורט, היסטוריה',
      defaultColor: '#3b82f6',
      bgColor: 'from-blue-500/30 to-blue-500/10'
    },
    {
      id: 4,
      icon: DollarSign,
      main: 'ניהול כספים',
      sub: 'מעקב תשלומים, דוחות',
      defaultColor: '#10b981',
      bgColor: 'from-emerald-500/30 to-emerald-500/10'
    },
    {
      id: 5,
      icon: MessageSquare,
      main: 'אינטגרציית WhatsApp',
      sub: 'Green API, ManyChat, צ\'אט מובנה',
      defaultColor: '#4ade80',
      bgColor: 'from-green-400/30 to-green-400/10'
    },
    {
      id: 6,
      icon: CalendarClock,
      main: 'זימון פגישות',
      sub: 'Google Calendar, שליחת זימונים',
      defaultColor: '#0ea5e9',
      bgColor: 'from-sky-500/30 to-sky-500/10',
      isNew: true
    },
    {
      id: 7,
      icon: PieChart,
      main: 'דוחות אוטומטיים',
      sub: 'דוחות ביצועים בזמן אמת',
      defaultColor: '#ec4899',
      bgColor: 'from-pink-500/30 to-pink-500/10',
      isNew: true
    },
    {
      id: 8,
      icon: Sparkles,
      main: 'בינה מלאכותית',
      sub: 'עוזר AI חכם לתמיכה וניהול',
      defaultColor: '#a855f7',
      bgColor: 'from-purple-500/30 to-purple-500/10',
      isNew: true
    },
    {
      id: 9,
      icon: RefreshCw,
      main: 'פולואפים אוטומטיים',
      sub: 'מעקב אוטומטי, תזכורות',
      defaultColor: '#f97316',
      bgColor: 'from-orange-500/30 to-orange-500/10'
    },
    {
      id: 10,
      icon: Calendar,
      main: 'אינטגרציית יומן',
      sub: 'Google Calendar, קביעת פגישות',
      defaultColor: '#ef4444',
      bgColor: 'from-red-500/30 to-red-500/10'
    }
  ];

  const handleOptionClick = (optionId: number) => {
    setActiveOption(optionId);
  };

  return (
    <div className="flex flex-row justify-center items-center py-24 bg-[#0A1526]">
      <div className="flex flex-row items-stretch overflow-hidden min-w-[600px] max-w-[1100px] w-[calc(100%-100px)] h-[400px]">
        {optionsData.map((option) => {
          const Icon = option.icon;
          const isActive = activeOption === option.id;
          
          return (
            <div
              key={option.id}
              className={`
                relative overflow-hidden cursor-pointer transition-all duration-500 ease-[cubic-bezier(0.05,0.61,0.41,0.95)]
                bg-gradient-to-br ${option.bgColor} border border-white/10
                ${isActive 
                  ? 'flex-[10000] max-w-[600px] mx-0 rounded-[40px]' 
                  : 'flex-[1] min-w-[60px] mx-2.5 rounded-[30px]'
                }
              `}
              onClick={() => handleOptionClick(option.id)}
            >
              {/* Shadow overlay */}
              <div 
                className={`
                  absolute left-0 right-0 h-[120px] transition-all duration-500 ease-[cubic-bezier(0.05,0.61,0.41,0.95)]
                  ${isActive 
                    ? 'bottom-0 shadow-[inset_0_-120px_120px_-120px_black,inset_0_-120px_120px_-100px_black]' 
                    : 'bottom-[-40px] shadow-[inset_0_-120px_0px_-120px_black,inset_0_-120px_0px_-100px_black]'
                  }
                `}
              />
              
              {/* New badge */}
              {option.isNew && isActive && (
                <span className="absolute top-5 left-5 px-3 py-1.5 text-sm font-medium bg-[#36d399] text-[#0A1526] rounded-full z-10">
                  חדש
                </span>
              )}
              
              {/* Label */}
              <div 
                className={`
                  flex absolute right-0 h-10 transition-all duration-500 ease-[cubic-bezier(0.05,0.61,0.41,0.95)]
                  ${isActive ? 'bottom-5 left-5' : 'bottom-2.5 left-2.5'}
                `}
              >
                {/* Icon */}
                <div 
                  className="flex justify-center items-center min-w-[40px] max-w-[40px] h-10 rounded-full bg-white"
                  style={{ color: option.defaultColor }}
                >
                  <Icon className="h-5 w-5" />
                </div>
                
                {/* Info */}
                <div className="flex flex-col justify-center mr-2.5 text-white whitespace-pre">
                  <div 
                    className={`
                      relative font-bold text-lg transition-all duration-500 ease-[cubic-bezier(0.05,0.61,0.41,0.95)]
                      ${isActive ? 'right-0 opacity-100' : 'right-5 opacity-0'}
                    `}
                  >
                    {option.main}
                  </div>
                  <div 
                    className={`
                      relative text-sm text-white/70 transition-all duration-500 ease-[cubic-bezier(0.05,0.61,0.41,0.95)] delay-100
                      ${isActive ? 'right-0 opacity-100' : 'right-5 opacity-0'}
                    `}
                  >
                    {option.sub}
                  </div>
                </div>
              </div>
              
              {/* Decorative circles */}
              <div className="absolute -top-6 -right-6 w-24 h-24 border border-white/10 rounded-full" />
              <div className="absolute -top-3 -right-3 w-16 h-16 border border-white/5 rounded-full" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border border-white/5 rounded-full" />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OptionsSelector;
