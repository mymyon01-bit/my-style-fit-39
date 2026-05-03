-- Allow message senders to delete (unsend) their own messages
CREATE POLICY "Senders can delete their own messages"
ON public.messages
FOR DELETE
USING (auth.uid() = sender_id);