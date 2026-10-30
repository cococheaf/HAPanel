import { useI18n } from '../i18n';
import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Modal({
  title,
  children,
  onClose,
  wide = false,
  message,
  onDismissMessage,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  message?: string;
  onDismissMessage?: () => void;
}) {
  const { t } = useI18n();

  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'wide-modal' : ''}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button className="icon-button" aria-label={t('common.close')} onClick={onClose}>
          <X size={20} />
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
    </dialog>
  );
}
