
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

const WelcomePage = lazy(() => import("../../features/welcome/WelcomePage"));
const ExplorerPage = lazy(() => import("../../features/planetary-explorer/ExplorerPage"));
const LocationPage = lazy(() => import("../../features/planetary-explorer/LocationPage"));
const InvestigationPage = lazy(() => import("../../features/mission/InvestigationPage"));
const EvidenceInspectorPage = lazy(() => import("../../features/mission/EvidenceInspectorPage"));
const KnowledgeGapsPage = lazy(() => import("../../features/mission/KnowledgeGapsPage"));
const MissionBuilderPage = lazy(() => import("../../features/mission/MissionBuilderPage"));
const RoutePlannerPage = lazy(() => import("../../features/mission/RoutePlannerPage"));
const MarswalkPage = lazy(() => import("../../features/mission/MarswalkPage"));
const ExpeditionReviewPage = lazy(() => import("../../features/mission/ExpeditionReviewPage"));
const ExpeditionReportPage = lazy(() => import("../../features/mission/ExpeditionReportPage"));
const GlobeTestPage = lazy(() => import("../../globe/MarsGlobe"));
const LoginPage = lazy(() => import("../../features/auth/LoginPage"));
const RegisterPage = lazy(() => import("../../features/auth/RegisterPage"));

export default function AppRoutes() {
    return (
        <Suspense fallback={<div className="mx-panel m-6 p-6" role="status">Loading Mars Explorer…</div>}>
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
        </Suspense>
    );
}
