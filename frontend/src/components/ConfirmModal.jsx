import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmModal({ open, title, message, confirmLabel = 'Delete', confirmClass = 'btn-danger', onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-box max-w-sm animate-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-[#1a0808] border border-[#3a1515] flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={16} className="text-[#f87171]" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-[#dce8df] mb-1">{title}</h3>
            <p className="text-sm text-[#5a7a62]">{message}</p>
          </div>
          <button onClick={onCancel} className="btn-icon flex-shrink-0"><X size={15} /></button>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="btn-secondary">Cancel</button>
          <button onClick={onConfirm} className={confirmClass}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
