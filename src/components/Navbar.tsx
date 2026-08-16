import React from 'react';

interface NavbarProps {
  activeTab: 'form' | 'admin';
  setActiveTab: (tab: 'form' | 'admin') => void;
  onOpenQR?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ setActiveTab }) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-18">
          {/* Logo & Title Header */}
          <div 
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer select-none py-2"
            onClick={() => setActiveTab('form')}
          >
            <img 
              src="/logo.png" 
              alt="Logo Trạm Y Tế Xã Tân An Hội" 
              className="w-9 h-9 sm:w-11 sm:h-11 rounded-full object-contain flex-shrink-0 drop-shadow-md"
            />
            <div>
              <p className="text-[9px] sm:text-xs text-slate-500 font-bold uppercase tracking-wider">ỦY BAN NHÂN DÂN XÃ TÂN AN HỘI</p>
              <h1 className="font-extrabold text-sm sm:text-base md:text-lg text-slate-900 leading-tight">
                TRẠM Y TẾ
              </h1>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
