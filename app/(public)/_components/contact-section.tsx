"use client";

import { useActionState, useEffect, useRef } from "react";
import { submitContactAction, type ContactActionState } from "@/app/actions/contact.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function ContactSection() {
  const [state, action, isPending] = useActionState<ContactActionState, FormData>(submitContactAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state?.success]);

  return (
    <section id="contact" className="py-24 px-6">
      <div className="max-w-xl mx-auto">
        <h2 className="text-3xl font-bold tracking-tight text-foreground mb-2">Connect with us</h2>
        <p className="text-muted-foreground mb-10">Have a question or want to know more? Send us a message and we&apos;ll get back to you.</p>

        {state?.success ? (
          <div className="rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/5 p-6 text-center">
            <p className="text-[#22c55e] font-medium">Message sent — we&apos;ll be in touch soon.</p>
          </div>
        ) : (
          <form ref={formRef} action={action} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="contact-name">Name</Label>
              <Input
                id="contact-name"
                name="name"
                placeholder="Your name"
                required
                maxLength={100}
                aria-label="Your name"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contact-email">Email</Label>
              <Input
                id="contact-email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                aria-label="Your email address"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contact-message">Message</Label>
              <textarea
                id="contact-message"
                name="message"
                placeholder="Tell us what's on your mind..."
                required
                minLength={10}
                maxLength={2000}
                rows={5}
                aria-label="Your message"
                className="flex w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {state?.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}

            <Button
              type="submit"
              disabled={isPending}
              className={cn("w-full", isPending && "opacity-70 cursor-not-allowed")}
              aria-label="Send message"
            >
              {isPending ? "Sending…" : "Send message"}
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
