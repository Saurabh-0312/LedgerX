/** Settings — profile, preferences, charge & tax rates, appearance and local data management. */

import { PageHeader } from "@/components/ui/PageHeader";
import { ProfileCard } from "@/pages/settings/ProfileCard";
import { PreferencesCard } from "@/pages/settings/PreferencesCard";
import { ChargeRatesCard } from "@/pages/settings/ChargeRatesCard";
import { TaxRatesCard } from "@/pages/settings/TaxRatesCard";
import { AppearanceCard } from "@/pages/settings/AppearanceCard";
import { MigrationCard } from "@/pages/settings/MigrationCard";
import { DataCard } from "@/pages/settings/DataCard";
import { AboutCard } from "@/pages/settings/AboutCard";

export default function Settings() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Profile, preferences, charge & tax rate cards, and your locally stored data."
      />
      <div className="max-w-3xl space-y-4 animate-in">
        <ProfileCard />
        <PreferencesCard />
        <ChargeRatesCard />
        <TaxRatesCard />
        <AppearanceCard />
        <MigrationCard />
        <DataCard />
        <AboutCard />
      </div>
    </>
  );
}
