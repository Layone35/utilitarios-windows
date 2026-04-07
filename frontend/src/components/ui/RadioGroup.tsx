import { cn } from "../../lib/utils";

interface RadioGroupProps<T extends string> {
  label: string;
  options: { label: string; value: T; color?: string; desc?: string }[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * Grupo de radio buttons estilizado.
 */
export function RadioGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: RadioGroupProps<T>) {
  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <div className="space-y-1">
        {options.map((opt) => (
          <label
            key={opt.value}
            className={cn(
              "flex items-center gap-2.5 cursor-pointer rounded-md px-2 py-1.5 text-sm transition-colors",
              value === opt.value
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <input
              type="radio"
              name={label}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            <div
              className={cn(
                "h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center transition-colors",
                value === opt.value
                  ? "border-primary"
                  : "border-muted-foreground/40",
              )}
            >
              {value === opt.value && (
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </div>
            <span className={opt.color}>{opt.label}</span>
            {opt.desc && (
              <span className="text-xs text-muted-foreground/60 ml-1">
                — {opt.desc}
              </span>
            )}
          </label>
        ))}
      </div>
    </div>
  );
}
