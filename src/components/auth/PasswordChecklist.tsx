import React from 'react';
import { Check, X } from 'lucide-react';

interface PasswordChecklistProps {
  password: string;
  confirmPassword?: string;
  isSubmitted: boolean;
}

export const PasswordChecklist: React.FC<PasswordChecklistProps> = ({ password, confirmPassword, isSubmitted }) => {
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    digit: /\d/.test(password),
    symbol: /[@$!%*?&]/.test(password),
  };

  const allChecksPassed = Object.values(checks).every(Boolean);

  if (allChecksPassed && password && confirmPassword && password === confirmPassword) {
    return (
      <div className="mt-2 space-y-1">
        <div className="flex items-center text-sm text-[#1DB954]">
          <Check className="w-4 h-4 mr-2" />
          <span>Password Matched!</span>
        </div>
      </div>
    );
  }

  const checklistItems = [
    { key: 'length', text: 'At least 8 characters' },
    { key: 'uppercase', text: 'Contains an uppercase letter' },
    { key: 'lowercase', text: 'Contains a lowercase letter' },
    { key: 'digit', text: 'Contains a digit' },
    { key: 'symbol', text: 'Contains a symbol' },
  ];

  const getColor = (hasPassed: boolean) => {
    if (hasPassed) return 'text-[#1DB954]';
    return 'text-[#FF4D4F]';
  };

  return (
    <div className="mt-2 space-y-1">
      {checklistItems.map(item => {
        const hasPassed = checks[item.key as keyof typeof checks];
        return (
          <div key={item.key} className={`flex items-center text-sm ${getColor(hasPassed)}`}>
            {hasPassed ? (
              <Check className="w-4 h-4 mr-2" />
            ) : (
              <X className="w-4 h-4 mr-2" />
            )}
            <span>{item.text}</span>
          </div>
        );
      })}
    </div>
  );
};
