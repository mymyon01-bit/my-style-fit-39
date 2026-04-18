CREATE POLICY "Admins can view all tryons"
ON public.fit_tryons
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));