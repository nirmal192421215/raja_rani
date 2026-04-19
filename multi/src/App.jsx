import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GameProvider } from './context/GameContext';

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

function App() {
  return (
    <GameProvider>
      <BrowserRouter>
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </GameProvider>
  );
}

export default App;
