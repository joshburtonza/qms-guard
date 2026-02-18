-- Drop and recreate the update policy to allow verifier updates at open status (QA classification) AND pending_verification
DROP POLICY IF EXISTS "Users can update relevant NCs" ON public.non_conformances;

CREATE POLICY "Users can update relevant NCs" 
ON public.non_conformances 
FOR UPDATE 
TO authenticated
USING (
  (reported_by = auth.uid()) 
  OR (responsible_person = auth.uid()) 
  OR is_admin(auth.uid()) 
  OR (has_role(auth.uid(), 'manager'::app_role) AND (department_id = get_user_department(auth.uid())))
  OR (has_role(auth.uid(), 'verifier'::app_role) AND (status IN ('open'::nc_status, 'pending_verification'::nc_status)))
);