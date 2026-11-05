import {
  Children,
  Fragment,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { useI18n } from '../i18n';
import { Modal } from '../ui/Modal';
import { filterOptions, nextOption, type SelectOption } from './select-options';

const PAGE_SIZE = 80;
function plainText(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) =>
      isValidElement<{ children?: ReactNode }>(child)
        ? plainText(child.props.children)
        : String(child),
    )
    .join('');
}
function readOptions(children: ReactNode, group?: string): SelectOption[] {
  return Children.toArray(children).flatMap((node) => {
    if (
      !isValidElement<{
        value?: string | number;
        children?: ReactNode;
        disabled?: boolean;
        label?: string;
        'data-description'?: string;
      }>(node)
    )
      return [];
    if (node.type === Fragment || node.type === 'optgroup')
      return readOptions(node.props.children, node.props.label ?? group).map((option) => ({
        ...option,
        disabled: node.props.disabled || option.disabled,
      }));
    if (node.type !== 'option') return [];
    const label = node.props.label ?? plainText(node.props.children),
      value = String(node.props.value ?? label);
    return [
      {
        value,
        label,
        group,
        disabled: node.props.disabled,
        description:
          node.props['data-description'] ?? (/^[a-z_]+\./.test(value) ? value : undefined),
      },
    ];
  });
}

/** A select-only combobox with a searchable dialog popup (WAI-ARIA APG). */
export function SearchSelect({
  value,
  onValueChange,
  children,
  disabled,
  id,
  className = '',
  caption,
  'aria-label': label,
  'aria-labelledby': labelledBy,
}: {
  value?: string | number;
  onValueChange: (value: string) => void;
  children: ReactNode;
  disabled?: boolean;
  id?: string;
  className?: string;
  caption?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}) {
  const { t } = useI18n();
  const generated = useId(),
    dialogId = generated + '-dialog',
    listId = generated + '-list';
  const trigger = useRef<HTMLButtonElement>(null),
    list = useRef<HTMLDivElement>(null),
    searchInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(''),
    [active, setActive] = useState(-1),
    [limit, setLimit] = useState(PAGE_SIZE),
    [title, setTitle] = useState(label ?? t('studio.choose'));
  const options = useMemo(() => readOptions(children), [children]),
    selected = options.find((option) => option.value === String(value ?? '')),
    matches = useMemo(
      () => filterOptions(options, query, String(value ?? '')),
      [options, query, value],
    ),
    shown = matches.slice(0, limit);
  useEffect(() => {
    if (open) {
      setActive(nextOption(matches, -1, 1));
      setLimit(PAGE_SIZE);
      searchInput.current?.focus({ preventScroll: true });
    }
  }, [query, open]);
  useEffect(() => {
    if (open && active >= 0) {
      setLimit((previous) => Math.max(previous, Math.ceil((active + 1) / PAGE_SIZE) * PAGE_SIZE));
      const frame = requestAnimationFrame(() =>
        list.current
          ?.querySelector(`[data-index="${active}"]`)
          ?.scrollIntoView({ block: 'nearest' }),
      );
      return () => cancelAnimationFrame(frame);
    }
  }, [active, open]);
  const show = () => {
    if (disabled) return;
    const element = labelledBy ? document.getElementById(labelledBy) : null;
    setTitle(label ?? element?.textContent?.trim() ?? t('studio.choose'));
    setQuery('');
    setLimit(PAGE_SIZE);
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
  };
  const choose = (option?: SelectOption) => {
    if (!option || option.disabled) return;
    close();
    if (option.value !== String(value ?? '')) onValueChange(option.value);
  };
  return (
    <>
      <button
        ref={trigger}
        id={id}
        type="button"
        role="combobox"
        aria-label={label}
        aria-labelledby={labelledBy}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        disabled={disabled}
        title={
          selected ? [selected.label, selected.description].filter(Boolean).join(' · ') : undefined
        }
        className={`search-select ${className}`}
        onClick={show}
        onKeyDown={(event) => {
          if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
            event.preventDefault();
            event.stopPropagation();
            show();
          }
        }}
      >
        <span>
          {caption && <small>{caption}</small>}
          {selected?.label ?? t('studio.choose')}
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <Modal title={title} onClose={close} className="select-dialog" id={dialogId}>
          <div className="select-search">
            <Search size={18} aria-hidden="true" />
            <input
              ref={searchInput}
              autoFocus
              role="combobox"
              aria-label={t('studio.searchOptions')}
              aria-autocomplete="list"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={
                active >= 0 && active < shown.length ? `${listId}-${active}` : undefined
              }
              placeholder={t('studio.searchOptions')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === 'Escape') {
                  event.preventDefault();
                  close();
                } else if (event.key === 'Enter') {
                  event.preventDefault();
                  choose(matches[active]);
                } else if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
                  event.preventDefault();
                  setActive(nextOption(matches, active, event.key === 'ArrowDown' ? 1 : -1));
                }
              }}
            />
            {query && (
              <button
                type="button"
                className="icon-button"
                aria-label={t('studio.clearSearch')}
                onClick={() => setQuery('')}
              >
                <X size={17} />
              </button>
            )}
          </div>
          <p className="select-result-count" role="status">
            {t('studio.resultCount', { count: matches.length })}
          </p>
          <div ref={list} id={listId} className="select-options" role="listbox" aria-label={title}>
            {shown.map((option, index) => (
              <div
                id={`${listId}-${index}`}
                key={option.value}
                role="option"
                aria-selected={option.value === String(value ?? '')}
                aria-disabled={option.disabled || undefined}
                data-index={index}
                data-active={index === active}
                onPointerMove={() => setActive(index)}
                onClick={() => choose(option)}
              >
                <span>
                  <strong>{option.label}</strong>
                  {(option.description || option.group) && (
                    <small>{[option.group, option.description].filter(Boolean).join(' · ')}</small>
                  )}
                </span>
                {option.value === String(value ?? '') && <Check size={18} aria-hidden="true" />}
              </div>
            ))}
            {!matches.length && <p className="select-empty">{t('studio.noOptions')}</p>}
          </div>
          {shown.length < matches.length && (
            <button
              type="button"
              className="button full-width"
              onClick={() => setLimit(limit + PAGE_SIZE)}
            >
              {t('studio.moreOptions', { count: matches.length - shown.length })}
            </button>
          )}
          <p className="select-keyboard-hint">{t('studio.keyboardHint')}</p>
        </Modal>
      )}
    </>
  );
}
