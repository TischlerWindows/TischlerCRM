import { redirect } from 'next/navigation';

/**
 * Legacy standalone contact-create page.
 *
 * The canonical "new contact" UX is the multi-step DynamicFormDialog opened
 * from the "+ New Contact" button on /contacts. This older single-page form
 * had weaker semantics (free-text Account, missing Salutation/Title) and
 * isn't linked from anywhere in the UI. Redirect any direct navigations
 * (bookmarks / old links) to the contacts list, where the user can open
 * the proper dialog.
 */
export default function NewContactRedirect() {
  redirect('/contacts?new=true');
}
