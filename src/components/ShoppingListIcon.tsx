import { Apple, Hammer, House, PawPrint, Pill, Shirt, ShoppingBasket } from "lucide-react";
import { shoppingListIcons, type TodoDisplay } from "../../shared/configuration";
import { useI18n } from "@/hooks/use-i18n";
import { Button } from "./ui/button";

type IconName = NonNullable<TodoDisplay["shoppingIcon"]>;
const icons = {
  basket: [ShoppingBasket, "Shopping basket"], groceries: [Apple, "Groceries"], household: [House, "Household"],
  hardware: [Hammer, "Hardware"], clothing: [Shirt, "Clothing"], pharmacy: [Pill, "Pharmacy"], pets: [PawPrint, "Pet supplies"],
} as const;

export function ShoppingListAvatar({ icon = "basket", small = false }: { icon?: IconName; small?: boolean }) {
  const [Icon] = icons[icon];
  return <span className={`member-avatar shopping-avatar${small ? " small" : ""}`} aria-hidden="true"><Icon /></span>;
}

export function ShoppingListIconPicker({ value = "basket", onChange }: { value?: IconName; onChange: (icon: IconName) => void }) {
  const { t } = useI18n();
  return <fieldset><legend className="mb-2 text-sm">{t("List icon")}</legend>
    <div className="flex flex-wrap gap-2">{shoppingListIcons.map(id => {
      const [Icon, label] = icons[id];
      return <Button key={id} type="button" className="min-h-11" variant={value === id ? "default" : "outline"}
        aria-pressed={value === id} onClick={() => onChange(id)}><Icon aria-hidden="true" />{t(label)}</Button>;
    })}</div>
  </fieldset>;
}
