import { useRef, useState } from "react";
import {
  Apple, Baby, Backpack, Beef, Bike, Boxes, Cable, Cake, Candy, CarFront, Carrot, Check, ChefHat, Coffee,
  Croissant, CupSoda, Fish, Flag, Flame, Flower2, Gamepad2, Ghost, Gift, Guitar, Hammer, Heart,
  House, Luggage, Milk, MountainSnow, NotebookPen, PaintRoller, Palette, PartyPopper, PawPrint, Pill,
  Rabbit, Sailboat, Sandwich, Scissors, Shirt, ShoppingBasket, Shovel, Sofa, Sparkles, SprayCan,
  Sprout, Tent, TreePine, Trees, Volleyball,
} from "lucide-react";
import { shoppingListIcons, type TodoDisplay } from "../../shared/configuration";
import { useI18n } from "@/hooks/use-i18n";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Input } from "./ui/input";

type IconName = NonNullable<TodoDisplay["shoppingIcon"]>;
const icons = {
  basket: [ShoppingBasket, "Shopping basket", "Everyday shopping"],
  groceries: [Apple, "Groceries", "Everyday shopping"],
  household: [House, "Household", "Everyday shopping"],
  hardware: [Hammer, "Hardware", "Everyday shopping"],
  clothing: [Shirt, "Clothing", "Everyday shopping"],
  pharmacy: [Pill, "Pharmacy", "Everyday shopping"],
  pets: [PawPrint, "Pet supplies", "Everyday shopping"],
  baby: [Baby, "Baby supplies", "Everyday shopping"],
  christmas: [TreePine, "Christmas tree", "Holidays and celebrations"],
  gifts: [Gift, "Gifts", "Holidays and celebrations"],
  easter: [Rabbit, "Easter", "Holidays and celebrations"],
  birthday: [Cake, "Birthday", "Holidays and celebrations"],
  party: [PartyPopper, "Party", "Holidays and celebrations"],
  "new-year": [Sparkles, "New Year", "Holidays and celebrations"],
  "constitution-day": [Flag, "17 May", "Holidays and celebrations"],
  halloween: [Ghost, "Halloween", "Holidays and celebrations"],
  valentine: [Heart, "Valentine’s Day", "Holidays and celebrations"],
  baking: [ChefHat, "Baking", "Food and drink"],
  bakery: [Croissant, "Bakery", "Food and drink"],
  vegetables: [Carrot, "Vegetables", "Food and drink"],
  seafood: [Fish, "Seafood", "Food and drink"],
  meat: [Beef, "Meat", "Food and drink"],
  dairy: [Milk, "Dairy", "Food and drink"],
  coffee: [Coffee, "Coffee", "Food and drink"],
  drinks: [CupSoda, "Drinks", "Food and drink"],
  sweets: [Candy, "Sweets", "Food and drink"],
  barbecue: [Flame, "Barbecue", "Food and drink"],
  picnic: [Sandwich, "Picnic", "Food and drink"],
  garden: [Shovel, "Gardening", "Home and garden"],
  plants: [Sprout, "Plants", "Home and garden"],
  flowers: [Flower2, "Flowers", "Home and garden"],
  renovation: [PaintRoller, "Renovation", "Home and garden"],
  furniture: [Sofa, "Furniture", "Home and garden"],
  cleaning: [SprayCan, "Cleaning supplies", "Home and garden"],
  electronics: [Cable, "Electronics", "Home and garden"],
  moving: [Boxes, "Moving house", "Home and garden"],
  car: [CarFront, "Car care", "Home and garden"],
  cabin: [Trees, "Cabin trip", "Trips and hobbies"],
  camping: [Tent, "Camping", "Trips and hobbies"],
  travel: [Luggage, "Travel", "Trips and hobbies"],
  hiking: [Backpack, "Hiking", "Trips and hobbies"],
  boating: [Sailboat, "Boating", "Trips and hobbies"],
  cycling: [Bike, "Cycling", "Trips and hobbies"],
  "winter-sports": [MountainSnow, "Winter sports", "Trips and hobbies"],
  sports: [Volleyball, "Ball sports", "Trips and hobbies"],
  crafts: [Palette, "Arts and crafts", "Trips and hobbies"],
  sewing: [Scissors, "Sewing", "Trips and hobbies"],
  school: [NotebookPen, "School supplies", "Trips and hobbies"],
  gaming: [Gamepad2, "Gaming", "Trips and hobbies"],
  music: [Guitar, "Music supplies", "Trips and hobbies"],
} as const;
const categories = [...new Set(shoppingListIcons.map(id => icons[id][2]))];

export function ShoppingListAvatar({ icon = "basket", small = false }: { icon?: IconName; small?: boolean }) {
  const [Icon] = icons[icon];
  return <span className={`member-avatar shopping-avatar${small ? " small" : ""}`} aria-hidden="true"><Icon /></span>;
}

export function ShoppingListIconPicker({ list, value = "basket", disabled, onChange }: {
  list: string; value?: IconName; disabled: boolean; onChange: (icon: IconName) => boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const [SelectedIcon, selectedLabel] = icons[value];
  const heading = t("Choose list icon for {list}", { list });
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button type="button" variant="outline" disabled={disabled} aria-label={heading}>
      <SelectedIcon aria-hidden="true" />{t("Choose list icon")}
    </Button></DialogTrigger>
    <DialogContent className="h-[min(85dvh,46rem)] max-w-2xl grid-rows-[auto_auto_minmax(0,1fr)]" onOpenAutoFocus={event => {
      event.preventDefault(); title.current?.focus();
    }}>
      <DialogHeader><DialogTitle ref={title} tabIndex={-1}>{heading}</DialogTitle>
        <DialogDescription>{t("Selected icon: {name}", { name: t(selectedLabel) })}</DialogDescription>
      </DialogHeader>
      <ShoppingIconOptions value={value} disabled={disabled} onSelect={id => { if (onChange(id)) setOpen(false); }} />
    </DialogContent>
  </Dialog>;
}

function ShoppingIconOptions({ value, disabled, onSelect }: { value: IconName; disabled: boolean; onSelect: (id: IconName) => void }) {
  const { t, locale } = useI18n();
  const [search, setSearch] = useState("");
  const query = search.trim().toLocaleLowerCase(locale);
  const matches = shoppingListIcons.filter(id => t(icons[id][1]).toLocaleLowerCase(locale).includes(query));
  return <>
    <Input type="search" aria-label={t("Search icons")} placeholder={t("Search icons")} value={search} onChange={event => setSearch(event.target.value)} />
    <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain p-1">
      {categories.map(category => {
        const options = matches.filter(id => icons[id][2] === category);
        return options.length > 0 && <fieldset key={category} disabled={disabled} className="min-w-0">
          <legend className="mb-2 text-sm font-medium">{t(category)}</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{options.map(id => {
            const [Icon, label] = icons[id];
            return <Button key={id} type="button" variant={value === id ? "default" : "outline"}
              className="relative min-h-16 flex-col whitespace-normal rounded-xl px-2 [&_svg]:size-5"
              aria-pressed={value === id} onClick={() => onSelect(id)}>
              <Icon aria-hidden="true" />{t(label)}
              {value === id && <Check className="absolute right-1.5 top-1.5 size-3.5!" aria-hidden="true" />}
            </Button>;
          })}</div>
        </fieldset>;
      })}
      {!matches.length && <p role="status" className="text-sm text-muted-foreground">{t("No matching icons")}</p>}
    </div>
  </>;
}
