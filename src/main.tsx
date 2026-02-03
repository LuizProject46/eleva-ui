import { createRoot } from "react-dom/client";
import { applyBrandingCacheToCss } from "@/lib/branding";
import App from "./App.tsx";
import "./index.css";

applyBrandingCacheToCss();

createRoot(document.getElementById("root")!).render(<App />);
