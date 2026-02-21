import { Routes, Route, Navigate } from "react-router-dom";

import OnboardingIndex from "../pages/onboarding/OnboardingIndex";
import OnboardingBasics from "../pages/onboarding/OnboardingBasics";
import OnboardingLocation from "../pages/onboarding/OnboardingLocation";
import OnboardingTravel from "../pages/onboarding/OnboardingTravel";
import OnboardingSocial from "../pages/onboarding/OnboardingSocial";
import OnboardingServices from "../pages/onboarding/OnboardingServices";
import OnboardingPayouts from "../pages/onboarding/OnboardingPayouts";

export default function OnboardingRoutes() {
  return (
    <Routes>
      <Route index element={<OnboardingIndex />} />
      <Route path="basics" element={<OnboardingBasics />} />
      <Route path="location" element={<OnboardingLocation />} />
      <Route path="travel" element={<OnboardingTravel />} />
      <Route path="social" element={<OnboardingSocial />} />
      <Route path="services" element={<OnboardingServices />} />
      <Route path="payouts" element={<OnboardingPayouts />} />

      {/* fallback */}
      <Route path="*" element={<Navigate to="basics" replace />} />
    </Routes>
  );
}
