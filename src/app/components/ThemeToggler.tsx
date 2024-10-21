// src/components/ThemeToggle.tsx
import { useEffect, useState } from 'react';
import { FiMoon, FiSun } from 'react-icons/fi';

const ThemeToggle = () => {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const currentTheme = localStorage.getItem('theme');
    if (currentTheme === 'dark' || (!currentTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    setDarkMode(!darkMode);
    const theme = !darkMode ? 'dark' : 'light';
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('dark', !darkMode);
  };

  return (
    <div className="flex bg-slate-50 dark:bg-slate-700 py-2 px-4 rounded-full shadow-lg items-center">
      <span className="mr-2 text-sm font-medium text-gray-900 dark:text-gray-300">
        {darkMode ? <FiMoon className="h-5 w-5" /> : <FiSun className="h-5 w-5" />}
      </span>
      <button
        onClick={toggleTheme}
        type="button"
        className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${darkMode ? 'bg-slate-800' : 'bg-slate-400'}`}
        role="switch"
        aria-checked={darkMode}
      >
        <span
          className={`transform transition ease-in-out duration-200 inline-block w-4 h-4 bg-slate-300 dark:bg-slate-300 rounded-full ${darkMode ? 'translate-x-6' : 'translate-x-1'}`}
        />
      </button>
    </div>
  );
};

export default ThemeToggle;
