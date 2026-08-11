import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/lib/i18n";

export function LanguageSwitcher() {
  const { language, setLanguage, languages } = useTranslation();
  return (
    <Select value={language} onValueChange={setLanguage}>
      <SelectTrigger className="h-8 w-[110px]" aria-label="Language">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {languages.map((l) => (
          <SelectItem key={l.code} value={l.code}>
            {l.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}