
import { Navigate, Route, Routes } from "react-router-dom";

import WelcomePage from "../../features/welcome/WelcomePage";
import ExplorerPage from "../../features/planetary-explorer/ExplorerPage";
import LocationPage from "../../features/planetary-explorer/LocationPage";

import InvestigationPage from "../../features/mission/InvestigationPage";
import EvidenceInspectorPage from "../../features/mission/EvidenceInspectorPage";
import KnowledgeGapsPage from "../../features/mission/KnowledgeGapsPage";
import MissionBuilderPage from "../../features/mission/MissionBuilderPage";
import RoutePlannerPage from "../../features/mission/RoutePlannerPage";
import MarswalkPage from "../../features/mission/MarswalkPage";
import ExpeditionReviewPage from "../../features/mission/ExpeditionReviewPage";
import ExpeditionReportPage from "../../features/mission/ExpeditionReportPage";

import GlobeTestPage from "../../globe/MarsGlobe";

import LoginPage from "../../features/auth/LoginPage";
import RegisterPage from "../../features/auth/RegisterPage";

export default function AppRoutes() {
    return (
        <Routes>
            {/* PUBLIC APPLICATION ROUTES */}

            <Route path="/" element={<WelcomePage />} />
            <Route path="/explorer" element={<ExplorerPage />} />
            <Route path="/explorer/location/:siteId" element={<LocationPage />} />
            <Route path="/globe-test" element={<GlobeTestPage />} />

            {/* OPTIONAL AUTHENTICATION ROUTES */}

            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* PUBLIC MISSION ROUTES */}

            <Route
                path="/mission"
                element={<Navigate to="/mission/investigate" replace />}
            />
            <Route path="/mission/investigate" element={<InvestigationPage />} />
            <Route path="/mission/evidence" element={<EvidenceInspectorPage />} />
            <Route path="/mission/gaps" element={<KnowledgeGapsPage />} />
            <Route path="/mission/builder" element={<MissionBuilderPage />} />
            <Route path="/mission/route" element={<RoutePlannerPage />} />
            <Route path="/mission/simulate" element={<MarswalkPage />} />
            <Route path="/mission/review" element={<ExpeditionReviewPage />} />
            <Route path="/mission/report" element={<ExpeditionReportPage />} />

            {/* FALLBACK */}

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
