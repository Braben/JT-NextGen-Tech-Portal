import Navbar from './Navbar';
import Footer from './Footer';
import AIChatbot from './AIChatbot';
import { useAuth } from '../context/AuthContext';
import { useChatbot } from '../context/ChatbotContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { ToastProvider } from '../context/ToastContext';
import { ConfirmProvider } from '../context/ConfirmContext';
import { useLocation } from 'react-router-dom';
import { Sun, Moon } from 'lucide-react';
import { motion } from 'framer-motion';

function FloatingThemeToggle() {
  const { dark, toggle } = useTheme();
  return (
    <motion.button
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="fixed bottom-6 left-6 z-50 w-12 h-12 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg flex items-center justify-center text-gray-700 dark:text-gray-200 hover:shadow-xl hover:border-gray-300 dark:hover:border-gray-600 transition-all cursor-pointer"
    >
      {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </motion.button>
  );
}

function LayoutInner({ children }) {
  const { user } = useAuth();
  const { assignmentContext } = useChatbot();
  const location = useLocation();
  const isDashboard = location.pathname.startsWith('/admin') || location.pathname.startsWith('/instructor') || location.pathname.startsWith('/student');
  const isLandingPage = location.pathname === '/' || location.pathname === '/home';

  return (
    <div className="min-h-screen flex flex-col">
      {!isDashboard && <Navbar />}
      <main className={`flex-1 w-full ${isDashboard ? '' : 'max-w-7xl mx-auto px-4 py-6'}`}>
        {children}
      </main>
      {!user && <Footer />}
      <FloatingThemeToggle />
      {!user && isLandingPage && <AIChatbot mode="public" />}
      {user?.role === 'student' && (
        <AIChatbot
          assignmentId={assignmentContext?.id}
          assignmentTitle={assignmentContext?.title}
        />
      )}
    </div>
  );
}

export default function Layout({ children }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ConfirmProvider>
          <LayoutInner>{children}</LayoutInner>
        </ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
