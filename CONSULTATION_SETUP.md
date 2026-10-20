# veefivee Free Consultation — Web3Forms v34

Live URL: https://veefivee.com/free-consultation.html

## Form provider
Native HTML POST to https://api.web3forms.com/submit (no AJAX, no extra JavaScript submission library).
The provided Web3Forms access_key is embedded as a hidden field. Web3Forms explicitly permits public browser-side access keys; its corresponding configured receiving mailbox controls delivery. Confirm in the Web3Forms account that it sends to info@veefivee.com.

Form fields: name, email, industry, role, message. Note **message** (not the previous `inquiry` name).
Other hidden fields: access_key, subject, from_name, redirect.
Anti-spam: hidden `botcheck` checkbox. To enable stronger captcha, configure it in Web3Forms before modifying the page.
After a successful native submission, Web3Forms redirects to the full same-site URL https://veefivee.com/free-consultation.html?sent=1. A tiny script hides the form and displays an accessible on-page success confirmation. Errors remain under Web3Forms control.

## Testing
Once deployed, enter a real test lead and verify it arrives in the recipient mailbox (including Spam/Junk). Do not infer email delivery from the GitHub deployment; Web3Forms key settings must be correct. Avoid repeated test submissions in quick succession due to rate limits.
Native required fields and email validation work without JavaScript.
No appointment is auto-booked: submissions request a free first consultation, and the team contacts the visitor to arrange a time.

## Design and mobile constraints
Page is static HTML + css/consultation.css, without additional frameworks or heavy effects.
The existing veefivee logo, navigation, footer and GA4 tag are preserved.
Desktop editorial text left, elevated glass form right. On mobile/tablets <=820px, the form is displayed FIRST, immediately below the navigation; the larger editorial pitch follows below the form.
Soft purple/pink/blue radial gradients move slowly using transform/opacity-friendly effects. Respect prefers-reduced-motion.
Retain 320px responsive support, clear labels and accessible focus states, five form fields, privacy microcopy, and WhatsApp/email/phone cards.

Contact channels:
WhatsApp https://wa.me/923254891223
Email info@veefivee.com
Phone tel:+923254891223

SEO: standalone canonical URL, social metadata, structured ContactPage, sitemap entry.
