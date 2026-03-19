import { useState, type KeyboardEvent } from "react";

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
}

export default function TagInput({ tags, onChange }: Props) {
  const [input, setInput] = useState("");

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const tag = input.trim();
      if (tag && !tags.includes(tag)) {
        onChange([...tags, tag]);
      }
      setInput("");
    } else if (e.key === "Backspace" && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  function removeTag(idx: number) {
    onChange(tags.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-gray-300 bg-white p-2 dark:border-gray-600 dark:bg-gray-800">
      {tags.map((tag, i) => (
        <span
          key={i}
          className="flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-sm text-blue-700 dark:bg-blue-900 dark:text-blue-300"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(i)}
            className="ml-0.5 text-blue-500 hover:text-blue-700"
          >
            &times;
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? "태그를 입력하고 Enter" : ""}
        className="flex-1 bg-transparent text-sm outline-none min-w-[100px] dark:text-white"
      />
    </div>
  );
}
