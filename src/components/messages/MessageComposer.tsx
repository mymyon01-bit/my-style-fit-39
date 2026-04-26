import { useRef, useState, KeyboardEvent } from "react";
import { Send, Image as ImageIcon, Paperclip, X, Loader2, Camera, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import MentionAutocomplete, { type MentionUser } from "./MentionAutocomplete";
import type { ChatAttachment } from "./MessageBubble";

interface Props {
  onSend: (content: string, taggedUserIds: string[], attachments: ChatAttachment[]) => Promise<void> | void;
  disabled?: boolean;
}

/**
 * Composer with @ mention autocomplete + image and file attachments.
 * Files upload to the chat-attachments storage bucket under the sender's uid
 * folder; the resulting public URL + metadata is sent with the message.
 */
export default function MessageComposer({ onSend, disabled }: Props) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [tagged, setTagged] = useState<MentionUser[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [pending, setPending] = useState<ChatAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const updateMentionState = (value: string, caret: number) => {
    const upToCaret = value.slice(0, caret);
    const match = upToCaret.match(/(?:^|\s)@([a-zA-Z0-9_.-]{0,30})$/);
    setMentionQuery(match ? match[1] : null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setText(v);
    updateMentionState(v, e.target.selectionStart || v.length);
  };

  const handleSelectMention = (u: MentionUser) => {
    if (!inputRef.current) return;
    const caret = inputRef.current.selectionStart || text.length;
    const before = text.slice(0, caret);
    const after = text.slice(caret);
    const replaced = before.replace(/@([a-zA-Z0-9_.-]{0,30})$/, `@${u.username} `);
    const next = replaced + after;
    setText(next);
    setMentionQuery(null);
    setTagged((prev) => (prev.some((p) => p.user_id === u.user_id) ? prev : [...prev, u]));
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      const pos = replaced.length;
      inputRef.current?.setSelectionRange(pos, pos);
    });
  };

  const uploadFile = async (file: File, kind: "image" | "file") => {
    if (!user) {
      toast.error("Sign in to attach files");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Max 10 MB per file");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || (kind === "image" ? "jpg" : "bin");
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("chat-attachments").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("chat-attachments").getPublicUrl(path);
      setPending((prev) => [...prev, { url: data.publicUrl, type: kind, name: file.name, size: file.size }]);
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) uploadFile(f, "image");
    e.target.value = "";
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) uploadFile(f, "file");
    e.target.value = "";
  };

  const removePending = (idx: number) => setPending((prev) => prev.filter((_, i) => i !== idx));

  const submit = async () => {
    const content = text.trim();
    if ((!content && pending.length === 0) || sending) return;
    setSending(true);
    const usedTags = tagged.filter((u) =>
      new RegExp(`@${u.username}(?![a-zA-Z0-9_.-])`).test(content),
    );
    try {
      await onSend(content, usedTags.map((u) => u.user_id), pending);
      setText("");
      setTagged([]);
      setPending([]);
      setMentionQuery(null);
    } finally {
      setSending(false);
      // Refocus composer so users can keep typing without clicking back
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="relative border-t border-border/20 bg-background/70 backdrop-blur-sm p-3">
      {mentionQuery !== null && (
        <MentionAutocomplete query={mentionQuery} onSelect={handleSelectMention} />
      )}

      {pending.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {pending.map((a, i) => (
            <div key={i} className="relative">
              {a.type === "image" ? (
                <img src={a.url} alt="" className="h-14 w-14 rounded-lg object-cover" />
              ) : (
                <div className="flex h-14 max-w-[160px] items-center gap-2 rounded-lg bg-muted px-2.5 text-[10px]">
                  <Paperclip className="h-3 w-3" />
                  <span className="truncate">{a.name}</span>
                </div>
              )}
              <button
                onClick={() => removePending(i)}
                className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-background"
                aria-label="Remove attachment"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 rounded-2xl border border-border/30 bg-card/85 backdrop-blur-sm p-2 shadow-soft transition-colors focus-within:border-foreground/40">
        <input ref={imgInputRef} type="file" accept="image/*" onChange={onPickImage} className="hidden" />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={onPickImage} className="hidden" />
        <input ref={fileInputRef} type="file" onChange={onPickFile} className="hidden" />

        {/* + picker button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            disabled={disabled || uploading || sending}
            className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all disabled:opacity-40 ${
              pickerOpen
                ? "rotate-45 border-foreground bg-foreground text-background"
                : "border-foreground/20 text-foreground/70 hover:border-foreground/45 hover:text-foreground"
            }`}
            aria-label="Add attachment"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-5 w-5" strokeWidth={2.6} />}
          </button>

          {pickerOpen && (
            <>
              {/* click-away */}
              <div
                className="fixed inset-0 z-[55]"
                onClick={() => setPickerOpen(false)}
              />
              <div className="absolute bottom-12 left-0 z-[60] flex gap-2 rounded-2xl border-2 border-foreground/15 bg-background p-2 shadow-xl">
                <button
                  type="button"
                  onClick={() => { setPickerOpen(false); imgInputRef.current?.click(); }}
                  className="group flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition-colors hover:bg-foreground/[0.06]"
                  aria-label="Photo"
                >
                  <span className="text-2xl leading-none transition-transform group-hover:scale-110">🖼️</span>
                  <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-foreground/70">Photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setPickerOpen(false); cameraInputRef.current?.click(); }}
                  className="group flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition-colors hover:bg-foreground/[0.06]"
                  aria-label="Camera"
                >
                  <span className="text-2xl leading-none transition-transform group-hover:scale-110">📷</span>
                  <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-foreground/70">Camera</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setPickerOpen(false); fileInputRef.current?.click(); }}
                  className="group flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition-colors hover:bg-foreground/[0.06]"
                  aria-label="File"
                >
                  <span className="text-2xl leading-none transition-transform group-hover:scale-110">📎</span>
                  <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-foreground/70">File</span>
                </button>
              </div>
            </>
          )}
        </div>

        <textarea
          ref={inputRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKey}
          placeholder="Write a message… use @ to tag"
          rows={1}
          disabled={disabled || sending}
          className="max-h-32 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-[13.5px] text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={disabled || sending || (!text.trim() && pending.length === 0)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background transition-all hover:scale-105 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}
