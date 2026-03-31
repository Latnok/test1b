type SearchBarProps = {
  label: string;
  onChange: (value: string) => void;
  value: string;
};

export const SearchBar = ({ label, onChange, value }: SearchBarProps) => {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        inputMode="numeric"
        onChange={(event) => onChange(event.target.value.replace(/\D/g, ""))}
        placeholder="Например, 123"
        value={value}
      />
    </label>
  );
};
