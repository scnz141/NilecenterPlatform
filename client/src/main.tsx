import { createRoot } from "react-dom/client";
import { MotionConfig } from "framer-motion";
import App from "./App";
import { installStaleDeploymentRecovery } from "./lib/runtime/deploymentRecovery";
import "./index.css";
import "./styles/teacher-delivery-v3.css";
import "./styles/portal-ui-v3.css";
import "./styles/student-learning-v3.css";
import "./styles/registrar-v3.css";
import "./styles/hod-v3.css";
import "./styles/branch-v3.css";
import "./styles/admin-v3.css";
import "./styles/portal-v4.css";
import "./styles/teacher-v4.css";
import "./styles/student-v4.css";
import "./styles/operations-v4.css";
import "./styles/admin-v4.css";
import "./styles/portal-insights.css";
import "./styles/nile-forms.css";
import "./styles/teacher-v5.css";
import "./styles/registrar-v5.css";
import "./styles/hod-v4.css";
import "./styles/branch-v4.css";
import "./styles/student-v5.css";
import "./styles/directories-v2.css";
import "./styles/messages-v1.css";
import "./styles/auth-v2.css";

installStaleDeploymentRecovery();

createRoot(document.getElementById("root")!).render(
  <MotionConfig reducedMotion="user">
    <App />
  </MotionConfig>
);
