import { useI18n } from "@/hooks/use-i18n";
import { PageHeading } from "@/components/FamilyPlanner";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const { t } = useI18n();
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <section className="glow-panel mx-auto grid max-w-xl justify-items-start gap-4">
      <PageHeading title={t("Page not found")} context="404" />
      <Button asChild><Link to="/">{t("Go to Today")}</Link></Button>
    </section>
  );
};

export default NotFound;
