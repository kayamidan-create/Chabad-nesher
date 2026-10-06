# Chabad Nesher content management

Deployment: dedicated Supabase project `spnvneybufdooghsrybn`, connected to
the existing GitHub Pages site. Public sign-ups are disabled. Only the shared
owner-created Auth account is allowlisted. No passwords or secret keys are
stored in this repository.

Verified on the database: RLS enabled on all content tables, public gallery
reads, draft hiding, anonymous insert denial, allowlist write denial, and
allowlisted account insert/update. Security advisors returned no findings.
Browser login and image upload should also be checked after deployment.

Setup:

1. Create/select a dedicated Supabase project for this website.
2. Apply `schema.sql` once. Its RLS grants public reads of published content and
   permits changes only to users listed in `cms_admins`.
3. Disable public user sign-ups. Create a shared, email-confirmed password Auth
   user through the dashboard; the owners enter their own password securely.
   Do not enter the password into source control, SQL scripts, or chat.
4. Insert that existing Auth user's UUID into `cms_admins` using a privileged
   dashboard/SQL operation. No browser role can edit this allowlist.
5. Set the project URL and public publishable key in `site/cms-config.js`.
   Keep the login email out of public source code; owners enter it at login.
   Never use a secret/service-role key in browser code.
6. Verify anonymous write denial, non-admin write denial, owner login, image
   upload, draft vs published update, archive/restore, conflicting concurrent
   saves, and public reading from a separate unsigned-in browser.
7. Publish the configured files to main only after verification. The existing
   GitHub Pages URL is retained.

The initial 17 gallery photos remain at their existing static URLs. New images
are uploaded to a public image-only bucket after authentication. Archiving
records hides them from visitors and preserves recovery. Uploaded originals
are converted to JPEG without EXIF and scaled to 1600px. No permanent file
deletion is offered in the admin UI.

The backend is authoritative for access. Client checks only improve feedback.
`updated_at` filters reject conflicting stale edits. Sessions are held in
sessionStorage; passwords are never stored. Authentication uses Supabase's
password/refresh-token endpoints and public API keys, protected by RLS.
