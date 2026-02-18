import React from "react";

export default function Input({
  label,
  hint,
  error,
  className = "",
  id,
  ...props
}) {
  const inputId = id || props.name;

  return (
    <div className={`uiField ${className}`}>
      {label ? (
        <label className="uiLabel" htmlFor={inputId}>
          {label}
          {props.required ? <span className="uiReq"> *</span> : null}
        </label>
      ) : null}

      <div className={`uiControl ${error ? "uiControlError" : ""}`}>
        {props.as === "select" ? (
          <select id={inputId} className="uiInput" {...props} />
        ) : (
          <input id={inputId} className="uiInput" {...props} />
        )}
      </div>

      {error ? <div className="uiError">{error}</div> : null}
      {hint && !error ? <div className="uiHint">{hint}</div> : null}
    </div>
  );
}