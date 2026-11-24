import { useApp } from "@/contexts/AppContext";
import { useFamily } from "@/contexts/FamilyContext";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { householdSetup, setupSteps } from "@/lib/household-setup";

export function useHouseholdSetup() {
  const { homeOnline, currentHome, connectionStatus, haUrl, connectionError, entityRegistryAvailable } = useApp();
  const family = useFamily();
  const shared = useSharedConfiguration();
  const complete = householdSetup(homeOnline, currentHome.entities, family);
  const needsConnection = connectionStatus === "auth-error" || (connectionStatus === "disconnected" && !haUrl && !!connectionError);
  return setupSteps.filter(step => step.id === "connection" ? needsConnection
    : homeOnline && shared?.state.loaded && !shared.state.error && (step.id === "people" || entityRegistryAvailable) && !complete[step.id]);
}
