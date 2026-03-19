import { Routes, Route, NavLink } from "react-router-dom";
import { useState } from "react";
import Dashboard from "./pages/Dashboard";
import PostList from "./pages/PostList";
import PostEditor from "./pages/PostEditor";
import Templates from "./pages/Templates";
import Accounts from "./pages/Accounts";
import Logs from "./pages/Logs";

const navItems = [
  { to: "/", label: "대시보드" },
  { to: "/posts", label: "글 관리" },
  { to: "/templates", label: "템플릿" },
  { to: "/accounts", label: "계정" },
  { to: "/logs", label: "로그" },
];

export default function App() {
  const [dark, setDark] = useState(false);

  return (
    <div className={dark ? "dark" : ""}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* 사이드바 */}
        <aside className="fixed left-0 top-0 z-40 h-screen w-56 border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="flex h-14 items-center justify-between px-4">
            <span className="text-lg font-bold text-gray-800 dark:text-white">
              Blog Auto
            </span>
            <button
              onClick={() => setDark(!dark)}
              className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              {dark ? "L" : "D"}
            </button>
          </div>
          <nav className="px-3 py-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2 text-sm font-medium mb-1 ${
                    isActive
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                      : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* 메인 콘텐츠 */}
        <main className="ml-56 p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/posts" element={<PostList />} />
            <Route path="/posts/new" element={<PostEditor />} />
            <Route path="/posts/:id/edit" element={<PostEditor />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/logs" element={<Logs />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
