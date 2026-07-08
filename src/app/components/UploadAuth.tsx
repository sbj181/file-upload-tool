import React, { useState, useEffect } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';

interface UploadAuthProps {
  onAuthenticated: (password: string) => void;
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes in milliseconds

const UploadAuth: React.FC<UploadAuthProps> = ({ onAuthenticated }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);

  useEffect(() => {
    // Check for existing lockout
    const storedLockout = localStorage.getItem('uploadAuthLockout');
    if (storedLockout) {
      const lockoutTime = parseInt(storedLockout);
      if (lockoutTime > Date.now()) {
        setLockedUntil(lockoutTime);
      } else {
        localStorage.removeItem('uploadAuthLockout');
      }
    }

    // Load previous attempts
    const storedAttempts = localStorage.getItem('uploadAuthAttempts');
    if (storedAttempts) {
      setAttempts(parseInt(storedAttempts));
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if currently locked out
    if (lockedUntil && lockedUntil > Date.now()) {
      const minutesLeft = Math.ceil((lockedUntil - Date.now()) / (60 * 1000));
      setError(`Too many attempts. Please try again in ${minutesLeft} minutes.`);
      return;
    }

    // Verify the password against the server (source of truth for UPLOAD_PASSWORD).
    const res = await fetch('/api/verify-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      onAuthenticated(password);
      setError('');
      // Reset attempts on successful login
      setAttempts(0);
      localStorage.removeItem('uploadAuthAttempts');
      localStorage.removeItem('uploadAuthLockout');
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      localStorage.setItem('uploadAuthAttempts', newAttempts.toString());

      if (newAttempts >= MAX_ATTEMPTS) {
        const lockoutTime = Date.now() + LOCKOUT_TIME;
        setLockedUntil(lockoutTime);
        localStorage.setItem('uploadAuthLockout', lockoutTime.toString());
        setError(`Too many attempts. Please try again in 15 minutes.`);
      } else {
        setError(`Invalid password. ${MAX_ATTEMPTS - newAttempts} attempts remaining.`);
      }
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter upload password"
            className="w-full p-2 pr-10 border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-white"
            disabled={lockedUntil !== null && lockedUntil > Date.now()}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400"
          >
            {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
          </button>
        </div>
        {error && <p className="text-red-500">{error}</p>}
        <button 
          type="submit"
          className={`w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 transition ${
            lockedUntil && lockedUntil > Date.now() ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          disabled={lockedUntil !== null && lockedUntil > Date.now()}
        >
          Authenticate
        </button>
      </form>
    </div>
  );
};

export default UploadAuth; 