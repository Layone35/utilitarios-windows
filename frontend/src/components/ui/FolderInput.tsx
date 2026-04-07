import { useState } from "react";
import { cn } from "../../lib/utils";
import { apiBrowseFolder } from "../../lib/api";
import { FolderOpen, Loader2 } from "lucide-react";

interface FolderInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon?: string;
  accentColor?: string;
}

/**
 * Input para caminho de pasta com botão de browse nativo.
 */
export function FolderInput({
  label,
  value,
  onChange,
  icon = "📂",
  accentColor = "text-primary",
}: FolderInputProps) {
  const [browsing, setBrowsing] = useState(false);

  const handleBrowse = async () => {
    try {
      setBrowsing(true);
      const res = await apiBrowseFolder();
      if (res.ok && res.path) {
        onChange(res.path);
      }
    } catch {
      // Backend offline ou erro
    } finally {
      setBrowsing(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <label
        className={cn(
          "text-sm font-medium flex items-center gap-1.5",
          accentColor,
        )}
      >
        <span>{icon}</span>
        {label}
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ex: D:\Videos\Origem"
          className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm
                     text-foreground placeholder:text-muted-foreground/50
                     focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                     transition-all"
        />
        <button
          onClick={handleBrowse}
          disabled={browsing}
          title="Selecionar pasta"
          className={cn(
            "shrink-0 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all",
            "border-border bg-secondary/50 hover:bg-secondary hover:border-primary/30",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            accentColor,
          )}
        >
          {browsing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FolderOpen className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">Procurar</span>
        </button>
      </div>
    </div>
  );
}
