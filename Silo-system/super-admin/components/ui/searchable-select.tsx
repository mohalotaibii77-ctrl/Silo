'use client';

import { Fragment, useState, useRef, useEffect } from 'react';
import { Combobox, Transition, Portal } from '@headlessui/react';
import { Check, ChevronsUpDown } from 'lucide-react';

interface Option {
  id: string;
  name: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
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
  const [query, setQuery] = useState('');
  const buttonRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  const selectedOption = value ? options.find(opt => opt.id === value) : null;

  const filteredOptions =
    query === ''
      ? options
      : options.filter((option) => {
          return option.name.toLowerCase().includes(query.toLowerCase());
        });

  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  };

  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-medium text-zinc-500 mb-1">
          {label}
        </label>
      )}
      <Combobox 
        value={selectedOption} 
        onChange={(val: Option | null) => onChange(val?.id || '')} 
        disabled={disabled}
      >
        {({ open }) => {
          // Update position when opening
          if (open) {
            setTimeout(updatePosition, 0);
          }
          
          return (
            <div className="relative" ref={buttonRef}>
              <div className="relative w-full cursor-default overflow-hidden rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-left focus-within:ring-2 focus-within:ring-zinc-500/20 focus-within:border-zinc-500 sm:text-sm">
                <Combobox.Input
                  className="w-full border-none bg-transparent py-3 pl-4 pr-10 text-sm leading-5 text-zinc-900 dark:text-white focus:ring-0 outline-none"
                  displayValue={(option: Option | null) => option?.name || ''}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={placeholder}
                  autoComplete="off"
                />
                
                {/* Full-size button to toggle open state when clicking anywhere on the field (only when closed) */}
                {!open && (
                  <Combobox.Button className="absolute inset-0 w-full h-full bg-transparent cursor-pointer" />
                )}

                {/* Chevron button always visible */}
                <Combobox.Button className="absolute inset-y-0 right-0 flex items-center px-2">
                  <ChevronsUpDown
                    className="h-4 w-4 text-zinc-400 hover:text-zinc-500"
                    aria-hidden="true"
                  />
                </Combobox.Button>
              </div>
              
              <Portal>
                <Transition
                  as={Fragment}
                  leave="transition ease-in duration-100"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                  afterLeave={() => setQuery('')}
                >
                  <Combobox.Options 
                    className="fixed max-h-60 overflow-auto rounded-xl bg-white dark:bg-zinc-900 py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm border border-zinc-200 dark:border-zinc-700"
                    style={{
                      top: dropdownPosition.top,
                      left: dropdownPosition.left,
                      width: dropdownPosition.width,
                      zIndex: 9999,
                    }}
                  >
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
                            }`
                          }
                          value={option}
                        >
                          {({ selected, active }) => (
                            <>
                              <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                                {option.name}
                              </span>
                              {selected ? (
                                <span
                                  className={`absolute inset-y-0 left-0 flex items-center pl-3 ${
                                    active ? 'text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-400'
                                  }`}
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
              </Portal>
            </div>
          );
        }}
      </Combobox>
    </div>
  );
}

