import { Fragment, useState, useEffect } from 'react';
import { Combobox, Transition } from '@headlessui/react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { useLanguage } from '@/lib/language-context';

interface Option {
  id: number | string;
  name: string;
  secondaryText?: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: number | string | null;
  onChange: (value: any) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  label,
  placeholder = 'Select...',
  className = '',
  disabled = false
}: SearchableSelectProps) {
  const { isRTL } = useLanguage();
  const [query, setQuery] = useState('');

  const selectedOption = value ? options.find(opt => opt.id === value) : null;

  const filteredOptions =
    query === ''
      ? options
      : options.filter((option) => {
          return (
            option.name.toLowerCase().includes(query.toLowerCase()) ||
            (option.secondaryText && option.secondaryText.toLowerCase().includes(query.toLowerCase()))
          );
        });

  return (
    <div className={className}>
      {label && (
        <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 ${isRTL ? 'text-right' : ''}`}>
          {label}
        </label>
      )}
      <Combobox value={selectedOption} onChange={(val) => onChange(val?.id || null)} disabled={disabled}>
        {({ open }) => (
          <div className="relative mt-1">
            <div className="relative w-full cursor-default overflow-hidden rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-left focus-within:ring-2 focus-within:ring-zinc-500/20 focus-within:border-zinc-500 sm:text-sm">
              <Combobox.Input
                className={`w-full border-none bg-transparent py-3 pl-4 pr-10 text-sm leading-5 text-zinc-900 dark:text-white focus:ring-0 outline-none ${isRTL ? 'text-right pr-4 pl-10' : ''}`}
                displayValue={(option: Option) => option?.name || ''}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={placeholder}
                autoComplete="off"
              />
              
              {/* Full-size button to toggle open state when clicking anywhere on the field (only when closed) */}
              {!open && (
                <Combobox.Button className="absolute inset-0 w-full h-full bg-transparent cursor-pointer" />
              )}

              {/* Chevron button always visible */}
              <Combobox.Button className={`absolute inset-y-0 flex items-center px-2 ${isRTL ? 'left-0' : 'right-0'}`}>
                <ChevronsUpDown
                  className="h-4 w-4 text-zinc-400 hover:text-zinc-500"
                  aria-hidden="true"
                />
              </Combobox.Button>
            </div>
            <Transition
              as={Fragment}
              leave="transition ease-in duration-100"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
              afterLeave={() => setQuery('')}
            >
              <Combobox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded-xl bg-white dark:bg-zinc-900 py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm z-50 border border-zinc-200 dark:border-zinc-700">
                {filteredOptions.length === 0 && query !== '' ? (
                  <div className="relative cursor-default select-none px-4 py-2 text-zinc-500 dark:text-zinc-400">
                    Nothing found.
                  </div>
                ) : (
                  filteredOptions.map((option) => (
                    <Combobox.Option
                      key={option.id}
                      className={({ active }) =>
                        `relative cursor-default select-none py-2.5 pl-10 pr-4 ${
                          active ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white' : 'text-zinc-900 dark:text-zinc-100'
                        } ${isRTL ? 'pr-10 pl-4 text-right' : ''}`
                      }
                      value={option}
                    >
                      {({ selected, active }) => (
                        <>
                          <div className={`flex flex-col ${isRTL ? 'items-end' : 'items-start'}`}>
                            <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                              {option.name}
                            </span>
                            {option.secondaryText && (
                              <span className={`block truncate text-xs ${active ? 'text-zinc-600 dark:text-zinc-300' : 'text-zinc-500 dark:text-zinc-400'}`}>
                                {option.secondaryText}
                              </span>
                            )}
                          </div>
                          {selected ? (
                            <span
                              className={`absolute inset-y-0 flex items-center pl-3 ${
                                active ? 'text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-400'
                              } ${isRTL ? 'right-0 pr-3 pl-0' : 'left-0'}`}
                            >
                              <Check className="h-4 w-4" aria-hidden="true" />
                            </span>
                          ) : null}
                        </>
                      )}
                    </Combobox.Option>
                  ))
                )}
              </Combobox.Options>
            </Transition>
          </div>
        )}
      </Combobox>
    </div>
  );
}
