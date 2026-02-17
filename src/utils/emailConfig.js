// EmailJS Configuration
// Get these from https://dashboard.emailjs.com/
// 1. Sign up/Login to EmailJS
// 2. Add a customized Email Service (e.g., Gmail) -> Get Service ID
// 3. Create an Email Template -> Get Template ID
//    - Subject: Ticket Booking Confirmation
//    - Content: 
//      Hello {{name}},
//      You have successfully booked {{tickets_count}} tickets for {{event_title}}.
//      Seats: {{seats}}
//      Total Price: {{total_price}} KGS
// 4. Go to Account > API Keys -> Get Public Key

export const EMAILJS_CONFIG = {
    SERVICE_ID: 'YOUR_SERVICE_ID_HERE',
    TEMPLATE_ID: 'YOUR_TEMPLATE_ID_HERE',
    PUBLIC_KEY: 'YOUR_PUBLIC_KEY_HERE'
};
