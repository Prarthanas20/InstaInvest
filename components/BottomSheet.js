"use client";

import { useEffect } from "react";
import { Close } from "./icons";

// Mobile-first bottom sheet — used for contextual education (Market vs Limit,
// NSE vs BSE), the fee explainer, Add Funds and the Review Order modal.
export default function BottomSheet({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={title || "Sheet"}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          {title ? <h3>{title}</h3> : <span />}
          <button className="icon-btn" onClick={onClose} aria-label="Close sheet">
            <Close />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
