import { useI18n } from '../i18n';
import { useEffect, useId, useRef, type ReactNode } from 'react';
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
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  message?: string;
  onDismissMessage?: () => void;
  className?: string;
}) {
  const { t } = useI18n();

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
      aria-labelledby={titleId}
      className={'modal ' + (wide ? 'wide-modal ' : '') + className}
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
          onClick={onClose}
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
