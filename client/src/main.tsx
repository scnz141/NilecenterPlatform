import { createRoot } from "react-dom/client";
import { MotionConfig } from "framer-motion";
import App from "./App";
import { installStaleDeploymentRecovery } from "./lib/runtime/deploymentRecovery";
import "./index.css";
import "./styles/portal-ui-v3.css";
import "./styles/portal-v4.css";
import "./styles/operations-v4.css";
import "./styles/portal-insights.css";

installStaleDeploymentRecovery();

createRoot(document.getElementById("root")!).render(
  <MotionConfig reducedMotion="user">
    <App />
  </MotionConfig>
);
