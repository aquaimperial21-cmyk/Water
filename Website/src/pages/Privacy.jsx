import { Link } from 'react-router-dom';
import PolicyLayout from '../components/PolicyLayout';
import { EmailLink, PhoneLink } from '../components/ContactLinks';
import { BUSINESS, POLICY_UPDATED } from '../siteInfo';

export default function Privacy() {
  return (
    <PolicyLayout title="Privacy Policy" updated={POLICY_UPDATED}>
      <p>
        This policy explains what personal data we collect through the <strong>Aqua Imperial</strong> Android app,
        our purifiers and this website, how we use it and the choices you have.
      </p>

      <h2>Who we are</h2>
      <p>
        The Aqua Imperial Android app, the Aqua Imperial purifier rental service and this website are provided by
        {' '}{BUSINESS.legalName} (“we”, “us”), the app’s developer and operator: a sole proprietorship whose
        proprietor is {BUSINESS.proprietor}, of {BUSINESS.address}. We are responsible for the personal data
        described here.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account details:</strong> your name, mobile number and, if you choose to give it, your email address.</li>
        <li><strong>Installation address:</strong> where the purifier is installed, serviced and collected.</li>
        <li>
          <strong>KYC details for rental security:</strong> the last 4 digits of your Aadhaar number and your PAN.
          We do not ask for your full Aadhaar number.
        </li>
        <li>
          <strong>Payment records:</strong> what you paid or were refunded, when, and for which plan, with the
          payment references. Your card, UPI and bank details are handled by Razorpay and are never stored by us.
        </li>
        <li>
          <strong>Purifier data:</strong> water usage, filter health and connectivity, reported by the purifier
          installed at your address.
        </li>
        <li><strong>Support requests:</strong> service requests and messages you send us.</li>
        <li><strong>App notification tokens:</strong> an identifier that lets us send notifications to your phone.</li>
        <li>
          <strong>Referral codes:</strong> your referral code and any code you used, so referral credit can be
          applied.
        </li>
        <li>
          <strong>Website enquiries:</strong> if you fill in an enquiry form on this website, the name, mobile
          number and city you enter, and any email address or message you add.
        </li>
      </ul>

      <h2>How we use it</h2>
      <p>We use your data only to provide, bill and support the service and to meet our legal obligations. That means:</p>
      <ul>
        <li>
          signing you in, installing, servicing and collecting your purifier, and keeping water on or off according
          to your plan;
        </li>
        <li>taking payments, running Autopay renewals if you turn it on, issuing refunds and keeping payment records;</li>
        <li>
          answering your requests and sending reminders before your plan ends (by app notification, SMS or WhatsApp)
          and other service messages;
        </li>
        <li>keeping records the law requires us to keep.</li>
      </ul>
      <p><strong>We never sell your personal data.</strong></p>

      <h2>Who we share it with</h2>
      <p>We share only what each service provider needs to do its job for us:</p>
      <ul>
        <li><strong>Razorpay</strong> — processes payments, Autopay mandates and refunds.</li>
        <li>
          <strong>Google Firebase</strong> — phone-number login with a one-time code (Firebase Authentication) and
          push notifications to your phone (Firebase Cloud Messaging).
        </li>
        <li>
          <strong>Expo</strong> — the push-notification service the app uses to pass our notifications to Firebase
          Cloud Messaging.
        </li>
        <li>
          <strong>Our hosting provider</strong> — runs the servers that store the service’s data, in a data centre
          in India or the European Union.
        </li>
        <li><strong>SMS and WhatsApp messaging providers</strong> — to deliver reminders and service messages.</li>
        <li>
          <strong>Vercel</strong> — hosts this website and passes what you send through its enquiry forms on to our
          servers.
        </li>
      </ul>
      <p>We may also disclose data where Indian law requires it, for example to a court or a government authority.</p>

      <h2>How long we keep it</h2>
      <p>
        We keep your data while your account is active. Payment records are kept for as long as the law requires
        (up to 8 years under Indian tax and accounting law), including after your account is closed.
      </p>

      <h2>Your choices and rights</h2>
      <p>
        You can ask to see, correct or delete your personal data by emailing <EmailLink />. We may need to confirm
        that the request comes from you, for example through your registered mobile number. Payment records that
        the law requires us to keep cannot be deleted until that period ends.
      </p>

      <h2>Deleting your account</h2>
      <p>
        You can delete your account in the app (Profile → Delete account), or ask us to delete it by email or
        WhatsApp. Our <Link to="/delete-account">Delete your account</Link> page explains how, what is deleted and
        what we have to keep.
      </p>

      <h2>Children</h2>
      <p>The service is not intended for anyone under 18, and we do not knowingly collect data from children.</p>

      <h2>Cookies and tracking</h2>
      <p>
        This website sets no cookies and uses no analytics or tracking tools. It stores a note in your browser’s
        session storage that the enquiry pop-up has been shown, so it does not appear again during your visit. The
        site’s fonts are loaded from Google Fonts.
      </p>

      <h2>Security</h2>
      <p>
        Data travelling between the app, the purifiers, this website and our servers is sent over encrypted
        (HTTPS/TLS) connections.
      </p>

      <h2>Changes to this policy</h2>
      <p>We may update this policy from time to time. The “Last updated” date at the top shows when it last changed.</p>

      <h2>Contact and grievances</h2>
      <p>
        For any privacy question or complaint, contact {BUSINESS.proprietor}, Proprietor, Mahesh Enterprises:
        {' '}<EmailLink />, <PhoneLink />, or at the address above.
      </p>
    </PolicyLayout>
  );
}
