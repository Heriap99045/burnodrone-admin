"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExtension from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { uploadImage } from "@/lib/admin-api";
import { docToMarkdown, markdownToDoc, type DocNode } from "@/lib/editor-markdown";

// Link biasa ditambah atribut "title". Judul "affiliate" menandai link afiliasi.
const MarkedLink = LinkExtension.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      title: { default: null },
    };
  },
});

const toolbarBtn = (active: boolean) =>
  `px-2.5 py-1.5 rounded-md border text-xs font-semibold transition ${
    active
      ? "bg-blue-600 border-blue-500 text-white"
      : "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
  }`;

// Editor visual seperti Word: hasil tulisan disimpan sebagai Markdown.
export function RichEditor({
  value,
  onChange,
  onError,
}: {
  value: string;
  onChange: (markdown: string) => void;
  onError?: (message: string) => void;
}) {
  const [, setTick] = useState(0);
  const [uploading, setUploading] = useState(false);
  const lastEmitted = useRef(value);
  const onChangeRef = useRef(onChange);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        strike: false,
        hardBreak: false,
      }),
      MarkedLink.configure({
        openOnClick: false,
        autolink: false,
        HTMLAttributes: { rel: "noopener nofollow", target: "_blank" },
      }),
      Image.configure({ inline: true }),
      Placeholder.configure({
        placeholder: "Mulai menulis artikel di sini. Anda juga bisa menempelkan teks dari Word atau Google Docs.",
      }),
    ],
    content: markdownToDoc(value) as JSONContent,
    editorProps: {
      attributes: { class: "rich-editor-content", "aria-label": "Isi artikel" },
    },
    onUpdate: ({ editor: ed }) => {
      const markdown = docToMarkdown(ed.getJSON() as DocNode);
      lastEmitted.current = markdown;
      onChangeRef.current(markdown);
    },
    onTransaction: () => setTick((t) => t + 1),
  });

  // Jika isi diganti dari luar (mis. membuka artikel lain), muat ulang ke editor.
  useEffect(() => {
    if (!editor) return;
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      editor.commands.setContent(markdownToDoc(value) as JSONContent);
    }
  }, [value, editor]);

  if (!editor) {
    return (
      <div className="min-h-[360px] rounded-lg border border-slate-700 bg-slate-900" />
    );
  }

  const style = editor.isActive("heading", { level: 2 })
    ? "h2"
    : editor.isActive("heading", { level: 3 })
      ? "h3"
      : editor.isActive("heading", { level: 4 })
        ? "h4"
        : "p";

  function setStyle(next: string) {
    const chain = editor!.chain().focus();
    if (next === "p") chain.setParagraph().run();
    else chain.setHeading({ level: Number(next.slice(1)) as 2 | 3 | 4 }).run();
  }

  function askUrl(label: string, initial: string): string | null {
    const raw = window.prompt(label, initial);
    if (raw === null) return null;
    const url = raw.trim();
    if (url === "") return "";
    if (!/^https?:\/\//i.test(url)) {
      window.alert("Alamat harus diawali http:// atau https://");
      return null;
    }
    return url;
  }

  function applyLink(affiliate: boolean) {
    const current = (editor!.getAttributes("link").href as string | undefined) ?? "";
    const url = askUrl(
      affiliate
        ? "Tempel link afiliasi Shopee/Tokopedia (https://...)"
        : "Alamat link (https://...). Kosongkan untuk menghapus link.",
      current,
    );
    if (url === null) return;
    if (url === "") {
      editor!.chain().focus().extendMarkRange("link").unsetMark("link").run();
      return;
    }
    const attrs = { href: url, title: affiliate ? "affiliate" : null };
    if (editor!.state.selection.empty && !editor!.isActive("link")) {
      editor!
        .chain()
        .focus()
        .insertContent({
          type: "text",
          text: affiliate ? "Lihat produk" : url,
          marks: [{ type: "link", attrs }],
        })
        .run();
    } else {
      editor!.chain().focus().extendMarkRange("link").setMark("link", attrs).run();
    }
  }

  async function onPickImage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await uploadImage(file);
      const alt = window.prompt("Deskripsi gambar (untuk Google dan pembaca layar)", "") ?? "";
      editor!.chain().focus().setImage({ src: url, alt }).run();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Gagal mengunggah gambar.");
    } finally {
      setUploading(false);
    }
  }

  const keep = (e: React.MouseEvent) => e.preventDefault(); // jaga seleksi teks saat klik tombol

  return (
    <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-700 bg-slate-800/60 p-2">
        <button type="button" onMouseDown={keep} onClick={() => editor.chain().focus().undo().run()} className={toolbarBtn(false)} title="Urungkan (Ctrl+Z)">
          Urungkan
        </button>
        <button type="button" onMouseDown={keep} onClick={() => editor.chain().focus().redo().run()} className={toolbarBtn(false)} title="Ulangi (Ctrl+Y)">
          Ulangi
        </button>
        <span className="mx-1 h-5 w-px bg-slate-700" />

        <select
          value={style}
          onChange={(e) => setStyle(e.target.value)}
          className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs font-semibold text-slate-200"
          aria-label="Gaya paragraf"
        >
          <option value="p">Paragraf biasa</option>
          <option value="h2">Judul bagian</option>
          <option value="h3">Sub judul</option>
          <option value="h4">Sub judul kecil</option>
        </select>
        <span className="mx-1 h-5 w-px bg-slate-700" />

        <button type="button" onMouseDown={keep} onClick={() => editor.chain().focus().toggleBold().run()} className={`${toolbarBtn(editor.isActive("bold"))} font-extrabold`} title="Tebal (Ctrl+B)">
          B
        </button>
        <button type="button" onMouseDown={keep} onClick={() => editor.chain().focus().toggleItalic().run()} className={`${toolbarBtn(editor.isActive("italic"))} italic`} title="Miring (Ctrl+I)">
          I
        </button>
        <button type="button" onMouseDown={keep} onClick={() => editor.chain().focus().toggleCode().run()} className={`${toolbarBtn(editor.isActive("code"))} font-mono`} title="Kode singkat">
          {"</>"}
        </button>
        <span className="mx-1 h-5 w-px bg-slate-700" />

        <button type="button" onMouseDown={keep} onClick={() => editor.chain().focus().toggleBulletList().run()} className={toolbarBtn(editor.isActive("bulletList"))} title="Daftar berpoin">
          Daftar poin
        </button>
        <button type="button" onMouseDown={keep} onClick={() => editor.chain().focus().toggleOrderedList().run()} className={toolbarBtn(editor.isActive("orderedList"))} title="Daftar bernomor">
          Daftar nomor
        </button>
        <button type="button" onMouseDown={keep} onClick={() => editor.chain().focus().toggleBlockquote().run()} className={toolbarBtn(editor.isActive("blockquote"))} title="Kutipan">
          Kutipan
        </button>
        <button type="button" onMouseDown={keep} onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={toolbarBtn(editor.isActive("codeBlock"))} title="Blok kode">
          Blok kode
        </button>
        <button type="button" onMouseDown={keep} onClick={() => editor.chain().focus().setHorizontalRule().run()} className={toolbarBtn(false)} title="Garis pemisah">
          Garis
        </button>
        <span className="mx-1 h-5 w-px bg-slate-700" />

        <button type="button" onMouseDown={keep} onClick={() => applyLink(false)} className={toolbarBtn(editor.isActive("link") && editor.getAttributes("link").title !== "affiliate")} title="Sisipkan atau ubah link">
          Link
        </button>
        <button type="button" onMouseDown={keep} onClick={() => applyLink(true)} className={`${toolbarBtn(editor.isActive("link") && editor.getAttributes("link").title === "affiliate")} !border-emerald-600/70`} title="Sisipkan link afiliasi Shopee/Tokopedia">
          Link afiliasi
        </button>
        <button type="button" disabled={uploading} onMouseDown={keep} onClick={() => fileRef.current?.click()} className={toolbarBtn(false)} title="Sisipkan gambar">
          {uploading ? "Mengunggah..." : "Gambar"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={onPickImage}
        />
        <button type="button" onMouseDown={keep} onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} className={toolbarBtn(false)} title="Hapus semua format pada teks terpilih">
          Hapus format
        </button>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}
