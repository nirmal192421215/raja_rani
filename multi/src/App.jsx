import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { GameProvider } from './context/GameContext';
import { ToastProvider } from './components/Toast';

// Screens
import SplashScreen from './screens/SplashScreen';
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import CreateRoomScreen from './screens/CreateRoomScreen';
import LobbyScreen from './screens/LobbyScreen';
import RoleRevealScreen from './screens/RoleRevealScreen';
import ActionScreen from './screens/ActionScreen';
import DiscussionScreen from './screens/DiscussionScreen';
import WaitingScreen from './screens/WaitingScreen';
import ResultScreen from './screens/ResultScreen';
import MoneyScreen from './screens/MoneyScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';
import ProfileScreen from './screens/ProfileScreen';
import GlobalLeaderboardScreen from './screens/GlobalLeaderboardScreen';
import StoreScreen from './screens/StoreScreen';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import { LanguageProvider } from './context/LanguageContext';

import { useGame } from './context/GameContext';

/**
 * Global navigator that keeps the UI in sync with the server phase.
 * Prevents "stuck" screens by forcing navigation when the phase changes globally.
 */
function PhaseNavigator() {
  const { phase, room } = useGame();
  const navigate = useNavigate();

  useEffect(() => {
    if (!room) return;

    switch (phase) {
      case 'lobby':
        if (window.location.pathname !== '/lobby') navigate('/lobby');
        break;
      case 'roleReveal':
        if (window.location.pathname !== '/role-reveal') navigate('/role-reveal');
        break;
      case 'discussion':
        if (window.location.pathname !== '/discussion') navigate('/discussion');
        break;
      case 'action':
        if (window.location.pathname !== '/action') navigate('/action');
        break;
      case 'result':
        // Don't auto-navigate to result if we are in the middle of the 'waiting' animation
        // The WaitingScreen will handle its own transition once the animation finishes.
        break;
      case 'leaderboard':
        if (window.location.pathname !== '/leaderboard') navigate('/leaderboard');
        break;
    }
  }, [phase, room, navigate]);

  return null;
}

function App() {
  return (
    <ToastProvider>
      <LanguageProvider>
        <GameProvider>
          <PWAInstallPrompt />
          <BrowserRouter>
            <PhaseNavigator />
            <Routes>

              <Route path="/" element={<SplashScreen />} />
              <Route path="/login" element={<LoginScreen />} />
              <Route path="/home" element={<HomeScreen />} />
              <Route path="/profile" element={<ProfileScreen />} />
              <Route path="/create-room" element={<CreateRoomScreen />} />
              <Route path="/lobby" element={<LobbyScreen />} />
              <Route path="/role-reveal" element={<RoleRevealScreen />} />
              <Route path="/discussion" element={<DiscussionScreen />} />
              <Route path="/action" element={<ActionScreen />} />
              <Route path="/waiting" element={<WaitingScreen />} />
              <Route path="/result" element={<ResultScreen />} />
              <Route path="/money" element={<MoneyScreen />} />
              <Route path="/leaderboard" element={<LeaderboardScreen />} />
              <Route path="/global-leaderboard" element={<GlobalLeaderboardScreen />} />
              <Route path="/store" element={<StoreScreen />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </GameProvider>
      </LanguageProvider>
    </ToastProvider>
  );
}

export default App;
