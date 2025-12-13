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

interface OptionRowProps {
  options: OptionData[];
  activeOption: number | null;
  onOptionClick: (id: number) => void;
}

const OptionRow: React.FC<OptionRowProps> = ({ options, activeOption, onOptionClick }) => {
  const activeOptionData = options.find(opt => opt.id === activeOption);
  
  return (
    <div className="flex flex-col md:flex-row items-stretch overflow-hidden w-full gap-3">
      {/* Desktop view */}
      <div className="hidden md:flex flex-row items-stretch overflow-hidden w-full h-[320px] gap-3">
        {options.map((option) => {
          const Icon = option.icon;
          const isActive = activeOption === option.id;
          
          return (
            <div
              key={option.id}
              className={`
                relative overflow-hidden cursor-pointer transition-all duration-500 ease-[cubic-bezier(0.05,0.61,0.41,0.95)]
                bg-gradient-to-br ${option.bgColor} border border-white/10
                ${isActive 
                  ? 'flex-[10000] max-w-[700px] rounded-[40px]' 
                  : 'flex-[1] min-w-[50px] rounded-[30px]'
                }
              `}
              onClick={() => onOptionClick(option.id)}
            >
              {/* Shadow overlay */}
              <div 
                className={`
                  absolute left-0 right-0 h-[150px] transition-all duration-500 ease-[cubic-bezier(0.05,0.61,0.41,0.95)]
                  ${isActive 
                    ? 'bottom-0 shadow-[inset_0_-150px_150px_-150px_black,inset_0_-150px_150px_-120px_black]' 
                    : 'bottom-[-40px] shadow-[inset_0_-120px_0px_-120px_black,inset_0_-120px_0px_-100px_black]'
                  }
                `}
              />
              
              {/* Large centered icon when active */}
              <div 
                className={`
                  absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 
                  transition-all duration-500 ease-[cubic-bezier(0.05,0.61,0.41,0.95)]
                  ${isActive ? 'opacity-20 scale-100' : 'opacity-0 scale-50'}
                `}
                style={{ color: option.defaultColor }}
              >
                <Icon className="h-40 w-40" strokeWidth={1} />
              </div>
              
              {/* New badge */}
              {option.isNew && isActive && (
                <span className="absolute top-5 left-5 px-3 py-1.5 text-sm font-medium bg-[#36d399] text-[#0A1526] rounded-full z-10">
                  חדש
                </span>
              )}
              
              {/* Label - centered when active */}
              <div 
                className={`
                  flex absolute transition-all duration-500 ease-[cubic-bezier(0.05,0.61,0.41,0.95)]
                  ${isActive 
                    ? 'bottom-8 left-0 right-0 justify-center items-center flex-col gap-3' 
                    : 'bottom-3 left-3 right-0 h-10 flex-row'
                  }
                `}
              >
                {/* Icon */}
                <div 
                  className={`
                    flex justify-center items-center rounded-full transition-all duration-500
                    bg-white/10 backdrop-blur-md border border-white/20 shadow-lg
                    ${isActive ? 'w-16 h-16' : 'w-10 h-10'}
                  `}
                >
                  <Icon className={`${isActive ? 'h-8 w-8' : 'h-5 w-5'} text-white`} />
                </div>
                
                {/* Info */}
                <div 
                  className={`
                    flex flex-col text-white transition-all duration-500 ease-[cubic-bezier(0.05,0.61,0.41,0.95)]
                    ${isActive ? 'items-center text-center' : 'justify-center mr-2.5 whitespace-pre'}
                  `}
                >
                  <div 
                    className={`
                      relative font-bold transition-all duration-500 ease-[cubic-bezier(0.05,0.61,0.41,0.95)]
                      ${isActive ? 'text-2xl opacity-100' : 'text-lg right-5 opacity-0'}
                    `}
                  >
                    {option.main}
                  </div>
                  <div 
                    className={`
                      relative text-white/70 transition-all duration-500 ease-[cubic-bezier(0.05,0.61,0.41,0.95)] delay-100
                      ${isActive ? 'text-base opacity-100' : 'text-sm right-5 opacity-0'}
                    `}
                  >
                    {option.sub}
                  </div>
                </div>
              </div>
              
              {/* Decorative circles */}
              <div className="absolute -top-8 -right-8 w-32 h-32 border border-white/10 rounded-full" />
              <div className="absolute -top-4 -right-4 w-20 h-20 border border-white/5 rounded-full" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border border-white/5 rounded-full" />
              <div className="absolute -bottom-6 -left-6 w-24 h-24 border border-white/5 rounded-full" />
            </div>
          );
        })}
      </div>

      {/* Mobile view - Active card */}
      {activeOptionData && (
        <div className="md:hidden flex flex-col gap-4">
          <div
            className={`
              relative overflow-hidden w-full h-[220px] rounded-[30px]
              bg-gradient-to-br ${activeOptionData.bgColor} border border-white/10
              transition-all duration-300
            `}
          >
            {/* Shadow overlay */}
            <div className="absolute left-0 right-0 bottom-0 h-[120px] shadow-[inset_0_-120px_120px_-120px_black,inset_0_-120px_120px_-100px_black]" />
            
            {/* Large centered icon */}
            <div 
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] opacity-20"
              style={{ color: activeOptionData.defaultColor }}
            >
              <activeOptionData.icon className="h-32 w-32" strokeWidth={1} />
            </div>
            
            {/* New badge */}
            {activeOptionData.isNew && (
              <span className="absolute top-4 left-4 px-3 py-1 text-sm font-medium bg-[#36d399] text-[#0A1526] rounded-full z-10">
                חדש
              </span>
            )}
            
            {/* Label */}
            <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-2">
              <div 
                className="flex justify-center items-center rounded-full w-14 h-14 bg-white/10 backdrop-blur-md border border-white/20 shadow-lg"
              >
                <activeOptionData.icon className="h-7 w-7 text-white" />
              </div>
              <div className="text-white text-xl font-bold text-center">{activeOptionData.main}</div>
              <div className="text-white/70 text-sm text-center px-4">{activeOptionData.sub}</div>
            </div>
            
            {/* Decorative circles */}
            <div className="absolute -top-6 -right-6 w-24 h-24 border border-white/10 rounded-full" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-36 border border-white/5 rounded-full" />
          </div>

          {/* Mobile icons row */}
          <div className="flex flex-wrap justify-center gap-2">
            {options.map((option) => {
              const Icon = option.icon;
              const isActive = activeOption === option.id;
              
              return (
                <button
                  key={option.id}
                  onClick={() => onOptionClick(option.id)}
                  className={`
                    w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300
                    ${isActive 
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0A1526] scale-110' 
                      : 'opacity-70 hover:opacity-100'
                    }
                  `}
                  style={{ backgroundColor: option.defaultColor }}
                >
                  <Icon className="h-5 w-5 text-white" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const OptionsSelector: React.FC = () => {
  const [activeOption, setActiveOption] = useState<number>(0);

  const optionsDataRow1: OptionData[] = [
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
      sub: 'Green API, ManyChat, צאט מובנה',
      defaultColor: '#4ade80',
      bgColor: 'from-green-400/30 to-green-400/10'
    }
  ];

  const optionsDataRow2: OptionData[] = [
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
    <div className="flex flex-col justify-center items-center py-12 md:py-24 px-4 md:px-6 bg-[#0A1526] gap-4 md:gap-6">
      <div className="w-full max-w-6xl">
        <OptionRow 
          options={optionsDataRow1} 
          activeOption={activeOption} 
          onOptionClick={handleOptionClick} 
        />
      </div>
      <div className="w-full max-w-6xl">
        <OptionRow 
          options={optionsDataRow2} 
          activeOption={activeOption} 
          onOptionClick={handleOptionClick} 
        />
      </div>
    </div>
  );
};

export default OptionsSelector;
