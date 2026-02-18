export default function Input({
  label,
  error,
  hint,
  inputRef,
  className = "",
  ...props
}) {
  return (
    <div className="uiField">
      {label ? <label className="uiLabel">{label}</label> : null}

      <div className={`uiControl ${error ? "uiControlError" : ""} ${className}`}>
        <input ref={inputRef} className="uiInput" {...props} />
      </div>

      {error ? <div className="uiError">{error}</div> : null}
      {!error && hint ? <div className="uiHint">{hint}</div> : null}
    </div>
  );
}