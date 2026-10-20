# veefivee Free Consultation — launch and maintenance

## Live page
https://veefivee.com/free-consultation.html

## Form handling
The form is a regular HTML POST to https://formsubmit.co/info@veefivee.com.
Fields: name, email, industry, role, inquiry.
Includes: _subject, _template=table, _url, _next, and an empty _honey anti-spam field.
FormSubmit's default anti-spam CAPTCHA is left enabled. There is no site server or client-side form AJAX.
The _next URL returns to the consultation page with ?submitted=1 after FormSubmit's successful flow.
Do not claim the appointment is booked: this is a free discovery-call request, and staff arrange the time afterward.

**One-time activation (required):** Submit a real test enquiry from the live page. Then check info@veefivee.com for the FormSubmit activation email and click its confirmation link. FormSubmit reports that it retains submissions until confirmation and delivers them afterward. Check spam/junk. Without confirmation, do not assume leads are being delivered.

## Contact links
WhatsApp: https://wa.me/923254891223
Email: info@veefivee.com
Phone: tel:+923254891223
Keep the existing /contact.html page accessible through its footer link; the global header CTA now links to /free-consultation.html.

## Navigation / design contract
Use a single global glass capsule with Home, About, Industries, Services, Products, Free Consultation on mobile; Blog is desktop-only in the header. The consultation label is blue regular-weight when inactive on mobile, and dark bold when on the consultation page. The same CTA is shown desktop and mobile. Shared nav styles are in css/blog-nav.css and MUST load last.
The consultation layout and gradient animation are in css/consultation.css. Retain the palm brand, soft pastel movement, reduced-motion support, optimized static HTML and GA4 tag G-086Y2TSZTM.
New pages/templates should use the same global header, stylesheet load order, and footer.
