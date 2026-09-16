import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ProblemInput from './pages/ProblemInput';
import AgentMissionControl from './pages/AgentMissionControl';
import SolutionComparison from './pages/SolutionComparison';
import ActionPlanPage from './pages/ActionPlan';
import ImpactReportPage from './pages/ImpactReport';
import ImpactSimulator from './pages/ImpactSimulator';
import ImpactScore from './pages/ImpactScore';
import RippleImpact from './pages/RippleImpact';
import EvidenceAssumptions from './pages/EvidenceAssumptions';
import Verification from './pages/Verification';
import MonitoringPage from './pages/MonitoringPage';
import AnalysesList from './pages/AnalysesList';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/new" element={<ProblemInput />} />
          <Route path="/analyses" element={<AnalysesList />} />
          <Route path="/analysis/:id" element={<AgentMissionControl />} />
          <Route path="/analysis/:id/mission" element={<AgentMissionControl />} />
          <Route path="/analysis/:id/solutions" element={<SolutionComparison />} />
          <Route path="/analysis/:id/action-plan" element={<ActionPlanPage />} />
          <Route path="/analysis/:id/simulator" element={<ImpactSimulator />} />
          <Route path="/analysis/:id/score" element={<ImpactScore />} />
          <Route path="/analysis/:id/report" element={<ImpactReportPage />} />
          <Route path="/analysis/:id/ripple" element={<RippleImpact />} />
          <Route path="/analysis/:id/evidence" element={<EvidenceAssumptions />} />
          <Route path="/analysis/:id/verification" element={<Verification />} />
          <Route path="/analysis/:id/monitoring" element={<MonitoringPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}