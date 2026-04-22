import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { useEffect } from "react";
import {
  Bold, Italic, Strikethrough, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Undo2, Redo2, Code, Link as LinkIcon,
  Image as ImageIcon, AlignLeft, AlignCenter, AlignRight, Minus,
} from "lucide-react";

const BTN_BASE =
  "inline-flex items-center justify-center h-8 w-8 rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))] transition-colors";
const BTN_ACTIVE =
  "bg-[hsl(var(--accent))]/15 text-[hsl(var(--accent))] ring-1 ring-[hsl(var(--accent))]/40";

function TbButton({ active, onClick, children, title, testid }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      data-testid={testid}
      className={`${BTN_BASE} ${active ? BTN_ACTIVE : ""}`}
    >
      {children}
    </button>
  );
}

/**
 * Rich-Text editor built on TipTap for blog authoring.
 * Emits HTML via `onChange(html)`.
 */
export function RichTextEditor({ value = "", onChange, placeholder = "Schreib los …" }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: {},
      }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } }),
      Image.configure({ inline: false, HTMLAttributes: { class: "rounded-md max-w-full" } }),
      Placeholder.configure({ placeholder }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
  });

  useEffect(() => {
    // When parent replaces value (e.g. loading existing post), sync without re-creating editor
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "", false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) {
    return <div className="h-48 rounded-md border bg-[hsl(var(--muted))]/30 animate-pulse" />;
  }

  const addLink = () => {
    const prev = editor.getAttributes("link").href;
    const url = window.prompt("Link-URL (leer = entfernen)", prev || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };
  const addImage = () => {
    const url = window.prompt("Bild-URL", "https://");
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  };

  return (
    <div className="rounded-[var(--radius-md)] border border-[hsl(var(--border))] bg-[hsl(var(--card))]" data-testid="rich-text-editor">
      <div className="flex flex-wrap items-center gap-0.5 p-1.5 border-b border-[hsl(var(--border))]">
        <TbButton title="Rückgängig" onClick={() => editor.chain().focus().undo().run()} testid="tiptap-undo"><Undo2 className="h-4 w-4" /></TbButton>
        <TbButton title="Wiederherstellen" onClick={() => editor.chain().focus().redo().run()} testid="tiptap-redo"><Redo2 className="h-4 w-4" /></TbButton>
        <span className="mx-1 h-5 w-px bg-[hsl(var(--border))]" />
        <TbButton title="Überschrift 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} testid="tiptap-h1"><Heading1 className="h-4 w-4" /></TbButton>
        <TbButton title="Überschrift 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} testid="tiptap-h2"><Heading2 className="h-4 w-4" /></TbButton>
        <TbButton title="Überschrift 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="h-4 w-4" /></TbButton>
        <span className="mx-1 h-5 w-px bg-[hsl(var(--border))]" />
        <TbButton title="Fett" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} testid="tiptap-bold"><Bold className="h-4 w-4" /></TbButton>
        <TbButton title="Kursiv" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} testid="tiptap-italic"><Italic className="h-4 w-4" /></TbButton>
        <TbButton title="Durchgestrichen" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></TbButton>
        <TbButton title="Inline-Code" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}><Code className="h-4 w-4" /></TbButton>
        <span className="mx-1 h-5 w-px bg-[hsl(var(--border))]" />
        <TbButton title="Aufzählung" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></TbButton>
        <TbButton title="Nummerierte Liste" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></TbButton>
        <TbButton title="Zitat" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-4 w-4" /></TbButton>
        <TbButton title="Horizontale Linie" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus className="h-4 w-4" /></TbButton>
        <span className="mx-1 h-5 w-px bg-[hsl(var(--border))]" />
        <TbButton title="Links ausrichten" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft className="h-4 w-4" /></TbButton>
        <TbButton title="Zentriert" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter className="h-4 w-4" /></TbButton>
        <TbButton title="Rechts" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}><AlignRight className="h-4 w-4" /></TbButton>
        <span className="mx-1 h-5 w-px bg-[hsl(var(--border))]" />
        <TbButton title="Link" active={editor.isActive("link")} onClick={addLink} testid="tiptap-link"><LinkIcon className="h-4 w-4" /></TbButton>
        <TbButton title="Bild per URL" onClick={addImage} testid="tiptap-image"><ImageIcon className="h-4 w-4" /></TbButton>
      </div>
      <EditorContent
        editor={editor}
        className="prose prose-sm dark:prose-invert max-w-none px-4 py-3 min-h-[320px] focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[300px]"
        data-testid="rich-text-editor-area"
      />
    </div>
  );
}

export default RichTextEditor;
