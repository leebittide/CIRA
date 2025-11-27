import React from 'react';
import { motion } from 'motion/react';
import { LogOut, User as UserIcon, AlertCircle, Edit } from 'lucide-react';
import { User } from '../../lib/mockData';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import UpdatedNavyBlueLogo from '../../assets/UpdatedNavyBlueLogo.png';

interface NavbarProps {
  user: User;
  onLogout: () => void;
  onLogoClick: () => void;
  onProfileClick: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, onLogout, onLogoClick, onProfileClick }) => {
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-[#FF4D4F] text-white';
      case 'class-representative':
        return 'bg-[#1DB954] text-white';
      default:
        return 'bg-[#3942A7] text-white';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Admin';
      case 'class-representative':
        return 'Class Rep';
      default:
        return 'Student';
    }
  };

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={onLogoClick}>
            <div className="rounded-lg flex items-center justify-center overflow-hidden" style={{ width: 'auto', height: '60px' }}>
              <ImageWithFallback
                src={UpdatedNavyBlueLogo}
                alt="CIRA"
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          {/* User Info & Logout */}
          <div className="flex items-center gap-4">
            {/* Report Issue Button - only for non-admins */}
            {user.role !== 'admin' && (
              <motion.button
                onClick={() => window.location.href = '/report.html'}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 px-4 py-2 bg-[#3942A7] text-white rounded-lg hover:bg-[#3942A7]/90 transition-all"
              >
                <AlertCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Report Issue</span>
              </motion.button>
            )}
             {/* Form Editor Button - only for admins */}
            {user.role === 'admin' && (
                <motion.button
                    onClick={() => window.location.href = '/form-editor.html'}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-2 px-4 py-2 bg-[#3942A7] text-white rounded-lg hover:bg-[#3942A7]/90 transition-all"
                >
                    <Edit className="w-4 h-4" />
                    <span className="sm:inline">Form Editor</span>
                </motion.button>
            )}
            {/* Profile Section */}
            <div className="flex items-center gap-3 cursor-pointer" onClick={onProfileClick}>
              <div className="w-10 h-10 bg-gradient-to-br from-[#3942A7] to-[#1B1F50] rounded-full flex items-center justify-center">
                <UserIcon className="w-5 h-5 text-white" />
              </div>
              <div className="hidden sm:block text-right">
                <p className="text-[#1E1E1E]">{user.firstName} {user.lastName}</p>
                <span className={`inline-block px-2 py-0.5 rounded-full ${getRoleBadgeColor(user.role)}`}>
                  {getRoleLabel(user.role)}
                </span>
              </div>
            </div>

            {/* Logout Button */}
            <motion.button
              onClick={onLogout}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-4 py-2 bg-[#FF4D4F] text-white rounded-lg hover:bg-[#FF4D4F]/90 transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </motion.button>
          </div>
        </div>
      </div>
    </motion.nav>
  );
};
