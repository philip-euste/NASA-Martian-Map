
import { BrowserRouter } from "react-router-dom";

import AppRoutes from "./app/routes/AppRoutes";
import { MissionProvider } from "./state/mission/MissionContext";
import { AuthProvider } from "./features/auth/AuthProvider";

function App() {
  return (
    <MissionProvider>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </MissionProvider>
  );
}

export default App;
