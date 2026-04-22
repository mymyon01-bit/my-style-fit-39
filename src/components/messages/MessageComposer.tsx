import { useRef, useState, KeyboardEvent } from "react";
import { Send, Image as ImageIcon, Paperclip, X, Loader2 } from "lucide-react";
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    await onSend(content, usedTags.map((u) => u.user_id), pending);
    setText("");
    setTagged([]);
    setPending([]);
    setMentionQuery(null);
    setSending(false);
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="relative border-t border-border/40 bg-background p-3">
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

      <div className="flex items-end gap-2 rounded-2xl border border-border/40 bg-card p-2 shadow-soft">
        <input ref={imgInputRef} type="file" accept="image/*" capture="environment" onChange={onPickImage} className="hidden" />
        <input ref={fileInputRef} type="file" onChange={onPickFile} className="hidden" />
        <button
          type="button"
          onClick={() => imgInputRef.current?.click()}
          disabled={disabled || uploading || sending}
          className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/60 hover:bg-muted hover:text-foreground disabled:opacity-40"
          aria-label="Attach photo"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading || sending}
          className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/60 hover:bg-muted hover:text-foreground disabled:opacity-40"
          aria-label="Attach file"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <textarea
          ref={inputRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKey}
          placeholder="Write a message… use @ to tag"
          rows={1}
          disabled={disabled || sending}
          className="max-h-32 min-h-[36px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={disabled || sending || (!text.trim() && pending.length === 0)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
