import { useState, type ChangeEvent } from "react";

interface Props {
  value: number;
  onChange: (value: number) => void;
  mask?: boolean;
  fieldId: string;
}

function format(n: number, mask: boolean): string {
  return mask ? n.toLocaleString("pt-BR") : String(n);
}

export function NumberInput({ value, onChange, mask = false, fieldId }: Props) {
  const [text, setText] = useState(() => format(value, mask));

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "");
    const n = digits === "" ? 0 : Number(digits);
    setText(mask && digits !== "" ? n.toLocaleString("pt-BR") : digits);
    onChange(n);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      name={fieldId}
      id={fieldId}
      data-1p-ignore
      data-lpignore="true"
      value={text}
      onChange={handleChange}
    />
  );
}
