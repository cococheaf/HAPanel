import { DesignContext } from './DesignContext';
import { useI18n } from '../i18n';
import { useContext, useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export function Modal({
  title,
  children,
  onClose,
  wide = false,
  message,
  onDismissMessage,
  className = '',
  id,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  message?: string;
  onDismissMessage?: () => void;
  className?: string;
  id?: string;
}) {
  const { t } = useI18n();
  const design = useContext(DesignContext);

  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    window.dispatchEvent(new Event('hapanel:modal'));
    return () => {
      dialog.close();
      window.dispatchEvent(new Event('hapanel:modal'));
    };
  }, []);
  // Dialogs must not inherit the dashboard's scale, clipping or container context.
  // Keep their hit targets in viewport coordinates, including in Safari.
  return createPortal(
    <dialog
      ref={ref}
      id={id}
      aria-labelledby={titleId}
      className={
        'modal ' + (design ? 'design-modal ' : '') + (wide ? 'wide-modal ' : '') + className
      }
      style={design?.style}
      data-color-mode={design?.scheme}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
      onTouchEnd={(event) => event.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-heading">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="icon-button modal-close"
          aria-label={t('common.close')}
          onClick={(event) => {
            event.preventDefault();
            onClose();
          }}
        >
          <X size={20} />
          <span>{t('common.close')}</span>
        </button>
      </div>
      {children}
      {message && (
        <div className="modal-notice" role="status">
          <span>{message}</span>
          <button
            className="icon-button"
            aria-label={t('common.dismiss')}
            onClick={onDismissMessage}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </dialog>,
    document.body,
  );
}
