import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";

interface Props {
  content: string;
  onChange: (html: string) => void;
}

export default function RichEditor({ content, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: "본문을 작성하세요..." }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && content && editor.getHTML() !== content) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div className="rounded-lg border border-gray-300 dark:border-gray-600">
      {/* 툴바 */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200 p-2 dark:border-gray-700">
        <ToolBtn
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          label="B"
          className="font-bold"
        />
        <ToolBtn
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          label="I"
          className="italic"
        />
        <ToolBtn
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          label="S"
          className="line-through"
        />
        <span className="mx-1 border-l border-gray-300 dark:border-gray-600" />
        <ToolBtn
          active={editor.isActive("heading", { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          label="H2"
        />
        <ToolBtn
          active={editor.isActive("heading", { level: 3 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          label="H3"
        />
        <span className="mx-1 border-l border-gray-300 dark:border-gray-600" />
        <ToolBtn
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          label="UL"
        />
        <ToolBtn
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          label="OL"
        />
        <ToolBtn
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          label="Q"
        />
        <span className="mx-1 border-l border-gray-300 dark:border-gray-600" />
        <ToolBtn
          onClick={() => {
            const url = window.prompt("링크 URL:");
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }}
          label="Link"
        />
        <ToolBtn
          onClick={() => {
            const url = window.prompt("이미지 URL:");
            if (url) editor.chain().focus().setImage({ src: url }).run();
          }}
          label="Img"
        />
      </div>

      {/* 에디터 본문 */}
      <EditorContent
        editor={editor}
        className="prose max-w-none bg-white dark:bg-gray-800 dark:text-white"
      />
    </div>
  );
}

function ToolBtn({
  active,
  onClick,
  label,
  className,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-1 text-xs ${className || ""} ${
        active
          ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
          : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
      }`}
    >
      {label}
    </button>
  );
}
