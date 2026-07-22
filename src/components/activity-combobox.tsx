import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ACTIVITIES } from "@/lib/activities";

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
};

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function ActivityCombobox({ value, onChange, placeholder = "Choisir une activité" }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return ACTIVITIES;
    return ACTIVITIES.filter((a) => normalize(a).includes(q));
  }, [query]);

  const showCreate =
    query.trim().length > 0 &&
    !ACTIVITIES.some((a) => normalize(a) === normalize(query.trim()));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
        sideOffset={4}
      >
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Tapez pour filtrer (ex. p…)"
              className="h-10"
            />
          </div>
          <CommandList className="max-h-72">
            <CommandEmpty>Aucune activité trouvée.</CommandEmpty>
            <CommandGroup heading={`${filtered.length} résultat${filtered.length > 1 ? "s" : ""}`}>
              {filtered.map((a) => {
                const selected = a === value;
                return (
                  <CommandItem
                    key={a}
                    value={a}
                    onSelect={() => {
                      onChange(a);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                    {a}
                  </CommandItem>
                );
              })}
              {showCreate && (
                <CommandItem
                  value={`__create__${query}`}
                  onSelect={() => {
                    onChange(query.trim());
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <Check className="mr-2 h-4 w-4 opacity-0" />
                  Utiliser « {query.trim()} »
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}