-- Fix function search path for generate_nc_number
CREATE OR REPLACE FUNCTION public.generate_nc_number()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.nc_number := 'NC-' || TO_CHAR(NOW(), 'YYYY-MM') || '-' || LPAD(nextval('public.nc_number_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

-- Fix function search path for update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Fix function search path for handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  
  -- Assign default worker role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'worker');
  
  RETURN NEW;
END;
$$;