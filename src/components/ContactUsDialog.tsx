/**
 * ContactUsDialog — neutral "CONTACT US" form used for both the
 * AFFILIATE / AD enquiry button on the About page and the "ADD YOUR AD"
 * slot on the FEED top row.
 *
 * Implementation note: We deliberately avoid wiring this to a backend mail
 * service. Submitting opens the user's mail client with a pre-filled body
 * addressed to mymyon.01@gmail.com. The recipient is hidden from the UI
 * (only the "CONTACT US" label is shown) per product request.
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const RECIPIENT = "mymyon.01@gmail.com";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional context appended to the subject (e.g. "Affiliate / Ad"). */
  topic?: string;
}

export default function ContactUsDialog({ open, onOpenChange, topic }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error("Please fill in name, email and message.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setSubmitting(true);
    const subject = topic ? `[${topic}] Inquiry from ${name}` : `Inquiry from ${name}`;
    const body = `Name: ${name}\nEmail: ${email}\n\n${message}`;
    const href = `mailto:${RECIPIENT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
    setTimeout(() => {
      setSubmitting(false);
      toast.success("Opening your mail app…");
      onOpenChange(false);
      setName("");
      setEmail("");
      setMessage("");
    }, 400);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-[20px] tracking-[0.04em]">CONTACT US</DialogTitle>
          <DialogDescription className="text-[12px] text-foreground/65">
            Leave your details and message — we'll get back to you shortly.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="cu-name" className="text-[10px] font-semibold tracking-[0.18em] text-foreground/65">NAME</Label>
            <Input id="cu-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cu-email" className="text-[10px] font-semibold tracking-[0.18em] text-foreground/65">EMAIL</Label>
            <Input id="cu-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cu-msg" className="text-[10px] font-semibold tracking-[0.18em] text-foreground/65">MESSAGE</Label>
            <Textarea
              id="cu-msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={1500}
              rows={5}
              placeholder="문의를 바랍니다 — please write your inquiry here."
              required
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg border border-accent/40 bg-accent/[0.08] py-3 text-[11px] font-semibold tracking-[0.22em] text-foreground/85 transition-all hover:bg-accent/[0.14] disabled:opacity-50"
          >
            {submitting ? "SENDING…" : "SEND"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
