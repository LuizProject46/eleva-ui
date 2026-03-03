import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

export interface AsyncSearchOption {
  id: string;
  label: string;
}

export interface AsyncSearchComboboxProps {
  value: AsyncSearchOption | null;
  onValueChange: (value: AsyncSearchOption | null) => void;
  onSearch: (query: string) => Promise<AsyncSearchOption[]>;
  placeholder?: string;
  disabled?: boolean;
  emptyMessage?: string;
  clearLabel?: string;
  searchPlaceholder?: string;
  className?: string;
}

const DEBOUNCE_MS = 350;

export function AsyncSearchCombobox({
  value,
  onValueChange,
  onSearch,
  placeholder = 'Selecione...',
  disabled = false,
  emptyMessage = 'Nenhum encontrado.',
  clearLabel = 'Limpar seleção',
  searchPlaceholder = 'Buscar...',
  className,
}: AsyncSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebouncedValue(searchQuery, DEBOUNCE_MS);
  const [searchResults, setSearchResults] = useState<AsyncSearchOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const runSearch = useCallback(async () => {
    setIsLoading(true);
    try {
      const results = await onSearch(debouncedQuery);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedQuery, onSearch]);

  useEffect(() => {
    if (!open) return;
    void runSearch();
  }, [open, runSearch]);

  const displayValue = value?.label ?? placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={className ?? 'max-w-xs w-full justify-between font-normal hover:bg-muted/30 transition-colors hover:text-accent'}
        >
          <span className="truncate">{displayValue}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            className="h-9"
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {isLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Carregando...</div>
            ) : (
              <>
                <CommandEmpty>{emptyMessage}</CommandEmpty>
                <CommandGroup>
                  {value && (
                    <CommandItem
                      value="__clear__"
                      onSelect={() => {
                        onValueChange(null);
                        setOpen(false);
                      }}
                    >
                      {clearLabel}
                    </CommandItem>
                  )}
                  {searchResults.map((option) => (
                    <CommandItem
                      key={option.id}
                      value={option.id}
                      onSelect={() => {
                        onValueChange(option);
                        setOpen(false);
                      }}
                    >
                      <Check className={value?.id === option.id ? 'mr-2 h-4 w-4 opacity-100' : 'mr-2 h-4 w-4 opacity-0'} />
                      {option.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
