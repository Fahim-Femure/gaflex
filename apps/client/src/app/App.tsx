import { Navigate, Route, Routes } from 'react-router-dom';
import { CreatePage } from '../pages/CreatePage';
import { JoinPage } from '../pages/JoinPage';
import { LandingPage } from '../pages/LandingPage';
import { LobbyPage } from '../pages/LobbyPage';
import { PlayPage } from '../pages/PlayPage';
import { TablePage } from '../pages/TablePage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/create" element={<CreatePage />} />
      <Route path="/join" element={<JoinPage />} />
      <Route path="/join/:code" element={<JoinPage />} />
      <Route path="/room/:code/lobby" element={<LobbyPage />} />
      <Route path="/room/:code/play" element={<PlayPage />} />
      <Route path="/room/:code/table" element={<TablePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
