import { Link } from 'react-router-dom';
import PolicyLayout from '../components/PolicyLayout';
import { EmailLink, WhatsAppLink } from '../components/ContactLinks';
import { POLICY_UPDATED } from '../siteInfo';

export default function DeleteAccount() {
  return (
    <PolicyLayout
      title="Delete your Aqua Imperial account"
      updated={POLICY_UPDATED}
      intro="How to delete your account in the Aqua Imperial Android app, developed and operated by Mahesh Enterprises."
    >
      <h2>1. In the app</h2>
      <p>Open the Aqua Imperial app and go to <strong>Profile → Delete account</strong>.</p>

      <h2>2. Or send us a request</h2>
      <p>
        Email <EmailLink subject="Delete my account" /> or send us a message on{' '}
        <WhatsAppLink text="Delete my account">WhatsApp</WhatsAppLink> <strong>from your registered mobile
        number</strong>, with the subject “Delete my account”. We verify the number and complete the deletion within
        7 days.
      </p>

      <h2>Before you delete: end any running rental</h2>
      <p>
        You can’t delete your account while a rental is running. Cancel your plan first: we pick up the purifier and
        refund your security deposit, as set out in our <Link to="/refund-policy">Cancellation &amp; Refund
        Policy</Link>. Then delete your account.
      </p>

      <h2>What is deleted</h2>
      <ul>
        <li>your name, email address and installation address;</li>
        <li>your KYC details (the last 4 digits of your Aadhaar number and your PAN);</li>
        <li>your app notification tokens;</li>
        <li>your login. Your mobile number is removed from the account.</li>
      </ul>

      <h2>What we keep, and why</h2>
      <ul>
        <li>
          Payment and invoice records, for the period required by Indian tax and accounting law (up to 8 years).
        </li>
        <li>Records needed to settle an open rental, deposit or refund.</li>
      </ul>
      <p>
        More about how we handle your data is in our <Link to="/privacy">Privacy Policy</Link>.
      </p>
    </PolicyLayout>
  );
}
