import { useRef, useState, KeyboardEvent } from "react";
import { Send } from "lucide-react";
import MentionAutocomplete, { type MentionUser } from "./MentionAutocomplete";

interface Props {
  onSend: (content: string, taggedUserIds: string[]) => Promise<void> | void;
  disabled?: boolean;
}

/**
 * Composer with inline @ mention autocomplete. As the user types "@xy" the
 * suggestion popover opens; selecting a result inserts "@username " and
 * appends the user's id to the tag list which is sent with the message.
 */
export default function MessageComposer({ onSend, disabled }: Props) {
  const [text, setText] = useState("");
  const [tagged, setTagged] = useState<MentionUser[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [sending, setSending] = useState(false);

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
    setTagged((prev) =>
      prev.some((p) => p.user_id === u.user_id) ? prev : [...prev, u],
    );
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      const pos = replaced.length;
      inputRef.current?.setSelectionRange(pos, pos);
    });
  };

  const submit = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    // Only keep tagged users whose @username actually still appears in text
    const usedTags = tagged.filter((u) =>
      new RegExp(`@${u.username}(?![a-zA-Z0-9_.-])`).test(content),
    );
    await onSend(content, usedTags.map((u) => u.user_id));
    setText("");
    setTagged([]);
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
      <div className="flex items-end gap-2 rounded-2xl border border-border/40 bg-card p-2 shadow-soft">
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
          disabled={disabled || sending || !text.trim()}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
