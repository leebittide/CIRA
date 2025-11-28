import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { User, Mail, Lock, IdCard, UserPlus, Eye, EyeOff } from 'lucide-react';
import { useToast } from '../ui/toast-container';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { auth, db } from '../../lib/firebase';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import MainLogoWhite from '../../assets/MainLogoWhite.png';
import { PasswordChecklist } from './PasswordChecklist';

interface SignupPageProps {
  onNavigateToLogin: () => void;
  onSignupSuccess: (email: string) => void;
}

export const SignupPage: React.FC<SignupPageProps> = ({ onNavigateToLogin, onSignupSuccess }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: 'student',
    studentId: '',
    password: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { showToast } = useToast();
  const emailInputRef = useRef<HTMLInputElement>(null);

  const validateField = (name: string, value: string, currentFormData = formData): string => {
    switch (name) {
      case 'firstName':
        return value.trim() ? '' : 'First Name is required';
      case 'lastName':
        return value.trim() ? '' : 'Last Name is required';
      case 'email':
        if (!value || value === '@plv.edu.ph') return 'Email is required';
        if (!value.endsWith('@plv.edu.ph')) return 'Email must be a valid @plv.edu.ph address';
        return '';
      case 'studentId':
        const studentIdRegex = /^\d{2}-\d{4}$/;
        if (!value.trim()) return 'Student ID is required';
        if (!studentIdRegex.test(value)) return 'Student ID must be in format: XX-XXXX';
        return '';
      case 'password':
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!value) return 'Password is required';
        if (!passwordRegex.test(value)) return 'Password does not meet the requirements';
        return '';
      case 'confirmPassword':
        if (!value) return 'Confirm Password is required';
        if (currentFormData.password !== value) return 'Passwords do not match';
        return '';
      default:
        return '';
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'password') {
      setIsPasswordFocused(false);
    }
    const error = validateField(name, value);
    setErrors(prev => {
      const newErrors = { ...prev };
      if (error) {
        newErrors[name] = error;
      } else {
        delete newErrors[name];
      }
      return newErrors;
    });

    if (name === 'password' && formData.confirmPassword) {
      const confirmPasswordError = validateField('confirmPassword', formData.confirmPassword);
      setErrors(prev => {
        const newErrors = { ...prev };
        if (confirmPasswordError) {
          newErrors.confirmPassword = confirmPasswordError;
        } else {
          delete newErrors.confirmPassword;
        }
        return newErrors;
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    // Student ID formatting and validation
    if (name === 'studentId') {
      // Only allow digits and dash, auto-insert dash after 2 digits
      let raw = value.replace(/[^\d]/g, '');
      if (raw.length > 6) raw = raw.slice(0, 6);
      let formatted = raw;
      if (raw.length > 2) {
        formatted = raw.slice(0, 2) + '-' + raw.slice(2);
      }
      setFormData(prev => ({ ...prev, [name]: formatted }));
      if (errors[name]) {
        const error = validateField(name, formatted, { ...formData, [name]: formatted });
        if (!error) {
          setErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[name];
            return newErrors;
          });
        }
      }
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));

    // Live validation for confirmPassword
    if (name === 'confirmPassword' || name === 'password') {
      const confirmValue = name === 'confirmPassword' ? value : formData.confirmPassword;
      const passwordValue = name === 'password' ? value : formData.password;
      const confirmError = validateField('confirmPassword', confirmValue, { ...formData, password: passwordValue, confirmPassword: confirmValue });
      setErrors(prev => {
        const newErrors = { ...prev };
        if (confirmError) {
          newErrors.confirmPassword = confirmError;
        } else {
          delete newErrors.confirmPassword;
        }
        return newErrors;
      });
    }

    if (errors[name] && name !== 'confirmPassword') {
      const error = validateField(name, value, { ...formData, [name]: value });
      if (!error) {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[name];
          return newErrors;
        });
      }
    }
  };

  const handleEmailFocus = () => {
    if (!formData.email) {
      setFormData(prev => ({ ...prev, email: '@plv.edu.ph' }));
    }
  };

  const handleEmailClick = () => {
    if (emailInputRef.current && formData.email === '@plv.edu.ph') {
      setTimeout(() => {
        emailInputRef.current?.setSelectionRange(0, 0);
      }, 0);
    }
  };

  useEffect(() => {
    if (formData.email === '@plv.edu.ph' && emailInputRef.current) {
      setTimeout(() => {
        emailInputRef.current?.setSelectionRange(0, 0);
      }, 0);
    }
  }, [formData.email]);

  const handleEmailBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    handleBlur(e);
    const value = e.target.value;
    if (value === '@plv.edu.ph') {
      setFormData(prev => ({ ...prev, email: '' }));
    } else if (value && !value.endsWith('@plv.edu.ph')) {
      setFormData(prev => ({ ...prev, email: value + '@plv.edu.ph' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    const fields: Array<keyof typeof formData> = ['firstName', 'lastName', 'email', 'studentId', 'password', 'confirmPassword'];

    fields.forEach(field => {
      const error = validateField(field, formData[field]);
      if (error) {
        newErrors[field] = error;
      }
    });

    setErrors(newErrors);
    const isValid = Object.keys(newErrors).length === 0;
    if (!isValid) {
      showToast('Please check the form for errors.', 'error');
    }
    return isValid;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;
      
      const userData: any = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        studentId: formData.studentId,
        role: 'student', 
      };

      if (formData.role === 'class-representative') {
        userData.requestedRole = 'class-representative';
      }

      await setDoc(doc(db, "users", user.uid), userData);

      await sendEmailVerification(user);
      onSignupSuccess(formData.email);

    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        setErrors(prev => ({ ...prev, email: 'This email is already in use.' }));
        showToast('This email is already in use.', 'error');
      } else {
        showToast('Failed to create account. Please try again.', 'error');
      }
    } finally {
      setIsLoading(false);
      setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#050A30] via-[#1B1F50] to-[#3942A7] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl"
      >
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-[#3942A7] to-[#1B1F50] p-8 text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, delay: 0.2 }} className="w-20 h-20 mx-auto mb-4 flex items-center justify-center" style={{ width: '120px', height: '120px' }}>
              <ImageWithFallback src={MainLogoWhite} alt="CIRA" className="w-full h-full object-cover" />
            </motion.div>
            <p className="text-white/80">Create your account</p>
          </div>

          <div className="p-8">
            <form onSubmit={handleSignup} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[#1E1E1E] mb-2">
                    First Name {errors.firstName && <span className="text-[#FF4D4F]">*</span>}
                  </label>
                  <div className={`flex items-center border rounded-lg ${errors.firstName ? 'border-[#FF4D4F] bg-red-50' : 'border-gray-300'} focus-within:ring-2 focus-within:ring-inset focus-within:ring-[#3942A7] transition-all px-3`}>
                    <User className="w-5 h-5 text-[#7A7A7A] mr-3" />
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      onBlur={handleBlur}
                      className="w-full py-3 pl-0 border-none bg-transparent focus:outline-none focus:ring-0 flex-1"
                      placeholder="Juan"
                    />
                  </div>
                  {errors.firstName && <p className="text-[#FF4D4F] text-sm mt-1">{errors.firstName}</p>}
                </div>
                <div>
                  <label className="block text-[#1E1E1E] mb-2">
                    Last Name {errors.lastName && <span className="text-[#FF4D4F]">*</span>}
                  </label>
                  <div className={`flex items-center border rounded-lg ${errors.lastName ? 'border-[#FF4D4F] bg-red-50' : 'border-gray-300'} focus-within:ring-2 focus-within:ring-inset focus-within:ring-[#3942A7] transition-all px-3`}>
                    <User className="w-5 h-5 text-[#7A7A7A] mr-3" />
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      onBlur={handleBlur}
                      className="w-full py-3 pl-0 border-none bg-transparent focus:outline-none focus:ring-0 flex-1"
                      placeholder="Dela Cruz"
                    />
                  </div>
                  {errors.lastName && <p className="text-[#FF4D4F] text-sm mt-1">{errors.lastName}</p>}
                </div>
              </div>
              <div>
                <label className="block text-[#1E1E1E] mb-2">
                  Email (@plv.edu.ph only) {errors.email && <span className="text-[#FF4D4F]">*</span>}
                </label>
                <div className={`flex items-center border rounded-lg ${errors.email ? 'border-[#FF4D4F] bg-red-50' : 'border-gray-300'} focus-within:ring-2 focus-within:ring-inset focus-within:ring-[#3942A7] transition-all px-3`}>
                  <Mail className="w-5 h-5 text-[#7A7A7A] mr-3" />
                  <input
                    ref={emailInputRef}
                    type="text"
                    name="email"
                    autoComplete="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    onFocus={handleEmailFocus}
                    onClick={handleEmailClick}
                    onBlur={handleEmailBlur}
                    className="w-full py-3 pl-0 border-none bg-transparent focus:outline-none focus:ring-0 flex-1"
                    placeholder="student@plv.edu.ph"
                  />
                </div>
                {errors.email && <p className="text-[#FF4D4F] text-sm mt-1">{errors.email}</p>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[#1E1E1E] mb-2">Role</label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3942A7] transition-all"
                  >
                    <option value="student">Student</option>
                    <option value="class-representative">Class Representative</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#1E1E1E] mb-2">
                    Student ID (XX-XXXX) {errors.studentId && <span className="text-[#FF4D4F]">*</span>}
                  </label>
                  <div className={`flex items-center border rounded-lg ${errors.studentId ? 'border-[#FF4D4F] bg-red-50' : 'border-gray-300'} focus-within:ring-2 focus-within:ring-inset focus-within:ring-[#3942A7] transition-all px-3`}>
                    <IdCard className="w-5 h-5 text-[#7A7A7A] mr-3" />
                    <input
                      type="text"
                      name="studentId"
                      value={formData.studentId}
                      onChange={handleInputChange}
                      onBlur={handleBlur}
                      className="w-full py-3 pl-0 border-none bg-transparent focus:outline-none focus:ring-0 flex-1"
                      placeholder="23-3302"
                    />
                  </div>
                  {errors.studentId && <p className="text-[#FF4D4F] text-sm mt-1">{errors.studentId}</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <div className="flex justify-between items-center">
                    <label className="block text-[#1E1E1E] mb-2">
                      Password {errors.password && <span className="text-[#FF4D4F]">*</span>}
                    </label>
                  </div>
                  <div className={`flex items-center border rounded-lg ${errors.password ? 'border-[#FF4D4F] bg-red-50' : 'border-gray-300'} focus-within:ring-2 focus-within:ring-inset focus-within:ring-[#3942A7] transition-all px-3`}>
                    <Lock className="w-5 h-5 text-[#7A7A7A] mr-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      autoComplete="new-password"
                      value={formData.password}
                      onChange={handleInputChange}
                      onFocus={() => setIsPasswordFocused(true)}
                      onBlur={handleBlur}
                      className="w-full py-3 pl-0 border-none bg-transparent focus:outline-none focus:ring-0 flex-1"
                      placeholder="••••••••"
                    />
                    <div className="cursor-pointer" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="w-5 h-5 text-[#7A7A7A]" /> : <Eye className="w-5 h-5 text-[#7A7A7A]" />}
                    </div>
                  </div>
                  {errors.password && <p className="text-[#FF4D4F] text-sm mt-1">{errors.password}</p>}
                </div>
                <div>
                  <label className="block text-[#1E1E1E] mb-2">
                    Confirm Password {errors.confirmPassword && <span className="text-[#FF4D4F]">*</span>}
                  </label>
                  <div className={`flex items-center border rounded-lg ${errors.confirmPassword ? 'border-[#FF4D4F] bg-red-50' : 'border-gray-300'} focus-within:ring-2 focus-within:ring-inset focus-within:ring-[#3942A7] transition-all px-3`}>
                    <Lock className="w-5 h-5 text-[#7A7A7A] mr-3" />
                    <input
                     type={showConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      autoComplete="new-password"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      onBlur={handleBlur}
                      className="w-full py-3 pl-0 border-none bg-transparent focus:outline-none focus:ring-0 flex-1"
                      placeholder="••••••••"
                    />
                    <div className="cursor-pointer" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                      {showConfirmPassword ? <EyeOff className="w-5 h-5 text-[#7A7A7A]" /> : <Eye className="w-5 h-5 text-[#7A7A7A]" />}
                    </div>
                  </div>
                  {errors.confirmPassword && <p className="text-[#FF4D4F] text-sm mt-1">{errors.confirmPassword}</p>}
                </div>
              </div>
              {(isPasswordFocused || formData.password) && <PasswordChecklist password={formData.password} confirmPassword={formData.confirmPassword} isSubmitted={isSubmitted} />}
              <motion.button
                type="submit"
                disabled={isLoading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full bg-gradient-to-r from-[#3942A7] to-[#1B1F50] text-white py-3 rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    <span>Create Account</span>
                  </>
                )}
              </motion.button>
            </form>
            <div className="mt-6 text-center">
              <p className="text-[#7A7A7A]">
                Already have an account?{' '}
                <button
                  onClick={onNavigateToLogin}
                  className="text-[#3942A7] hover:underline transition-all"
                >
                  Login
                </button>
              </p>
            </div>
          </div>
          <div className="bg-[#F9FAFB] px-8 py-4 text-center border-t">
            <p className="text-[#7A7A7A]">College of Engineering and Information Technology</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
