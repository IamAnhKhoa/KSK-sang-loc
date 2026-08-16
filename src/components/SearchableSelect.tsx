import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';

interface SearchableSelectProps {
  label?: React.ReactNode;
  value?: string;
  onChange: (value: string) => void;
  options?: string[];
  placeholder?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  hasError?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  value = '',
  onChange,
  options = [],
  placeholder = 'Gõ để tìm kiếm hoặc chọn...',
  required = false,
  error,
  hint,
  className = ''
}) => {
  const safeValue = value ?? '';
  const safeOptions = Array.isArray(options) ? options : [];

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchLower = (searchTerm || '').trim().toLowerCase();
  const filteredOptions = safeOptions
    .filter((opt) => opt && typeof opt === 'string' && opt.toLowerCase().includes(searchLower))
    .slice(0, 40);

  const handleSelect = (opt: string) => {
    onChange(opt);
    setSearchTerm('');
    setIsOpen(false);
  };

  return (
    <div className={`relative space-y-1.5 ${className}`} ref={wrapperRef}>
      {label && (
        <label className="block text-sm font-bold text-slate-800">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <div className="relative">
        <input
          type="text"
          value={isOpen ? (searchTerm !== '' ? searchTerm : safeValue) : safeValue}
          onChange={(e) => {
            const val = e.target.value;
            setSearchTerm(val);
            onChange(val);
            setIsOpen(true);
          }}
          onFocus={() => {
            setSearchTerm('');
            setIsOpen(true);
          }}
          placeholder={placeholder}
          className={`w-full pl-3.5 pr-10 py-3 bg-white border-2 ${
            error ? 'border-red-400 focus:ring-red-500' : 'border-slate-300 focus:border-sky-500 focus:ring-sky-500'
          } rounded-xl outline-none text-base font-semibold text-slate-900 transition-all shadow-sm`}
        />

        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-slate-400">
          {safeValue && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
                setSearchTerm('');
              }}
              className="hover:text-slate-600 p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <ChevronDown
            className={`w-5 h-5 transition-transform duration-200 cursor-pointer ${
              isOpen ? 'rotate-180 text-sky-600' : ''
            }`}
            onClick={() => setIsOpen(!isOpen)}
          />
        </div>
      </div>

      {hint && !error && <p className="text-xs text-slate-500 font-medium">{hint}</p>}
      {error && <p className="text-xs text-red-600 font-bold">{error}</p>}

      {/* Dropdown Options List */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border-2 border-sky-500 rounded-2xl shadow-2xl py-1 text-sm animate-fade-in">
          {filteredOptions.length === 0 ? (
            <div className="p-3 text-center text-slate-400 font-medium italic">
              Không tìm thấy gợi ý. Bạn có thể tự gõ tên mới bên trên.
            </div>
          ) : (
            filteredOptions.map((opt, idx) => {
              const isSelected = opt === safeValue;
              return (
                <div
                  key={idx}
                  onClick={() => handleSelect(opt)}
                  className={`px-4 py-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-sky-100 text-sky-900 font-bold'
                      : 'hover:bg-slate-100 text-slate-800 font-medium'
                  }`}
                >
                  <span className="break-words whitespace-normal pr-2">{opt}</span>
                  {isSelected && <Check className="w-4 h-4 text-sky-600 flex-shrink-0" />}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
