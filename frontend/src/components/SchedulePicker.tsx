interface Props {
  value: string;
  onChange: (value: string) => void;
}

export default function SchedulePicker({ value, onChange }: Props) {
  return (
    <input
      type="datetime-local"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      min={new Date().toISOString().slice(0, 16)}
      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
    />
  );
}
