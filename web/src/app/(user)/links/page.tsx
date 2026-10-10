import { AppShell, currentLocale } from "@/components/app-shell";
import { LinksWorkspace } from "@/components/links/links-workspace";
import { unifiedForwardText } from "@/lib/forward-unified-i18n";
export default async function LinksPage() {
  const locale = await currentLocale();
  return <AppShell title={unifiedForwardText(locale, "advanced")} subtitle={unifiedForwardText(locale, "advancedHint")} activeHref="/links"><LinksWorkspace /></AppShell>;
}
