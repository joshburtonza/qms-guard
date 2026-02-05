-- Create function to auto-assign training manager based on department
CREATE OR REPLACE FUNCTION auto_assign_training_manager()
RETURNS TRIGGER AS $$
DECLARE
  assigned_manager_id UUID;
BEGIN
  -- Look up the training manager for this department
  SELECT training_manager_id INTO assigned_manager_id
  FROM department_manager_mapping
  WHERE department_id = NEW.department_id;
  
  -- If a mapping exists, we could store it in additional_stakeholders
  -- For now, we'll log the assignment for tracking
  IF assigned_manager_id IS NOT NULL THEN
    -- Add the training manager as an additional stakeholder if not already the responsible person
    IF NEW.additional_stakeholders IS NULL THEN
      NEW.additional_stakeholders := ARRAY[assigned_manager_id::TEXT];
    ELSIF NOT (assigned_manager_id::TEXT = ANY(NEW.additional_stakeholders)) THEN
      NEW.additional_stakeholders := array_append(NEW.additional_stakeholders, assigned_manager_id::TEXT);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for auto-assignment on NC insert
CREATE TRIGGER auto_assign_training_manager_trigger
  BEFORE INSERT ON public.non_conformances
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_training_manager();

-- Also trigger on department change
CREATE TRIGGER auto_assign_training_manager_on_update
  BEFORE UPDATE OF department_id ON public.non_conformances
  FOR EACH ROW
  WHEN (OLD.department_id IS DISTINCT FROM NEW.department_id)
  EXECUTE FUNCTION auto_assign_training_manager();