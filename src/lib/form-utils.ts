import { FieldErrors } from 'react-hook-form';

/**
 * Scrolls to the first form field with a validation error and applies a shake animation.
 * Returns the number of error fields found.
 */
export function scrollToFirstError(errors: FieldErrors): number {
  const errorKeys = Object.keys(errors);
  if (errorKeys.length === 0) return 0;

  // Find the first error field's DOM element
  setTimeout(() => {
    const firstErrorKey = errorKeys[0];
    // Try to find by name attribute first, then by id
    const el =
      document.querySelector(`[name="${firstErrorKey}"]`) ||
      document.getElementById(firstErrorKey);

    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add shake animation class
      const container = el.closest('[data-form-field]') || el.parentElement;
      if (container) {
        container.classList.add('field-validation-error');
        setTimeout(() => container.classList.remove('field-validation-error'), 2000);
      }
    }
  }, 100);

  return errorKeys.length;
}
