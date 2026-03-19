import { useEffect, useState } from "react";
import { categoriesApi, type Category } from "../api/client";

interface Props {
  accountId: string;
  value: string;
  onChange: (value: string) => void;
}

export default function CategorySelect({ accountId, value, onChange }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!accountId) return;
    setLoading(true);
    categoriesApi
      .list(accountId)
      .then((res) => setCategories(res.categories))
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  }, [accountId]);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={loading || !accountId}
      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
    >
      <option value="">카테고리 선택</option>
      {categories.map((cat) => (
        <option key={cat.id} value={cat.name}>
          {cat.name}
        </option>
      ))}
    </select>
  );
}
