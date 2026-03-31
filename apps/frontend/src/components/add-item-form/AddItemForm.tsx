import { useState } from "react";

type AddItemFormProps = {
  busy: boolean;
  onSubmit: (value: string) => Promise<void>;
};

export const AddItemForm = ({ busy, onSubmit }: AddItemFormProps) => {
  const [value, setValue] = useState("");

  return (
    <form
      className="add-form"
      onSubmit={async (event) => {
        event.preventDefault();
        await onSubmit(value);
        setValue("");
      }}
    >
      <label className="field">
        <span>Добавить ID</span>
        <input
          inputMode="numeric"
          onChange={(event) => setValue(event.target.value.replace(/\D/g, ""))}
          placeholder="Новый ID"
          value={value}
        />
      </label>
      <button className="primary-button" disabled={busy || !value} type="submit">
        {busy ? "Отправляем в очередь..." : "Добавить"}
      </button>
    </form>
  );
};
