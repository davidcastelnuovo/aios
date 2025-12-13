import React, { useState } from 'react';

interface OptionData {
  id: number;
  background: string;
  icon: string;
  main: string;
  sub: string;
  defaultColor: string;
}

const OptionsSelector: React.FC = () => {
  const [activeOption, setActiveOption] = useState<number>(0);

  const optionsData: OptionData[] = [
    {
      id: 0,
      background: 'https://66.media.tumblr.com/6fb397d822f4f9f4596dff2085b18f2e/tumblr_nzsvb4p6xS1qho82wo1_1280.jpg',
      icon: 'fas fa-walking',
      main: 'Blonkisoaz',
      sub: 'Omuke trughte a otufta',
      defaultColor: '#ED5565'
    },
    {
      id: 1,
      background: 'https://66.media.tumblr.com/8b69cdde47aa952e4176b4200052abf4/tumblr_o51p7mFFF21qho82wo1_1280.jpg',
      icon: 'fas fa-snowflake',
      main: 'Oretemauw',
      sub: 'Omuke trughte a otufta',
      defaultColor: '#FC6E51'
    },
    {
      id: 2,
      background: 'https://66.media.tumblr.com/5af3f8303456e376ceda1517553ba786/tumblr_o4986gakjh1qho82wo1_1280.jpg',
      icon: 'fas fa-tree',
      main: 'Iteresuselle',
      sub: 'Omuke trughte a otufta',
      defaultColor: '#FFCE54'
    },
    {
      id: 3,
      background: 'https://66.media.tumblr.com/5516a22e0cdacaa85311ec3f8fd1e9ef/tumblr_o45jwvdsL11qho82wo1_1280.jpg',
      icon: 'fas fa-tint',
      main: 'Idiefe',
      sub: 'Omuke trughte a otufta',
      defaultColor: '#2ECC71'
    },
    {
      id: 4,
      background: 'https://66.media.tumblr.com/f19901f50b79604839ca761cd6d74748/tumblr_o65rohhkQL1qho82wo1_1280.jpg',
      icon: 'fas fa-sun',
      main: 'Inatethi',
      sub: 'Omuke trughte a otufta',
      defaultColor: '#5D9CEC'
    }
  ];

  const handleOptionClick = (optionId: number) => {
    setActiveOption(optionId);
  };

  const styles = `
    .options-container {
      display: flex;
      flex-direction: row;
      justify-content: center;
      align-items: center;
      overflow: hidden;
      height: 100vh;
      font-family: 'Roboto', sans-serif;
      transition: 0.25s;
      background: #f5f5f5;
    }
    
    .options-wrapper {
      display: flex;
      flex-direction: row;
      align-items: stretch;
      overflow: hidden;
      min-width: 600px;
      max-width: 900px;
      width: calc(100% - 100px);
      height: 400px;
    }
    
    .option-item {
      position: relative;
      overflow: hidden;
      min-width: 60px;
      margin: 10px;
      background-size: auto 120%;
      background-position: center;
      cursor: pointer;
      transition: 0.5s cubic-bezier(0.05, 0.61, 0.41, 0.95);
      border-radius: 30px;
      flex-grow: 1;
    }
    
    .option-item.active {
      flex-grow: 10000;
      transform: scale(1);
      max-width: 600px;
      margin: 0px;
      border-radius: 40px;
      background-size: auto 100%;
    }
    
    .option-item.active .option-shadow {
      box-shadow: inset 0 -120px 120px -120px black, inset 0 -120px 120px -100px black;
    }
    
    .option-item:not(.active) .option-shadow {
      bottom: -40px;
      box-shadow: inset 0 -120px 0px -120px black, inset 0 -120px 0px -100px black;
    }
    
    .option-item.active .option-label {
      bottom: 20px;
      left: 20px;
    }
    
    .option-item:not(.active) .option-label {
      bottom: 10px;
      left: 10px;
    }
    
    .option-item.active .option-info > div {
      left: 0px;
      opacity: 1;
    }
    
    .option-item:not(.active) .option-info > div {
      left: 20px;
      opacity: 0;
    }
    
    .option-shadow {
      position: absolute;
      bottom: 0px;
      left: 0px;
      right: 0px;
      height: 120px;
      transition: 0.5s cubic-bezier(0.05, 0.61, 0.41, 0.95);
    }
    
    .option-label {
      display: flex;
      position: absolute;
      right: 0px;
      height: 40px;
      transition: 0.5s cubic-bezier(0.05, 0.61, 0.41, 0.95);
    }
    
    .option-icon {
      display: flex;
      flex-direction: row;
      justify-content: center;
      align-items: center;
      min-width: 40px;
      max-width: 40px;
      height: 40px;
      border-radius: 100%;
      background-color: white;
    }
    
    .option-info {
      display: flex;
      flex-direction: column;
      justify-content: center;
      margin-left: 10px;
      color: white;
      white-space: pre;
    }
    
    .option-info > div {
      position: relative;
      transition: 0.5s cubic-bezier(0.05, 0.61, 0.41, 0.95), opacity 0.5s ease-out;
    }
    
    .option-main {
      font-weight: bold;
      font-size: 1.2rem;
    }
    
    .option-sub {
      transition-delay: 0.1s;
    }
    
    .inactive-options {
      display: none;
    }
    
    /* Tablet and Mobile Responsive Styles */
    @media screen and (max-width: 1024px) {
      .options-container {
        padding: 20px;
        height: auto;
        min-height: 100vh;
        flex-direction: column;
      }
      
      .options-wrapper {
        display: flex;
        flex-direction: column;
        min-width: auto;
        max-width: none;
        width: 100%;
        height: auto;
        align-items: center;
      }
      
      /* Active option takes full width and proper height */
      .option-item.active {
        display: block;
        width: 100%;
        max-width: 500px;
        height: 300px;
        margin: 0 0 30px 0;
        border-radius: 25px;
        background-size: cover;
        flex-grow: 0;
        transform: none;
      }
      
      /* Ensure content is in bottom left */
      .option-item.active .option-label {
        bottom: 25px;
        left: 25px;
        right: auto;
        height: 40px;
      }
      
      .option-item.active .option-info > div {
        left: 0px;
        opacity: 1;
      }
      
      /* Hide inactive options from normal flow and show as icons */
      .option-item:not(.active) {
        display: none;
      }
      
      /* Show inactive options as circular icons */
      .inactive-options {
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        gap: 15px;
        width: 100%;
        max-width: 500px;
      }
      
      .inactive-option {
        width: 70px;
        height: 70px;
        border-radius: 50%;
        background-size: cover;
        background-position: center;
        position: relative;
        cursor: pointer;
        transition: transform 0.3s ease;
        overflow: hidden;
      }
      
      .inactive-option::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 50%;
      }
      
      .inactive-option-inner {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        z-index: 1;
      }
    }
    
    /* Mobile specific adjustments */
    @media screen and (max-width: 768px) {
      .option-item.active {
        height: 250px;
        border-radius: 20px;
        max-width: 400px;
      }
      
      .option-item.active .option-label {
        bottom: 20px;
        left: 20px;
      }
      
      .inactive-option {
        width: 60px;
        height: 60px;
      }
      
      .inactive-option-inner {
        width: 35px;
        height: 35px;
        font-size: 16px;
      }
    }
    
    /* Small mobile adjustments */
    @media screen and (max-width: 480px) {
      .option-item.active {
        height: 220px;
        border-radius: 18px;
      }
      
      .option-item.active .option-label {
        bottom: 18px;
        left: 18px;
      }
      
      .option-main {
        font-size: 1.1rem;
      }
      
      .inactive-option {
        width: 50px;
        height: 50px;
      }
      
      .inactive-option-inner {
        width: 30px;
        height: 30px;
        font-size: 14px;
      }
    }
  `;

  return (
    <>
      <link 
        rel="stylesheet" 
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css"
      />
      <link 
        href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" 
        rel="stylesheet"
      />
      
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      
      <div className="options-container">
        <div className="options-wrapper">
          {optionsData.map((option) => (
            <div
              key={option.id}
              className={`option-item ${activeOption === option.id ? 'active' : ''}`}
              style={{
                backgroundImage: `url(${option.background})`,
                '--defaultBackground': option.defaultColor
              } as React.CSSProperties}
              onClick={() => handleOptionClick(option.id)}
            >
              <div className="option-shadow"></div>
              <div className="option-label">
                <div className="option-icon" style={{ color: option.defaultColor }}>
                  <i className={option.icon}></i>
                </div>
                <div className="option-info">
                  <div className="option-main">{option.main}</div>
                  <div className="option-sub">{option.sub}</div>
                </div>
              </div>
            </div>
          ))}
          
          <div className="inactive-options">
            {optionsData.map((option) => (
              option.id !== activeOption && (
                <div
                  key={option.id}
                  className="inactive-option"
                  style={{
                    backgroundImage: `url(${option.background})`,
                  }}
                  onClick={() => handleOptionClick(option.id)}
                >
                  <div className="inactive-option-inner">
                    <i className={option.icon} style={{ color: option.defaultColor }}></i>
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default OptionsSelector;
